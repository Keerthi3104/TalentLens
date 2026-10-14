"""
TalentLens — SQLite Database with SQLAlchemy
"""

from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from datetime import datetime

DATABASE_URL = "sqlite:///./talentlens.db"

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False}
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── Models ───────────────────────────────────────────

class Company(Base):
    __tablename__ = "companies"

    id         = Column(String, primary_key=True, index=True)
    name       = Column(String, nullable=False)
    emoji      = Column(String, default="🏢")
    sector     = Column(String, default="IT")
    type       = Column(String, default="service")   # service / product / mnc / startup
    vacancies  = Column(Integer, default=10)
    filled     = Column(Integer, default=0)
    c1         = Column(String, default="#6366f1")
    c2         = Column(String, default="#3b82f6")
    roles      = Column(Text, default="")            # JSON string
    location   = Column(String, default="India")
    package    = Column(String, default="4–15 LPA")
    desc       = Column(Text, default="")
    created_at = Column(DateTime, default=datetime.utcnow)


class Applicant(Base):
    __tablename__ = "applicants"

    id           = Column(Integer, primary_key=True, index=True, autoincrement=True)
    company_id   = Column(String, nullable=False, index=True)
    name         = Column(String, nullable=False)
    email        = Column(String, nullable=False)
    phone        = Column(String, default="")
    experience   = Column(Integer, default=0)
    skills       = Column(Text, default="")
    linkedin_url = Column(String, default="")
    github_url   = Column(String, default="")
    cover        = Column(Text, default="")

    # AI Scores
    resume_score   = Column(Float, default=0)
    linkedin_score = Column(Float, default=0)
    github_score   = Column(Float, default=0)
    overall_score  = Column(Float, default=0)

    # Recruiter Decision
    status     = Column(String, default="new")   # new / reviewed / shortlisted / rejected
    ai_record  = Column(Text, default="")

    applied_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


# ── Seed Data ───────────────────────────────────────

SEED_COMPANIES = [
    {"id":"tcs",        "name":"TCS",             "emoji":"🔵","sector":"Services","type":"service","vacancies":20,"filled":8, "c1":"#1a73e8","c2":"#0d47a1","roles":"Backend Dev,Frontend Dev,QA Engineer,DevOps,BA",                              "location":"Pan India",                 "package":"5–18 LPA","desc":"India's largest IT company with global delivery centers."},
    {"id":"hcl",        "name":"HCL Technologies", "emoji":"🟢","sector":"Services","type":"service","vacancies":15,"filled":5, "c1":"#43a047","c2":"#1b5e20","roles":"Full Stack Dev,Cloud Engineer,Data Analyst,Java Dev",                         "location":"Noida, Chennai, Pune",      "package":"4–16 LPA","desc":"Global technology company with strong engineering focus."},
    {"id":"infosys",    "name":"Infosys",           "emoji":"🟣","sector":"Services","type":"service","vacancies":25,"filled":10,"c1":"#7c3aed","c2":"#4c1d95","roles":"React Developer,Node.js Dev,Python Dev,QA,Scrum Master",                     "location":"Bangalore, Hyderabad",      "package":"4–20 LPA","desc":"Global leader in consulting, technology & outsourcing."},
    {"id":"wipro",      "name":"Wipro",             "emoji":"🟡","sector":"Services","type":"service","vacancies":12,"filled":3, "c1":"#f59e0b","c2":"#b45309","roles":"Angular Dev,AWS Architect,DBA,Business Analyst",                             "location":"Bangalore, Mumbai",         "package":"4–15 LPA","desc":"IT, consulting and business process services company."},
    {"id":"zoho",       "name":"Zoho Corporation",  "emoji":"🔴","sector":"Product", "type":"product","vacancies":8, "filled":2, "c1":"#ef4444","c2":"#991b1b","roles":"SDE-1,SDE-2,Mobile Dev,UI/UX Engineer",                                      "location":"Chennai, Tenkasi",          "package":"6–22 LPA","desc":"Product-first company building world-class SaaS products."},
    {"id":"freshworks", "name":"Freshworks",        "emoji":"🟠","sector":"Product", "type":"product","vacancies":10,"filled":4, "c1":"#f97316","c2":"#c2410c","roles":"Frontend Engineer,Backend Engineer,Data Engineer,PM",                         "location":"Chennai, San Mateo",        "package":"8–30 LPA","desc":"Customer engagement software with global scale."},
    {"id":"ibm",        "name":"IBM India",         "emoji":"🔷","sector":"MNC",     "type":"mnc",    "vacancies":18,"filled":7, "c1":"#1d4ed8","c2":"#1e3a8a","roles":"Cloud Dev,AI Engineer,Cybersecurity,DevOps,SAP",                             "location":"Bangalore, Pune, Delhi",    "package":"6–25 LPA","desc":"Global tech leader in AI, Cloud and Quantum computing."},
    {"id":"accenture",  "name":"Accenture",         "emoji":"🟤","sector":"MNC",     "type":"mnc",    "vacancies":30,"filled":15,"c1":"#7c3aed","c2":"#9333ea","roles":"Mulesoft Dev,Salesforce Dev,Java Dev,React Dev,Analyst",                      "location":"Pan India",                 "package":"4–22 LPA","desc":"Global professional services company across industries."},
]

