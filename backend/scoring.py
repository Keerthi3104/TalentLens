"""
TalentLens — Scoring Service
Handles AI scoring via Anthropic API + heuristic fallback.
"""

import os
import json
import random
import httpx
from typing import Optional
from schemas import AnalysisResult, Scores, RoleFit


ANTHROPIC_API_KEY = os.getenv("ANTHROPIC_API_KEY", "")
CLAUDE_MODEL      = "claude-sonnet-4-20250514"


async def score_profile(
    name:    str,
    exp:     int,
    skills:  str,
    li:      str,
    gh:      str,
    summary: str,
) -> AnalysisResult:
    """
    Try Claude API first, fall back to heuristic scoring.
    Returns AnalysisResult with scores, roleFit, suggestions and overall.
    """
    if ANTHROPIC_API_KEY:
        try:
            return await _ai_score(name, exp, skills, li, gh, summary)
        except Exception as e:
            print(f"[Scoring] AI failed ({e}), using heuristic")

    return _heuristic_score(exp, skills, li, gh, summary)


async def _ai_score(name, exp, skills, li, gh, summary) -> AnalysisResult:
    prompt = f"""You are an expert career coach. Analyze this candidate profile and return ONLY valid JSON (no markdown, no explanation).

Profile:
- Name: {name}
- Experience: {exp} years {"(Fresher)" if exp == 0 else ""}
- Skills: {skills or "not provided"}
- LinkedIn: {"provided" if li else "not provided"}
- GitHub: {"provided" if gh else "not provided"}
- Summary: {summary or "not provided"}

Return exactly this JSON structure:
{{
  "scores": {{ "resume": <0-100>, "linkedin": <0-100>, "github": <0-100> }},
  "roleFit": [
    {{"name":"Business Analyst","percent":<0-100>}},
    {{"name":"Backend Developer","percent":<0-100>}},
    {{"name":"Frontend Developer","percent":<0-100>}},
    {{"name":"Full Stack Developer","percent":<0-100>}},
    {{"name":"QA / Tester","percent":<0-100>}},
    {{"name":"DevOps Engineer","percent":<0-100>}},
    {{"name":"Data Engineer","percent":<0-100>}}
  ],
  "suggestions": ["<tip1>","<tip2>","<tip3>","<tip4>","<tip5>"]
}}"""

    async with httpx.AsyncClient(timeout=30) as client:
        res = await client.post(
            "https://api.anthropic.com/v1/messages",
            headers={
                "x-api-key":         ANTHROPIC_API_KEY,
                "anthropic-version": "2023-06-01",
                "content-type":      "application/json",
            },
            json={
                "model":      CLAUDE_MODEL,
                "max_tokens": 1000,
                "messages":   [{"role": "user", "content": prompt}]
            }
        )
        res.raise_for_status()
        text = res.json()["content"][0]["text"]
        text = text.replace("```json", "").replace("```", "").strip()
        data = json.loads(text)

    sc      = data["scores"]
    overall = round((sc["resume"] + sc["linkedin"] + sc["github"]) / 3)

    return AnalysisResult(
        scores      = Scores(**sc),
        roleFit     = [RoleFit(**r) for r in data["roleFit"]],
        suggestions = data["suggestions"],
        overall     = overall,
    )


