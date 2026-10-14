"""
TalentLens — Applicants Router
POST   /api/applicants/apply            - submit application
GET    /api/applicants/{company_id}     - list by company
PATCH  /api/applicants/{id}/status      - update status
PATCH  /api/applicants/{id}/ai-record   - save AI record
DELETE /api/applicants/{company_id}/clear - clear all for company
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from datetime import datetime

from database import get_db, Applicant, Company
from schemas import ApplicantCreate, ApplicantOut, StatusUpdate, AiRecordUpdate, Scores
from scoring import score_profile

router = APIRouter()


def _ap_to_out(ap: Applicant) -> dict:
    return {
        "id":           ap.id,
        "company_id":   ap.company_id,
        "name":         ap.name,
        "email":        ap.email,
        "phone":        ap.phone,
        "experience":   ap.experience,
        "skills":       ap.skills,
        "linkedin_url": ap.linkedin_url,
        "github_url":   ap.github_url,
        "cover":        ap.cover,
        "scores": {
            "resume":   ap.resume_score,
            "linkedin": ap.linkedin_score,
            "github":   ap.github_score,
        },
        "overall":    ap.overall_score,
        "status":     ap.status,
        "ai_record":  ap.ai_record,
        "applied_at": ap.applied_at.isoformat() if ap.applied_at else None,
        # aliases for frontend compatibility
        "li": ap.linkedin_url,
        "gh": ap.github_url,
    }


@router.post("/apply")
async def apply(payload: ApplicantCreate, db: Session = Depends(get_db)):
    """Submit a new application — scores it automatically."""
    co = db.query(Company).filter(Company.id == payload.company_id).first()
    if not co:
        raise HTTPException(status_code=404, detail="Company not found")

    if co.filled >= co.vacancies:
        raise HTTPException(status_code=400, detail="No seats remaining for this company")

    # Duplicate check
    existing = db.query(Applicant).filter(
        Applicant.company_id == payload.company_id,
        Applicant.email == payload.email
    ).first()
    if existing:
        raise HTTPException(status_code=409, detail="You have already applied to this company")

    li = payload.linkedin if hasattr(payload, 'linkedin') else getattr(payload, 'linkedin_url', '')
    gh = payload.github   if hasattr(payload, 'github')   else getattr(payload, 'github_url', '')

    # Use pre-computed scores from frontend if provided (NLP + real GitHub + LinkedIn modal)
    # Only fall back to backend heuristic if scores were NOT sent
    has_scores = (
        hasattr(payload, 'resume_score')  and payload.resume_score  is not None and
        hasattr(payload, 'overall_score') and payload.overall_score is not None
    )

    if has_scores:
        # Frontend already ran: NLP resume parser + real GitHub API + LinkedIn modal
        # Store exactly those scores — do NOT re-score
        r_score  = payload.resume_score
        li_score = payload.linkedin_score if hasattr(payload, 'linkedin_score') and payload.linkedin_score is not None else 0
        gh_score = payload.github_score   if hasattr(payload, 'github_score')   and payload.github_score   is not None else 0
        ov_score = payload.overall_score
    else:
        # Fallback: backend heuristic scoring (when called without pre-computed scores)
        result   = await score_profile(
            name=payload.name, exp=payload.experience, skills=payload.skills,
            li=li or "", gh=gh or "", summary=payload.cover,
        )
        r_score  = result.scores.resume
        li_score = result.scores.linkedin
        gh_score = result.scores.github
        ov_score = result.overall

    ap = Applicant(
        company_id    = payload.company_id,
        name          = payload.name,
        email         = payload.email,
        phone         = payload.phone,
        experience    = payload.experience,
        skills        = payload.skills,
        linkedin_url  = li or "",
        github_url    = gh or "",
        cover         = payload.cover,
        resume_score  = r_score,
        linkedin_score= li_score,
        github_score  = gh_score,
        overall_score = ov_score,
        status        = "new",
    )
    db.add(ap)
    co.filled += 1
    db.commit()
    db.refresh(ap)

    return {"applicant": _ap_to_out(ap), "message": "Application submitted successfully"}


@router.get("/{company_id}")
def list_applicants(company_id: str, db: Session = Depends(get_db)):
    """List all applicants for a company."""
    aps = db.query(Applicant).filter(Applicant.company_id == company_id)\
            .order_by(Applicant.overall_score.desc()).all()
    return {"applicants": [_ap_to_out(a) for a in aps], "count": len(aps)}


@router.patch("/{applicant_id}/status")
def update_status(applicant_id: int, payload: StatusUpdate, db: Session = Depends(get_db)):
    """Recruiter updates candidate status (shortlisted / rejected / etc.)."""
    ap = db.query(Applicant).filter(Applicant.id == applicant_id).first()
    if not ap:
        raise HTTPException(status_code=404, detail="Applicant not found")
    valid = {"new", "reviewed", "shortlisted", "rejected"}
    if payload.status not in valid:
        raise HTTPException(status_code=400, detail=f"Status must be one of {valid}")
    ap.status     = payload.status
    ap.updated_at = datetime.utcnow()
    db.commit()
    return {"id": ap.id, "status": ap.status}


@router.patch("/{applicant_id}/ai-record")
def save_ai_record(applicant_id: int, payload: AiRecordUpdate, db: Session = Depends(get_db)):
    """Save a generated AI record summary to the database."""
    ap = db.query(Applicant).filter(Applicant.id == applicant_id).first()
    if not ap:
        raise HTTPException(status_code=404, detail="Applicant not found")
    ap.ai_record  = payload.ai_record
    ap.updated_at = datetime.utcnow()
    db.commit()
    return {"id": ap.id, "ai_record": ap.ai_record}


@router.delete("/{company_id}/clear")
def clear_applicants(company_id: str, db: Session = Depends(get_db)):
    """Delete all applicants for a company and reset filled count."""
    deleted = db.query(Applicant).filter(Applicant.company_id == company_id).delete()
    co = db.query(Company).filter(Company.id == company_id).first()
    if co:
        co.filled = 0
    db.commit()
    return {"deleted": deleted, "company_id": company_id}
