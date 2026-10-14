"""
TalentLens — Analyzer Router
POST /api/analyzer/score        - score a profile
POST /api/analyzer/ai-record    - generate AI record text
"""

from fastapi import APIRouter
from schemas import AnalyzeRequest, AnalysisResult
from scoring import score_profile, generate_ai_record
from pydantic import BaseModel

router = APIRouter()


@router.post("/score", response_model=AnalysisResult)
async def analyze_score(payload: AnalyzeRequest):
    """Score a candidate profile. Returns scores, role fit, suggestions."""
    result = await score_profile(
        name    = payload.name,
        exp     = int(payload.exp or 0),
        skills  = payload.skills,
        li      = payload.li,
        gh      = payload.gh,
        summary = payload.summary,
    )
    return result


class AIRecordRequest(BaseModel):
    name:          str
    experience:    int
    skills:        str = ""
    linkedin_url:  str = ""
    github_url:    str = ""
    cover:         str = ""
    resume_score:  float = 0
    linkedin_score:float = 0
    github_score:  float = 0
    overall:       float = 0


@router.post("/ai-record")
async def get_ai_record(payload: AIRecordRequest):
    """Generate an AI summary record for a candidate."""
    record = await generate_ai_record(
        name          = payload.name,
        experience    = payload.experience,
        skills        = payload.skills,
        li            = payload.linkedin_url,
        gh            = payload.github_url,
        cover         = payload.cover,
        resume_score  = payload.resume_score,
        linkedin_score= payload.linkedin_score,
        github_score  = payload.github_score,
        overall       = payload.overall,
    )
    return {"record": record}