def _heuristic_score(exp: int, skills: str, li: str, gh: str, summary: str) -> AnalysisResult:
    is_fresher = exp == 0
    sc_count   = len([s for s in skills.split(",") if s.strip()])

    rs = min(95, 45 + exp * 4 + sc_count * 2 + (5 if summary else 0) + (5 if is_fresher else 0))
    # Strict: 0 if no URL provided — never give phantom scores
    li_score = min(90, 58 + random.randint(0, 18)) if (li and li.strip()) else 0
    gh_score = min(93, 60 + random.randint(0, 20)) if (gh and gh.strip()) else 0
    li_w = 0.30 if li_score > 0 else 0
    gh_w = 0.30 if gh_score > 0 else 0
    rs_w = 1 - li_w - gh_w
    overall  = round(rs * rs_w + li_score * li_w + gh_score * gh_w)

    role_fit = [
        RoleFit(name="Business Analyst",    percent=min(85, rs - 8)),
        RoleFit(name="Backend Developer",   percent=min(90, gh_score + 12)),
        RoleFit(name="Frontend Developer",  percent=min(88, gh_score + 8)),
        RoleFit(name="Full Stack Developer",percent=min(85, (rs + gh_score) // 2)),
        RoleFit(name="QA / Tester",         percent=min(78, rs - 18)),
        RoleFit(name="DevOps Engineer",     percent=min(72, gh_score - 5)),
        RoleFit(name="Data Engineer",       percent=min(70, rs - 15)),
    ]

    if is_fresher:
        exp_tip = "🌱 As a fresher, highlight academic projects, internships, hackathons and certifications prominently — these carry great weight for recruiters evaluating entry-level candidates."
    elif exp < 3:
        exp_tip = "Supplement experience with open-source contributions, hackathons, or freelance projects."
    else:
        exp_tip = "Restructure experience bullets using the STAR format: Situation → Task → Action → Result."

    suggestions = [
        "Add 3–5 quantified achievements to your LinkedIn experience." if li else "⚠ LinkedIn URL missing — a complete profile increases recruiter visibility by 3×.",
        "Pin your top repositories and write descriptive READMEs." if gh else "⚠ GitHub URL missing — add public projects to prove coding ability.",
        "Great skill breadth! Group them by category (Languages, Frameworks, Cloud)." if sc_count >= 6 else "Expand skills list to 8–12 entries covering languages, frameworks, tools and cloud platforms.",
        exp_tip,
        "Ensure your resume passes ATS: use standard headings, avoid columns/tables, and save as PDF.",
    ]

    return AnalysisResult(
        scores      = Scores(resume=rs, linkedin=li_score, github=gh_score),
        roleFit     = role_fit,
        suggestions = suggestions,
        overall     = overall,
    )


async def generate_ai_record(
    name: str, experience: int, skills: str,
    li: str, gh: str, cover: str,
    resume_score: float, linkedin_score: float,
    github_score: float, overall: float,
) -> str:
    """Generate a short AI recruiter summary. Returns plain text string."""
    if not ANTHROPIC_API_KEY:
        return _heuristic_record(experience, skills, overall)

    prompt = f"""You are a professional HR analyst. Write a concise 2-sentence candidate record summary for a recruiter.

Candidate:
- Name: {name}
- Experience: {experience} years {"(Fresher)" if experience == 0 else ""}
- Skills: {skills or "Not specified"}
- LinkedIn: {"Available" if li else "Not provided"}
- GitHub: {"Available" if gh else "Not provided"}
- Cover note: {cover or "Not provided"}
- Scores: Resume {resume_score}%, LinkedIn {linkedin_score}%, GitHub {github_score}%, Overall {overall}%

Write a factual, professional 2-sentence summary (max 60 words) highlighting strengths and suitability. Be specific and data-driven. No fluff."""

    try:
        async with httpx.AsyncClient(timeout=20) as client:
            res = await client.post(
                "https://api.anthropic.com/v1/messages",
                headers={
                    "x-api-key":         ANTHROPIC_API_KEY,
                    "anthropic-version": "2023-06-01",
                    "content-type":      "application/json",
                },
                json={
                    "model":      CLAUDE_MODEL,
                    "max_tokens": 200,
                    "messages":   [{"role": "user", "content": prompt}]
                }
            )
            res.raise_for_status()
            return res.json()["content"][0]["text"].strip()
    except Exception:
        return _heuristic_record(experience, skills, overall)


def _heuristic_record(experience: int, skills: str, overall: float) -> str:
    level     = "Fresher" if experience == 0 else "Senior" if experience >= 5 else "Mid-level" if experience >= 3 else "Junior"
    exp_label = "as a fresher" if experience == 0 else f"with {experience} year{'s' if experience != 1 else ''} of experience"
    top_skills = ", ".join(s.strip() for s in skills.split(",")[:3] if s.strip()) or "various technologies"
    strength  = "strong across all dimensions" if overall >= 80 else "solid technical foundation" if overall >= 65 else "growing skill profile"

    return (
        f"{level} professional {exp_label}, skilled in {top_skills}. "
        f"Demonstrates a {strength} with an overall score of {overall:.0f}%, "
        f"making them a {'strong' if overall >= 75 else 'potential'} candidate for consideration."
    )