SEED_APPLICANTS = [
    {"company_id":"tcs","name":"Priya Venkat",  "email":"priya@mail.com",   "phone":"9876543210","experience":4,"skills":"React, Node.js, AWS",          "linkedin_url":"https://linkedin.com/in/priyavenkat","github_url":"https://github.com/priyav",   "cover":"Passionate full-stack developer with strong AWS experience.","resume_score":88,"linkedin_score":82,"github_score":91,"overall_score":87,"status":"shortlisted"},
    {"company_id":"tcs","name":"Karthik Rajan", "email":"karthik@mail.com", "phone":"9876543211","experience":3,"skills":"Python, Django, PostgreSQL",    "linkedin_url":"https://linkedin.com/in/karthikrajan","github_url":"https://github.com/karthikr","cover":"Backend engineer focused on scalable Python services.",      "resume_score":75,"linkedin_score":68,"github_score":80,"overall_score":74,"status":"reviewed"},
    {"company_id":"tcs","name":"Sneha Pillai",  "email":"sneha@mail.com",   "phone":"9876543212","experience":2,"skills":"Vue.js, Laravel, MySQL",        "linkedin_url":"",                                    "github_url":"https://github.com/snehap",   "cover":"Frontend developer with a keen eye for UI design.",         "resume_score":65,"linkedin_score":72,"github_score":60,"overall_score":66,"status":"new"},
    {"company_id":"tcs","name":"Dev Kumar",     "email":"dev@mail.com",     "phone":"9876543213","experience":5,"skills":"Java, Spring Boot, Kafka",      "linkedin_url":"https://linkedin.com/in/devkumar",    "github_url":"https://github.com/devkumar",  "cover":"Senior Java engineer with distributed systems expertise.",   "resume_score":91,"linkedin_score":85,"github_score":88,"overall_score":88,"status":"new"},
    {"company_id":"hcl","name":"Ananya Rathi",  "email":"ananya@mail.com",  "phone":"9876543214","experience":3,"skills":"Angular, .NET, Azure",          "linkedin_url":"https://linkedin.com/in/ananyarathi", "github_url":"",                            "cover":"Full stack developer with strong .NET and cloud background.","resume_score":78,"linkedin_score":74,"github_score":70,"overall_score":74,"status":"new"},
    {"company_id":"hcl","name":"Rahul Sharma",  "email":"rahul@mail.com",   "phone":"9876543215","experience":6,"skills":"Kubernetes, Docker, CI/CD",     "linkedin_url":"https://linkedin.com/in/rahulsharma", "github_url":"https://github.com/rahuls",    "cover":"DevOps engineer specializing in container orchestration.",   "resume_score":85,"linkedin_score":80,"github_score":92,"overall_score":86,"status":"new"},
]


def init_db():
    """Create tables and seed initial data."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        # Seed companies if empty
        if db.query(Company).count() == 0:
            for c in SEED_COMPANIES:
                db.add(Company(**c))
            db.commit()
            print("[DB] ✅ Companies seeded")

        # Seed applicants if empty
        if db.query(Applicant).count() == 0:
            for a in SEED_APPLICANTS:
                db.add(Applicant(**a))
            db.commit()
            print("[DB] ✅ Applicants seeded")
    finally:
        db.close()


def get_db():
    """FastAPI dependency — yields a DB session."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
