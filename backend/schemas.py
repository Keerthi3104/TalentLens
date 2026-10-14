"""
TalentLens — Pydantic Schemas
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime


# ── Company Schemas ──────────────────────────────────

class CompanyBase(BaseModel):
    id:        str
    name:      str
    emoji:     str = "🏢"
    sector:    str = "IT"
    type:      str = "service"
    vacancies: int = 10
    filled:    int = 0
    c1:        str = "#6366f1"
    c2:        str = "#3b82f6"
    roles:     str = ""
    location:  str = "India"
    package:   str = "4–15 LPA"
    desc:      str = ""

class CompanyOut(CompanyBase):
    remain:    int = 0
    roles_list: List[str] = []

    class Config:
        from_attributes = True


# ── Score Schemas ────────────────────────────────────

class Scores(BaseModel):
    resume:   float
    linkedin: float
    github:   float

class RoleFit(BaseModel):
    name:    str
    percent: float

class AnalysisResult(BaseModel):
    scores:      Scores
    roleFit:     List[RoleFit]
    suggestions: List[str]
    overall:     float


# ── Applicant Schemas ────────────────────────────────

class ApplicantCreate(BaseModel):
    company_id:  str
    name:        str
    email:       str
    phone:       str = ""
    experience:  int = 0
    skills:      str = ""
    linkedin:    str = Field("", alias="linkedin_url")
    github:      str = Field("", alias="github_url")
    cover:       str = ""
    # Optional pre-computed scores from frontend NLP pipeline
    # If provided, backend stores them as-is (no re-scoring)
    resume_score:   Optional[float] = None
    linkedin_score: Optional[float] = None
    github_score:   Optional[float] = None
    overall_score:  Optional[float] = None

    class Config:
        populate_by_name = True

class ApplicantOut(BaseModel):
    id:             int
    company_id:     str
    name:           str
    email:          str
    phone:          str
    experience:     int
    skills:         str
    linkedin_url:   str
    github_url:     str
    cover:          str
    scores:         Scores
    overall:        float
    status:         str
    ai_record:      str
    applied_at:     datetime

    class Config:
        from_attributes = True

class StatusUpdate(BaseModel):
    status: str  # new / reviewed / shortlisted / rejected

class AiRecordUpdate(BaseModel):
    ai_record: str


# ── Analyzer Schemas ─────────────────────────────────

class AnalyzeRequest(BaseModel):
    name:    str
    email:   str
    phone:   str = ""
    exp:     str = "0"
    li:      str = ""
    gh:      str = ""
    skills:  str = ""
    summary: str = ""
