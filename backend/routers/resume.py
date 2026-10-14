"""
TalentLens — Resume Upload & Analysis Router
============================================
POST /api/resume/analyze
  - Accepts PDF or DOCX file upload
  - Extracts text using PyPDF2 / python-docx
  - Cleans text, extracts skills using NLP
  - Computes TF-IDF cosine similarity vs 7 job roles
  - Returns real resume score based on FILE CONTENT ONLY
"""

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from typing import Optional

from resume_parser import (
    extract_text,
    clean_text,
    extract_skills,
    compute_all_role_similarities,
    score_resume_from_text,
    HAS_PDF,
    HAS_DOCX,
    HAS_SKLEARN,
)

router = APIRouter()

MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


@router.get("/status")
def resume_status():
    """Check which parsing libraries are available."""
    return {
        "PyPDF2":       HAS_PDF,
        "python-docx":  HAS_DOCX,
        "scikit-learn": HAS_SKLEARN,
        "message": "All libraries ready" if (HAS_PDF and HAS_DOCX and HAS_SKLEARN)
                   else "Some libraries missing — run: pip install PyPDF2 python-docx scikit-learn",
    }


@router.post("/analyze")
async def analyze_resume(
    file: UploadFile = File(..., description="Resume file — PDF or DOCX"),
    exp:  int        = Form(0,   description="Years of experience (from form)"),
    name: str        = Form("",  description="Candidate name"),
):
    """
    Main resume analysis endpoint.

    Flow:
    1.  Validate file type and size
    2.  Read file bytes
    3.  Extract text (PyPDF2 for PDF, python-docx for DOCX)
    4.  Clean text (lowercase, remove stopwords, punctuation)
    5.  Extract skills using NLP keyword matching
    6.  Compute TF-IDF + cosine similarity vs 7 job descriptions
    7.  Generate resume score based ONLY on file content
    8.  Return full analysis JSON

    Example response:
    {
        "success": true,
        "filename": "arjun_resume.pdf",
        "resume_score": 78,
        "word_count": 542,
        "skill_count": 14,
        "skills_found": ["python", "react", "aws", "docker", ...],
        "skills_by_category": {
            "languages": ["python", "javascript"],
            "frontend":  ["react", "html", "css"],
            "cloud":     ["aws", "docker"]
        },
        "role_fit": [
            {"name": "Full Stack Developer", "percent": 82, "similarity": 0.7234},
            {"name": "Backend Developer",    "percent": 76, "similarity": 0.6891},
            ...
        ],
        "best_match_role":  "Full Stack Developer",
        "best_similarity":  0.7234,
        "extracted_text_preview": "Arjun Sharma Software Engineer...",
        "method": "TF-IDF Cosine Similarity + NLP Skill Extraction"
    }
    """

    # ── 1. Validate file type ──────────────────────────────────────
    allowed = {
        "application/pdf":  ".pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ".docx",
        "text/plain": ".txt",
    }
    filename = file.filename or "resume"
    ext      = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""

    if ext not in ("pdf", "docx", "txt"):
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type: .{ext}. Please upload PDF, DOCX, or TXT."
        )

    # ── 2. Read file bytes ─────────────────────────────────────────
    file_bytes = await file.read()

    if len(file_bytes) == 0:
        raise HTTPException(status_code=400, detail="Uploaded file is empty.")

    if len(file_bytes) > MAX_FILE_SIZE:
        raise HTTPException(
            status_code=413,
            detail=f"File too large ({len(file_bytes)//1024}KB). Maximum is 5MB."
        )

    # ── 3. Extract text from file ─────────────────────────────────
    try:
        raw_text = extract_text(file_bytes, filename)
    except ImportError as e:
        raise HTTPException(
            status_code=503,
            detail=f"Missing library: {str(e)}"
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Text extraction failed: {str(e)}"
        )

    if not raw_text or len(raw_text.strip()) < 30:
        raise HTTPException(
            status_code=422,
            detail="Could not extract readable text from this resume. Try a different file or ensure the PDF is not scanned/image-based."
        )

    # ── 4–7. NLP Analysis + Scoring ───────────────────────────────
    try:
        analysis = score_resume_from_text(raw_text, exp=exp)
    except Exception as e:
        raise HTTPException(
            status_code=500,
            detail=f"Analysis failed: {str(e)}"
        )

    # ── 8. Return full response ────────────────────────────────────
    return JSONResponse({
        "success":      True,
        "filename":     filename,
        "candidate":    name or "Unknown",
        "method":       "TF-IDF Cosine Similarity + NLP Skill Extraction",
        "libraries_used": {
            "text_extraction": "pypdf" if ext == "pdf" else "python-docx",
            "skill_extraction": "Regex keyword matching (200+ skill dictionary)",
            "similarity":       "scikit-learn TF-IDF + cosine_similarity" if HAS_SKLEARN else "keyword overlap fallback",
        },

        # ── Core scores ──────────────────────────────
        "resume_score":  analysis["resume_score"],
        "word_count":    analysis["word_count"],
        "skill_count":   analysis["skill_count"],

        # ── Skills extracted from actual resume ──────
        "skills_found":       analysis["skills_found"],
        "skills_by_category": analysis["skills_by_category"],

        # ── Role fit via TF-IDF cosine similarity ────
        "role_fit":          analysis["role_fit"],
        "best_match_role":   analysis["best_match_role"],
        "best_similarity":   analysis["best_similarity"],

        # ── Score breakdown ──────────────────────────
        "score_breakdown":   analysis.get("score_breakdown", {}),

        # ── Extracted text preview ───────────────────
        "extracted_text_preview": analysis.get("extracted_text_preview", ""),
    })


@router.post("/extract-only")
async def extract_text_only(
    file: UploadFile = File(...),
):
    """
    Just extract and return raw text from uploaded resume.
    Useful for debugging or previewing what was extracted.
    """
    filename   = file.filename or "resume"
    file_bytes = await file.read()

    try:
        raw_text = extract_text(file_bytes, filename)
        cleaned  = clean_text(raw_text)
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

    return {
        "filename":     filename,
        "raw_length":   len(raw_text),
        "clean_length": len(cleaned),
        "raw_preview":  raw_text[:500],
        "clean_text":   cleaned[:500],
        "word_count":   len(cleaned.split()),
    }
