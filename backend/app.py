"""
TalentLens — FastAPI Backend
Run: uvicorn app:app --reload --port 5000
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
import sqlite3, json, math, random, os
from datetime import date

app = FastAPI(title="TalentLens API", version="1.0.0")

# ── CORS (allow React dev server)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ══════════════════════════════════════════
#  DATABASE SETUP
# ══════════════════════════════════════════
DB_PATH = "talentlens.db"

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    conn.executescript("""
        CREATE TABLE IF NOT EXISTS applicants (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            company_id  TEXT    NOT NULL,
            name        TEXT    NOT NULL,
            email       TEXT    NOT NULL,
            phone       TEXT,
            experience  INTEGER DEFAULT 0,
            skills      TEXT,
            linkedin    TEXT,
            github      TEXT,
            cover       TEXT,
            resume_score    INTEGER DEFAULT 0,
            linkedin_score  INTEGER DEFAULT 0,
            github_score    INTEGER DEFAULT 0,
            overall_score   INTEGER DEFAULT 0,
            status      TEXT    DEFAULT 'new',
            applied     TEXT    DEFAULT CURRENT_DATE,
            UNIQUE(company_id, email)
        );

        CREATE TABLE IF NOT EXISTS analysis_cache (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            email       TEXT NOT NULL,
            result_json TEXT NOT NULL,
            created_at  TEXT DEFAULT CURRENT_TIMESTAMP
        );
    """)
    conn.commit()

    # Seed demo data if table is empty
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*) FROM applicants")
    if cur.fetchone()[0] == 0:
        seed_data = [
            ("tcs", "Priya Venkat",  "priya@mail.com",   "9876543210", 4,  "React, Node.js, AWS",         "https://linkedin.com/in/priyavenkat", "https://github.com/priyav",   "Passionate full-stack developer.",      88, 82, 91, 87, "shortlisted"),
            ("tcs", "Karthik Rajan", "karthik@mail.com", "9876543211", 3,  "Python, Django, PostgreSQL",  "https://linkedin.com/in/karthikrajan","https://github.com/karthikr", "Backend engineer.",                     75, 68, 80, 74, "reviewed"),
            ("tcs", "Sneha Pillai",  "sneha@mail.com",   "9876543212", 2,  "Vue.js, Laravel, MySQL",      "",                                    "https://github.com/snehap",   "Frontend developer.",                   65, 72, 60, 66, "new"),
            ("tcs", "Dev Kumar",     "dev@mail.com",     "9876543213", 5,  "Java, Spring Boot, Kafka",    "https://linkedin.com/in/devkumar",    "https://github.com/devkumar",  "Senior Java engineer.",                91, 85, 88, 88, "new"),
            ("hcl", "Ananya Rathi",  "ananya@mail.com",  "9876543214", 3,  "Angular, .NET, Azure",        "https://linkedin.com/in/ananyarathi", "",                             "Full stack developer.",                 78, 74, 70, 74, "new"),
            ("hcl", "Rahul Sharma",  "rahul@mail.com",   "9876543215", 6,  "Kubernetes, Docker, CI/CD",   "https://linkedin.com/in/rahulsharma", "https://github.com/rahuls",   "DevOps engineer.",                     85, 80, 92, 86, "new"),
        ]
        conn.executemany("""
            INSERT OR IGNORE INTO applicants
            (company_id,name,email,phone,experience,skills,linkedin,github,cover,
             resume_score,linkedin_score,github_score,overall_score,status)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, seed_data)
        conn.commit()
    conn.close()

init_db()

# ══════════════════════════════════════════
#  PYDANTIC MODELS
# ══════════════════════════════════════════
class ScoreRequest(BaseModel):
    name: str
    email: str
    phone: Optional[str] = ""
    exp: str = "0"
    li: Optional[str] = ""
    gh: Optional[str] = ""
    skills: Optional[str] = ""
    summary: Optional[str] = ""

class ApplyRequest(BaseModel):
    company_id: str
    name: str
    email: str
    phone: Optional[str] = ""
    experience: int = 0
    skills: Optional[str] = ""
    linkedin: Optional[str] = ""
    github: Optional[str] = ""
    cover: Optional[str] = ""

class StatusUpdate(BaseModel):
    status: str

