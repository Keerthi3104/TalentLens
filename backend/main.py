"""
TalentLens — FastAPI Backend
Run:  uvicorn main:app --reload --port 8000
"""

from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uvicorn

from database import init_db
from routers import companies, applicants, analyzer
from routers import resume as resume_router
from routers import linkedin_oauth

# Load .env file
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv optional — can set env vars manually

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield

app = FastAPI(
    title="TalentLens API",
    description="AI-Powered Career Intelligence Platform",
    version="2.0.0",
    lifespan=lifespan
)

# ── CORS — allow React frontend ─────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ─────────────────────────────────────────
app.include_router(companies.router,       prefix="/api/companies",  tags=["Companies"])
app.include_router(applicants.router,      prefix="/api/applicants", tags=["Applicants"])
app.include_router(analyzer.router,        prefix="/api/analyzer",   tags=["Analyzer"])
app.include_router(resume_router.router,   prefix="/api/resume",     tags=["Resume Parser"])
app.include_router(linkedin_oauth.router,  prefix="/api/linkedin",   tags=["LinkedIn OAuth"])

@app.get("/api/health")
async def health():
    return {"status": "online", "service": "TalentLens API v2.0"}

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
