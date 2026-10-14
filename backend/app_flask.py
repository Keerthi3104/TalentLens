"""
TalentLens — Flask Backend
==========================
Run:  python app_flask.py
      (runs on http://127.0.0.1:8000)

Routes:
  GET  /api/health              -> health check
  POST /api/resume/analyze      -> upload PDF/DOCX, get NLP scores
  GET  /api/resume/status       -> check which libraries are loaded
  POST /api/resume/extract-only -> just return extracted text (debug)
"""

import os
import sys
import json
import traceback
from flask import Flask, request, jsonify


# Add backend dir to path so resume_parser imports work
sys.path.insert(0, os.path.dirname(__file__))

from resume_parser import (
    extract_text,
    clean_text,
    extract_skills,
    score_resume_from_text,
    HAS_PDF,
    HAS_DOCX,
    HAS_SKLEARN,
)

app = Flask(__name__)


# Manual CORS headers — no flask-cors dependency needed
@app.after_request
def add_cors_headers(response):
    response.headers["Access-Control-Allow-Origin"]  = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

@app.before_request
def handle_options():
    from flask import request as req
    if req.method == "OPTIONS":
        from flask import Response
        r = Response()
        r.headers["Access-Control-Allow-Origin"]  = "*"
        r.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, PATCH, DELETE, OPTIONS"
        r.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return r



MAX_FILE_SIZE = 5 * 1024 * 1024   # 5 MB


# =============================================================================
# HEALTH CHECK
# =============================================================================

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({"status": "online", "service": "TalentLens Flask API"})


# =============================================================================
# LIBRARY STATUS
# =============================================================================

@app.route("/api/resume/status", methods=["GET"])
def resume_status():
    all_ok = HAS_PDF and HAS_DOCX and HAS_SKLEARN
    return jsonify({
        "pypdf":        HAS_PDF,
        "python_docx":  HAS_DOCX,
        "scikit_learn": HAS_SKLEARN,
        "all_ready":    all_ok,
        "message": "All NLP libraries ready" if all_ok
                   else "Missing libraries — check requirements.txt",
    })


# =============================================================================
# MAIN RESUME ANALYSIS ENDPOINT
# =============================================================================

@app.route("/api/resume/analyze", methods=["POST"])
def analyze_resume():
    """
    Full NLP pipeline:
      1. Validate file (PDF / DOCX / TXT, max 5MB)
      2. Extract raw text  (pypdf / python-docx)
      3. Clean text        (lowercase, remove stopwords & punctuation)
      4. Extract skills    (200+ keyword matching)
      5. TF-IDF similarity (vs 7 job description templates)
      6. Score formula     (skills + length + TF-IDF + exp + diversity)
      7. Return JSON
    """

    # ── 1. Validate file presence ────────────────────────────────
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded. Send file in multipart/form-data with key 'file'."}), 400

    file     = request.files["file"]
    filename = file.filename or ""

    if not filename:
        return jsonify({"error": "File has no name."}), 400

    ext = filename.lower().rsplit(".", 1)[-1] if "." in filename else ""
    if ext not in ("pdf", "docx", "doc", "txt"):
        return jsonify({"error": f"Unsupported file type '.{ext}'. Upload PDF, DOCX, or TXT."}), 400

    # ── 2. Read file bytes + size check ─────────────────────────
    file_bytes = file.read()

    if len(file_bytes) == 0:
        return jsonify({"error": "Uploaded file is empty."}), 400

    if len(file_bytes) > MAX_FILE_SIZE:
        size_kb = len(file_bytes) // 1024
        return jsonify({"error": f"File too large ({size_kb} KB). Max allowed: 5 MB."}), 413

    # ── 3. Get optional form fields ──────────────────────────────
    try:
        exp = int(request.form.get("exp", 0))
    except (ValueError, TypeError):
        exp = 0
    name = request.form.get("name", "").strip()

    # ── 4. Extract raw text from file ───────────────────────────
    try:
        raw_text = extract_text(file_bytes, filename)
    except ImportError as e:
        return jsonify({"error": f"Missing library: {e}"}), 503
    except ValueError as e:
        return jsonify({"error": str(e)}), 400
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Text extraction failed: {e}"}), 500

    if not raw_text or len(raw_text.strip()) < 30:
        return jsonify({
            "error": (
                "Could not extract readable text from this file. "
                "If it is a scanned PDF (image-based), text extraction is not supported. "
                "Try a text-based PDF or a DOCX file."
            )
        }), 422

    # ── 5–7. NLP pipeline + scoring ─────────────────────────────
    try:
        analysis = score_resume_from_text(raw_text, exp=exp)
    except Exception as e:
        traceback.print_exc()
        return jsonify({"error": f"Analysis pipeline failed: {e}"}), 500

    # ── 8. Return full JSON response ─────────────────────────────
    return jsonify({
        "success":   True,
        "filename":  filename,
        "candidate": name or "Unknown",

        # Which libraries were used
        "method": "pypdf/python-docx + sklearn TF-IDF cosine similarity",
        "libraries": {
            "text_extraction": "pypdf" if ext == "pdf" else "python-docx",
            "skill_extraction": "regex keyword matching (200+ skills)",
            "similarity": "scikit-learn TF-IDF + cosine_similarity" if HAS_SKLEARN else "keyword overlap fallback",
        },

        # Core scores
        "resume_score": analysis["resume_score"],
        "word_count":   analysis["word_count"],
        "skill_count":  analysis["skill_count"],

        # Score breakdown (pts per factor)
        "score_breakdown": analysis["score_breakdown"],

        # Skills extracted from actual resume text
        "skills_found":       analysis["skills_found"],
        "skills_by_category": analysis["skills_by_category"],

        # Role fit via TF-IDF cosine similarity
        "role_fit":        analysis["role_fit"],
        "best_match_role": analysis["best_match_role"],
        "best_similarity": analysis["best_similarity"],

        # Preview of extracted text (first 400 chars)
        "extracted_text_preview": analysis.get("extracted_text_preview", ""),
    })


