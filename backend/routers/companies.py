"""
TalentLens — Companies Router
GET /api/companies        - list all
GET /api/companies/{id}   - single company
"""

import json
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from database import get_db, Company
from schemas import CompanyOut

router = APIRouter()


def _company_to_out(c: Company) -> CompanyOut:
    remain = max(0, c.vacancies - c.filled)
    roles_list = [r.strip() for r in (c.roles or "").split(",") if r.strip()]
    return CompanyOut(
        id=c.id, name=c.name, emoji=c.emoji, sector=c.sector,
        type=c.type, vacancies=c.vacancies, filled=c.filled,
        c1=c.c1, c2=c.c2, roles=c.roles, location=c.location,
        package=c.package, desc=c.desc,
        remain=remain, roles_list=roles_list,
    )


@router.get("/", response_model=list[CompanyOut])
def list_companies(db: Session = Depends(get_db)):
    return [_company_to_out(c) for c in db.query(Company).all()]


@router.get("/{company_id}", response_model=CompanyOut)
def get_company(company_id: str, db: Session = Depends(get_db)):
    co = db.query(Company).filter(Company.id == company_id).first()
    if not co:
        raise HTTPException(status_code=404, detail=f"Company '{company_id}' not found")
    return _company_to_out(co)