# ══════════════════════════════════════════
#  SCORING LOGIC
# ══════════════════════════════════════════
def compute_scores(exp: int, skills: str, li: str, gh: str, summary: str = "") -> dict:
    is_fresher = exp == 0
    sc = len([s for s in skills.split(",") if s.strip()])
    rs = min(95, 45 + exp * 4 + sc * 2 + (5 if summary else 0) + (5 if is_fresher else 0))
    li_score = min(90, 58 + random.randint(0, 17)) if li else 18
    gh_score = min(93, 60 + random.randint(0, 19)) if gh else 15
    overall  = round((rs + li_score + gh_score) / 3)

    suggestions = []
    if li:
        suggestions.append('Add 3–5 quantified achievements to your LinkedIn experience (e.g., "Improved API latency by 40%").')
    else:
        suggestions.append("⚠ LinkedIn URL missing — a complete profile increases recruiter visibility by 3×.")
    if gh:
        suggestions.append("Pin your top repositories and write descriptive READMEs with tech stack and setup instructions.")
    else:
        suggestions.append("⚠ GitHub URL missing — add public projects to prove coding ability to recruiters.")
    if sc < 6:
        suggestions.append("Expand skills list to 8–12 entries covering languages, frameworks, tools and cloud platforms.")
    else:
        suggestions.append("Great skill breadth! Group them by category (Languages, Frameworks, Cloud, Databases) for better ATS parsing.")
    if is_fresher:
        suggestions.append("🌱 As a fresher, highlight academic projects, internships, hackathons and certifications prominently.")
    elif exp < 3:
        suggestions.append("Supplement experience with open-source contributions, hackathons, or freelance projects.")
    else:
        suggestions.append("Restructure experience bullets using the STAR format: Situation → Task → Action → Result.")
    suggestions.append("Ensure your resume passes ATS: use standard headings (Work Experience, Education, Skills), avoid columns/tables, and save as PDF.")

    role_fit = [
        {"name": "Business Analyst",    "percent": min(85, rs - 8)},
        {"name": "Backend Developer",   "percent": min(90, gh_score + 12)},
        {"name": "Frontend Developer",  "percent": min(88, gh_score + 8)},
        {"name": "Full Stack Developer","percent": min(85, (rs + gh_score) // 2)},
        {"name": "QA / Tester",         "percent": min(78, rs - 18)},
        {"name": "DevOps Engineer",     "percent": min(72, gh_score - 5)},
        {"name": "Data Engineer",       "percent": min(70, rs - 15)},
    ]

    return {
        "scores": {"resume": rs, "linkedin": li_score, "github": gh_score},
        "overall": overall,
        "roleFit": role_fit,
        "suggestions": suggestions
    }

# ══════════════════════════════════════════
#  ROUTES
# ══════════════════════════════════════════

@app.get("/api/health")
def health():
    return {"status": "ok", "message": "TalentLens FastAPI backend running 🐍"}


@app.post("/api/score")
def score_profile(req: ScoreRequest):
    """Score a candidate profile from the Analyzer page."""
    exp = int(req.exp) if req.exp != "" else 0
    result = compute_scores(exp, req.skills or "", req.li or "", req.gh or "", req.summary or "")
    return result


@app.post("/api/apply")
def apply(req: ApplyRequest):
    """Submit a job application — scores and saves to DB."""
    scores = compute_scores(req.experience, req.skills or "", req.linkedin or "", req.github or "")
    conn = get_db()
    try:
        conn.execute("""
            INSERT INTO applicants
            (company_id, name, email, phone, experience, skills, linkedin, github, cover,
             resume_score, linkedin_score, github_score, overall_score, status, applied)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        """, (
            req.company_id, req.name, req.email, req.phone, req.experience,
            req.skills, req.linkedin, req.github, req.cover,
            scores["scores"]["resume"], scores["scores"]["linkedin"],
            scores["scores"]["github"], scores["overall"],
            "new", date.today().isoformat()
        ))
        conn.commit()
    except sqlite3.IntegrityError:
        conn.close()
        raise HTTPException(status_code=409, detail="You have already applied to this company.")

    conn.close()
    return {
        "message": "Application saved successfully!",
        "applicant": {
            "scores": scores["scores"],
            "overall": scores["overall"]
        }
    }


@app.get("/api/applicants/{company_id}")
def get_applicants(company_id: str):
    """Get all applicants for a company (for Recruiter page)."""
    conn = get_db()
    rows = conn.execute("""
        SELECT * FROM applicants WHERE company_id = ?
        ORDER BY overall_score DESC
    """, (company_id,)).fetchall()
    conn.close()

    applicants = []
    for r in rows:
        applicants.append({
            "name":       r["name"],
            "email":      r["email"],
            "phone":      r["phone"] or "",
            "experience": r["experience"],
            "skills":     r["skills"] or "",
            "li":         r["linkedin"] or "",
            "gh":         r["github"] or "",
            "cover":      r["cover"] or "",
            "scores":     {"resume": r["resume_score"], "linkedin": r["linkedin_score"], "github": r["github_score"]},
            "overall":    r["overall_score"],
            "status":     r["status"],
            "applied":    r["applied"],
        })

    return {"company_id": company_id, "count": len(applicants), "applicants": applicants}


@app.patch("/api/applicants/{company_id}/{email}/status")
def update_status(company_id: str, email: str, body: StatusUpdate):
    """Update a candidate's status (shortlisted / rejected / new / reviewed)."""
    conn = get_db()
    conn.execute("""
        UPDATE applicants SET status = ? WHERE company_id = ? AND email = ?
    """, (body.status, company_id, email))
    conn.commit()
    conn.close()
    return {"message": f"Status updated to {body.status}"}


@app.delete("/api/applicants/{company_id}/clear")
def clear_applicants(company_id: str):
    """Delete all applicants for a company (Clear Page)."""
    conn = get_db()
    cur = conn.execute("DELETE FROM applicants WHERE company_id = ?", (company_id,))
    conn.commit()
    deleted = cur.rowcount
    conn.close()
    return {"message": "Cleared", "deleted": deleted}


@app.get("/api/companies")
def get_companies():
    """Return companies with live filled-seat count from DB."""
    conn = get_db()
    rows = conn.execute("""
        SELECT company_id, COUNT(*) as count FROM applicants GROUP BY company_id
    """).fetchall()
    conn.close()
    counts = {r["company_id"]: r["count"] for r in rows}
    return {"counts": counts}