# =============================================================================
# DEBUG — EXTRACT TEXT ONLY (no scoring)
# =============================================================================

@app.route("/api/resume/extract-only", methods=["POST"])
def extract_only():
    """Return only the extracted + cleaned text. Useful for debugging."""
    if "file" not in request.files:
        return jsonify({"error": "No file uploaded."}), 400

    file       = request.files["file"]
    filename   = file.filename or "resume"
    file_bytes = file.read()

    try:
        raw_text = extract_text(file_bytes, filename)
        cleaned  = clean_text(raw_text)
        skills   = extract_skills(raw_text)
    except Exception as e:
        return jsonify({"error": str(e)}), 400

    return jsonify({
        "filename":     filename,
        "raw_length":   len(raw_text),
        "clean_length": len(cleaned),
        "word_count":   len(cleaned.split()),
        "raw_preview":  raw_text[:500],
        "clean_preview": cleaned[:500],
        "skills_found": skills["all_skills"],
        "skill_count":  skills["total_count"],
    })


# =============================================================================
# STUB ROUTES — keep React frontend working (recruiter/applicant features)
# =============================================================================

@app.route("/api/companies", methods=["GET"])
def get_companies():
    return jsonify([])

@app.route("/api/applicants/<company_id>", methods=["GET"])
def get_applicants(company_id):
    return jsonify([])

@app.route("/api/applicants/apply", methods=["POST"])
def apply():
    return jsonify({"success": True, "message": "Application received"})

@app.route("/api/analyzer/score", methods=["POST"])
def analyzer_score():
    return jsonify({"overall": 50, "scores": {"resume": 50, "linkedin": 0, "github": 0}})


# =============================================================================
# ENTRY POINT
# =============================================================================

if __name__ == "__main__":
    print("\n" + "="*55)
    print("  TalentLens Backend — Flask NLP Server")
    print("="*55)
    print(f"  pypdf        : {'OK' if HAS_PDF     else 'MISSING (pip install pypdf)'}")
    print(f"  python-docx  : {'OK' if HAS_DOCX    else 'MISSING (pip install python-docx)'}")
    print(f"  scikit-learn : {'OK' if HAS_SKLEARN else 'MISSING (pip install scikit-learn)'}")
    print("="*55)
    print("  Server: http://127.0.0.1:8000")
    print("  Resume API: POST http://127.0.0.1:8000/api/resume/analyze")
    print("="*55 + "\n")
    app.run(host="0.0.0.0", port=8000, debug=True)
