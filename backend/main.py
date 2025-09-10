from io import BytesIO
from fastapi import FastAPI, File, UploadFile, Form, Request
from fastapi.responses import JSONResponse, StreamingResponse, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.requests import Request
from starlette.middleware.base import BaseHTTPMiddleware
import uvicorn
import json
import os
import shutil
import secrets
from tempfile import NamedTemporaryFile
from typing import Optional
from dotenv import load_dotenv

import google.generativeai as genai
import docx
from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT
from PyPDF2 import PdfReader

# --- Load env and configure Gemini API ---
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# --- FastAPI App ---
app = FastAPI(title="AI Resume & Career Guidance Bot")
templates = Jinja2Templates(directory="public")

# --- Logging & CORS ---
import logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- CSP Nonce Middleware ---
class CSPNonceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        nonce = secrets.token_urlsafe(16)
        request.state.nonce = nonce
        response = await call_next(request)
        csp_value = (
            f"default-src 'self'; "
            f"connect-src 'self' https://ai-resume-generator-rw01.onrender.com; "
            f"script-src 'self' 'nonce-{nonce}'; "
            f"style-src 'self' 'nonce-{nonce}'; "
            f"img-src 'self' data:;"
        )
        response.headers["Content-Security-Policy"] = csp_value
        response.headers["X-CSP-Nonce"] = nonce
        return response

app.add_middleware(CSPNonceMiddleware)
app.mount("/static", StaticFiles(directory="public"), name="static")

# --- Utility Functions ---
def extract_text_from_pdf(file_path: str) -> str:
    text = []
    with open(file_path, "rb") as fh:
        reader = PdfReader(fh)
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text.append(page_text)
    return "\n".join(text)

def extract_text_from_docx(file_path: str) -> str:
    doc = docx.Document(file_path)
    return "\n".join([p.text for p in doc.paragraphs])

async def gemini_call(prompt: str, model: str = "gemini-2.5-pro") -> str:
    try:
        response = genai.GenerativeModel(model).generate_content(prompt)
        return response.text if response and response.text else "No response generated."
    except Exception as e:
        return f"Gemini API error: {str(e)}"

# --- Routes ---
@app.get("/")
@app.head("/")
async def serve_index(request: Request):
    nonce = getattr(request.state, "nonce", "")
    return templates.TemplateResponse("index.html", {"request": request, "nonce": nonce})

@app.get("/hello")
def hello():
    return {"message": "Hello World"}

# --- Analyze Resume ---
# --- /analyze endpoint ---
@app.post("/analyze")
async def analyze_resume(
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    extracted_text = ""

    # Extract text from uploaded file
    if file:
        suffix = os.path.splitext(file.filename)[1].lower()
        with NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            tmp_name = tmp.name
            shutil.copyfileobj(file.file, tmp)
        try:
            if suffix == ".pdf":
                extracted_text = extract_text_from_pdf(tmp_name)
            elif suffix in [".docx", ".doc"]:
                extracted_text = extract_text_from_docx(tmp_name)
            else:
                with open(tmp_name, "r", encoding="utf-8", errors="ignore") as fh:
                    extracted_text = fh.read()
        finally:
            os.remove(tmp_name)
    elif text:
        extracted_text = text
    else:
        return JSONResponse({"error": "No text or file provided."}, status_code=400)

    # AI parsing with proper escaping
    try:
        prompt = f"""
You are an AI that extracts structured resume data.

Extract JSON with fields:
{{
  "summary": "A 2-3 sentence professional summary",
  "skills": ["list of technical or soft skills"],
  "experience": [{{"title":"", "company":"", "duration":"", "description":""}}],
  "education": [{{"degree":"", "institution":"", "year":""}}]
}}

Resume Text:
{extracted_text}

ONLY return valid JSON.
"""
        ai_text = genai.GenerativeModel("gemini-2.5-pro").generate_content(prompt).text
        data = json.loads(ai_text)

        # Fallbacks if AI didn't return proper data
        if not data.get("summary"):
            data["summary"] = "\n".join(extracted_text.split("\n")[:3])
        if not data.get("skills") or not isinstance(data["skills"], list):
            common_skills = ["python", "java", "javascript", "c++", "sql", "fastapi", "react", "html", "css"]
            text_lower = extracted_text.lower()
            data["skills"] = [s.capitalize() for s in common_skills if s in text_lower]

    except Exception as e:
        print("AI parsing failed:", e)
        data = {
            "summary": "\n".join(extracted_text.split("\n")[:3]),
            "skills": [],
            "experience": [],
            "education": []
        }

    return {
        "extracted_text_snippet": extracted_text[:300],
        **data
    }


# --- /enhance endpoint ---
@app.post("/enhance")
async def enhance_resume(
    text: str = Form(...),
    purpose: str = Form("resume")
):
    if purpose == "resume":
        system_prompt = "Rewrite this resume text to be concise, professional, and achievement-focused."
    else:
        system_prompt = "Improve grammar, clarity, and professionalism of this text."

    try:
        improved_text = await gemini_call(system_prompt + "\n\n" + text)
    except Exception as e:
        improved_text = text
        print("AI enhancement failed:", e)

    return {"original": text, "improved": improved_text}


# --- Generate Resume ---
@app.post("/generate")
async def generate_resume(
    name: str = Form(...),
    email: str = Form(...),
    phone: str = Form(...),
    location: str = Form(...),
    summary: str = Form(""),
    skills: str = Form(""),
    education_json: str = Form("[]"),
    experience_json: str = Form("[]"),
):
    try:
        education = json.loads(education_json)
        experience = json.loads(experience_json)

        doc = Document()
        header = doc.add_paragraph(name)
        header.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
        run = header.runs[0]
        run.font.size = Pt(18)
        run.bold = True

        contact = doc.add_paragraph(f"{email} | {phone} | {location}")
        contact.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
        doc.add_paragraph()

        if summary:
            doc.add_heading("Professional Summary", level=1)
            doc.add_paragraph(summary)

        if skills:
            doc.add_heading("Key Skills", level=1)
            for skill in skills.split(","):
                doc.add_paragraph(skill.strip(), style="List Bullet")

        if experience:
            doc.add_heading("Work Experience", level=1)
            for exp in experience:
                para = doc.add_paragraph()
                run = para.add_run(
                    f"{exp.get('title','')} — {exp.get('company','')} ({exp.get('duration','')})"
                )
                run.bold = True
                if exp.get("description", ""):
                    for line in exp["description"].split("\n"):
                        if line.strip():
                            doc.add_paragraph(line.strip(), style="List Bullet")

        if education:
            doc.add_heading("Education", level=1)
            for edu in education:
                para = doc.add_paragraph()
                run = para.add_run(
                    f"{edu.get('degree','')}, {edu.get('institution','')} ({edu.get('year','')})"
                )
                run.bold = True

        buf = BytesIO()
        doc.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={name.replace(' ','_')}_resume.docx"},
        )
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# --- Run App ---
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
