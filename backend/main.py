from io import BytesIO
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse, StreamingResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import uvicorn
import json
import os
import shutil
import fitz
from tempfile import NamedTemporaryFile
from typing import Optional
from dotenv import load_dotenv

import google.generativeai as genai

import docx
from docx import Document
from docx.shared import Pt
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT

from PyPDF2 import PdfReader

# Load environment variables
load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

app = FastAPI(title="AI Resume & Career Guidance Bot")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve static files (optional: for JS/CSS)
app.mount("/static", StaticFiles(directory=".."), name="static")

# Serve index.html at root
@app.get("/")
def serve_index():
    return FileResponse("../index.html")


# Utility functions
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

def parse_resume_with_ai(text: str):
    prompt = f"""
    Extract a JSON from the following resume text.
    Format strictly as JSON with fields:
    {{
      "summary": "",
      "skills": ["skill1", "skill2"],
      "experience": [{{"title":"", "company":"", "duration":"", "description":""}}],
      "education": [{{"degree":"", "institution":"", "year":""}}]
    }}
    Resume Text:
    {text}
    """
    try:
        ai_text = genai.GenerativeModel("gemini-2.5-pro").generate_content(prompt).text
        data = json.loads(ai_text)
    except:
        data = {"summary": text[:200], "skills": [], "experience": [], "education": []}
    return data

# --- Endpoints ---

@app.post("/analyze")
async def analyze_resume(
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    extracted_text = ""
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

    ai_data = parse_resume_with_ai(extracted_text)
    return {
        "extracted_text_snippet": extracted_text[:300],
        "ai_parsed": ai_data
    }

@app.post("/enhance")
async def enhance_text(
    text: str = Form(...),
    purpose: str = Form("resume")
):
    if purpose == "resume":
        system_prompt = "Rewrite this resume text to be concise, professional, and achievement-focused."
    else:
        system_prompt = "Improve grammar, clarity, and professionalism of this text."
    
    improved = await gemini_call(system_prompt + "\n\n" + text)
    return {"original": text, "improved": improved}

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

        # Header
        header = doc.add_paragraph(name)
        header.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
        run = header.runs[0]
        run.font.size = Pt(18)
        run.bold = True

        contact = doc.add_paragraph(f"{email} | {phone} | {location}")
        contact.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER

        doc.add_paragraph()

        # Summary
        if summary:
            doc.add_heading("Professional Summary", level=1)
            doc.add_paragraph(summary)

        # Skills
        if skills:
            doc.add_heading("Key Skills", level=1)
            doc.add_paragraph(skills)

        # Experience
        if experience:
            doc.add_heading("Work Experience", level=1)
            for exp in experience:
                para = doc.add_paragraph()
                run = para.add_run(f"{exp.get('title','')} — {exp.get('company','')} ({exp.get('duration','')})")
                run.bold = True
                doc.add_paragraph(exp.get("description",""))

        # Education
        if education:
            doc.add_heading("Education", level=1)
            for edu in education:
                para = doc.add_paragraph()
                run = para.add_run(f"{edu.get('degree','')}, {edu.get('institution','')} ({edu.get('year','')})")
                run.bold = True

        buf = BytesIO()
        doc.save(buf)
        buf.seek(0)
        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={name.replace(' ','_')}_resume.docx"}
        )
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)

# Run locally
if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
