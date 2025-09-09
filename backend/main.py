from io import BytesIO
from fastapi import FastAPI, File, UploadFile, Form
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi.middleware.cors import CORSMiddleware
import uvicorn
import json
import os
import shutil
import fitz
from tempfile import NamedTemporaryFile
from typing import List, Optional
from dotenv import load_dotenv

import google.generativeai as genai

import docx
from docx import Document
from docx.shared import Pt, Inches
from docx.enum.text import WD_PARAGRAPH_ALIGNMENT

from PyPDF2 import PdfReader

load_dotenv()
genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

async def gemini_call(prompt: str) -> str:
    try:
        model = genai.GenerativeModel("gemini-2.5-pro")
        response = model.generate_content(prompt)
        return response.text if response and response.text else "No response generated."
    except Exception as e:
        return f"Gemini API error: {str(e)}"

app = FastAPI(title="AI Resume & Career Guidance Bot")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


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
    ai_text = genai.GenerativeModel("gemini-2.5-pro").generate_content(prompt).text
    try:
        data = json.loads(ai_text)
    except:
        data = {"summary": text[:200], "skills": [], "experience": [], "education": []}
    return data


@app.get("/")
def read_root():
    return {"message": "AI Resume Builder is running with Gemini"}

@app.post("/analyze")
async def analyze_resume(
    text: Optional[str] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    extracted_text = ""
    if file is not None:
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

@app.post("/analyze_resume")
async def analyze_resume(file: UploadFile = File(...)):
    try:
        pdf_bytes = await file.read()
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")

        text = ""
        for page in doc:
            text += page.get_text()

        if not text.strip():
            return {"error": "No text found in resume."}

        prompt = f"Analyze this resume. Provide strengths, weaknesses, and career improvement advice:\n\n{text}"
        analysis = await gemini_call(prompt)

        return {"analysis": analysis}
    except Exception as e:
        return {"error": str(e)}

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
        # Parse JSON safely
        try:
            education = json.loads(education_json)
            if not isinstance(education, list):
                education = []
        except:
            education = []

        try:
            experience = json.loads(experience_json)
            if not isinstance(experience, list):
                experience = []
        except:
            experience = []

        # Ensure name is valid for filename
        safe_name = name.strip() or "resume"
        filename = f"{safe_name.replace(' ','_')}_resume.docx"

        # Create DOCX
        doc = Document()

        # Header
        header = doc.add_paragraph(safe_name)
        header.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
        run = header.runs[0]
        run.font.size = Pt(18)
        run.bold = True

        # Contact info
        contact_info = " | ".join([email or "", phone or "", location or ""])
        contact = doc.add_paragraph(contact_info)
        contact.alignment = WD_PARAGRAPH_ALIGNMENT.CENTER
        doc.add_paragraph()

        # Summary
        if summary.strip():
            doc.add_heading("Professional Summary", level=1)
            doc.add_paragraph(summary.strip())

        # Skills
        if skills.strip():
            doc.add_heading("Key Skills", level=1)
            doc.add_paragraph(skills.strip())

        # Experience
        if experience:
            doc.add_heading("Work Experience", level=1)
            for exp in experience:
                title = exp.get("title","").strip()
                company = exp.get("company","").strip()
                duration = exp.get("duration","").strip()
                description = exp.get("description","").strip()

                if title or company or duration:
                    para = doc.add_paragraph()
                    run = para.add_run(f"{title} — {company} ({duration})")
                    run.bold = True
                    if description:
                        doc.add_paragraph(description)

        # Education
        if education:
            doc.add_heading("Education", level=1)
            for edu in education:
                degree = edu.get("degree","").strip()
                institution = edu.get("institution","").strip()
                year = edu.get("year","").strip()

                if degree or institution or year:
                    para = doc.add_paragraph()
                    run = para.add_run(f"{degree}, {institution} ({year})")
                    run.bold = True

        # Save to BytesIO
        buf = BytesIO()
        doc.save(buf)
        buf.seek(0)

        return StreamingResponse(
            buf,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f"attachment; filename={filename}"}
        )

    except Exception as e:
        # Catch any unexpected errors
        return JSONResponse({"error": f"Resume generation failed: {str(e)}"}, status_code=500)



if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
