# 🎯 TalentLens — React + FastAPI + SQLite

## ▶️ Quick Start (2 terminals)

### Terminal 1 — Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Test: http://127.0.0.1:8000/api/health → should return `{"status":"online",...}`

### Terminal 2 — Frontend
```bash
cd frontend
npm install
npm start
```
Opens at: http://localhost:3000

---

## ✅ How Application → Recruiter Dashboard Works

**When backend is ONLINE (green indicator):**
1. Fill apply form → Submit
2. FastAPI scores it → saves to SQLite database
3. Go to Recruiter → switch to that company tab → see the new applicant

**When backend is OFFLINE (red indicator, local mode):**
1. Fill apply form → Submit  
2. Scores computed in browser → stored in React shared state (App.js)
3. Go to Recruiter → applicant appears **immediately** — no refresh needed

---

## 📁 Key Files

```
backend/
  main.py              ← FastAPI entry point (port 8000)
  database.py          ← SQLAlchemy models + SQLite init
  routers/
    applicants.py      ← POST /apply, GET /{company_id}, PATCH /{id}/status
    analyzer.py        ← POST /analyzer/score
  schemas.py           ← Pydantic models
  scoring.py           ← Score computation

frontend/src/
  App.js               ← ✅ Shared applicants state — connects JobPage ↔ RecruiterPage
  api/talentlens.js    ← All fetch() calls (port 8000)
  pages/
    JobPage.jsx        ← ✅ Calls onApplicationSubmit() after apply → updates shared state
    RecruiterPage.jsx  ← ✅ Reads from shared state — sees new applicants instantly
    AnalyzerPage.jsx
    CareersPage.jsx
  components/
    Navbar.jsx, Footer.jsx, EmailModal.jsx
  hooks/
    useBackend.js      ← Health check at :8000
    useToast.js
  data/companies.js
```

---

## 🐞 Root Cause of the Bug (Fixed)

Previously `JobPage` and `RecruiterPage` had **completely separate isolated state**.
After submit, `JobPage` showed success but didn't share the data anywhere.
`RecruiterPage` read from its own local copy and never saw the new application.

**Fix:** Lifted `applicants` state up to `App.js`. Now:
- `JobPage` receives `onApplicationSubmit(companyId, newApplicant)` → writes to shared state
- `RecruiterPage` receives `applicants` + `setApplicants` → reads from shared state
- New application appears in Recruiter **instantly** without any refresh

---

## 📡 API Endpoints

| Method | URL | Description |
|--------|-----|-------------|
| GET  | `/api/health` | Health check |
| POST | `/api/applicants/apply` | Submit application + score |
| GET  | `/api/applicants/{company_id}` | Get company applicants |
| PATCH | `/api/applicants/{id}/status` | Update status (shortlisted/rejected) |
| DELETE | `/api/applicants/{company_id}/clear` | Clear all for company |
| POST | `/api/analyzer/score` | Score a profile (Analyzer page) |

---

Made with ♥ by Sivasakthi K, Janani C, Keerthika K, Keerthika R — Annamalai University
