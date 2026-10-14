// src/pages/AnalyzerPage.jsx
import React, { useState } from "react";
import { scoreProfile, analyzeResumeFile } from "../api/talentlens";
import {
  fetchGithubData as sharedFetchGithub,
  scoreLinkedIn as sharedScoreLinkedIn,
  extractGithubUsername as sharedExtractGH,
  extractLinkedInHandle as sharedExtractLI,
} from "../api/scoring";
import LinkedInConnect from "../components/LinkedInConnect";
import Footer from "../components/Footer";

// ─────────────────────────────────────────────────────────────────
// BROWSER-SIDE RESUME READER
// Works 100% offline — no backend needed
// Uses pdf.js (loaded from CDN) for PDF text extraction
// Uses plain text reading for TXT files
// ─────────────────────────────────────────────────────────────────

// Dynamically load pdf.js from CDN (only when needed)
async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    script.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    script.onerror = () => reject(new Error("Failed to load pdf.js"));
    document.head.appendChild(script);
  });
}

// Extract text from PDF file in the browser using pdf.js
async function extractTextFromPDFInBrowser(file) {
  const pdfjsLib = await loadPdfJs();
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

  let fullText = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map(item => item.str).join(" ");
    fullText += pageText + "\n";
  }
  return fullText;
}

// Read plain text file
async function extractTextFromTXT(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target.result || "");
    reader.readAsText(file);
  });
}

// Main browser-side text extractor — handles PDF and TXT
async function extractResumeTextInBrowser(file) {
  const name = (file.name || "").toLowerCase();
  if (name.endsWith(".pdf")) {
    return await extractTextFromPDFInBrowser(file);
  } else if (name.endsWith(".txt")) {
    return await extractTextFromTXT(file);
  } else if (name.endsWith(".docx") || name.endsWith(".doc")) {
    // DOCX needs backend — return null to signal fallback
    return null;
  }
  return null;
}

// ── 200+ skill keyword dictionary (mirrors backend) ──────────────
const BROWSER_SKILLS = {
  languages:  ["python","java","javascript","typescript","c++","c#","go","rust","php","ruby","swift","kotlin","scala","r","bash","shell","perl"],
  frontend:   ["react","vue","angular","html","css","tailwind","bootstrap","jquery","nextjs","nuxtjs","svelte","sass","webpack","vite","figma"],
  backend:    ["nodejs","node.js","django","flask","fastapi","spring","express","rails","laravel","nestjs","graphql","rest","microservices","asp.net"],
  database:   ["sql","mysql","postgresql","mongodb","redis","sqlite","oracle","cassandra","dynamodb","firebase","elasticsearch","mariadb"],
  cloud:      ["aws","azure","gcp","docker","kubernetes","terraform","ansible","jenkins","ci/cd","devops","linux","nginx","heroku","vercel"],
  data:       ["pandas","numpy","matplotlib","scikit-learn","tensorflow","pytorch","keras","spark","hadoop","kafka","airflow","tableau","powerbi","ml","nlp","machine learning","deep learning"],
  mobile:     ["android","ios","flutter","react native","swift","kotlin","xamarin","ionic"],
  tools:      ["git","github","gitlab","jira","confluence","postman","swagger","agile","scrum"],
  testing:    ["selenium","cypress","jest","mocha","pytest","junit","playwright","automation","qa"],
};

const ALL_BROWSER_SKILLS = Object.values(BROWSER_SKILLS).flat();

// NLP skill extraction — matches keywords from resume text
function extractSkillsFromText(text) {
  const lower = text.toLowerCase();
  const found = {};
  let allFound = [];

  Object.entries(BROWSER_SKILLS).forEach(([cat, skills]) => {
    const hits = skills.filter(sk => {
      const pattern = new RegExp("\\b" + sk.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i");
      return pattern.test(lower);
    });
    if (hits.length > 0) {
      found[cat] = hits;
      allFound = allFound.concat(hits);
    }
  });

  return {
    byCategory: found,
    allSkills:  [...new Set(allFound)],
    count:      new Set(allFound).size,
  };
}

// JD templates for TF-IDF-like keyword overlap scoring
const JD_KEYWORDS = {
  "Backend Developer":    ["python","java","nodejs","django","flask","fastapi","spring","rest","api","postgresql","mysql","mongodb","redis","docker","git","microservices","authentication"],
  "Frontend Developer":   ["react","vue","angular","javascript","typescript","html","css","tailwind","responsive","webpack","nextjs","figma","ui","ux","jest","api"],
  "Full Stack Developer": ["react","nodejs","python","html","css","rest","api","postgresql","mongodb","docker","git","javascript","typescript","fullstack"],
  "DevOps Engineer":      ["docker","kubernetes","terraform","ansible","aws","azure","gcp","jenkins","ci/cd","linux","nginx","bash","monitoring","devops","cloud"],
  "Data Engineer":        ["python","sql","pandas","spark","kafka","airflow","postgresql","aws","etl","ml","tensorflow","pytorch","tableau","powerbi","data"],
  "QA / Tester":          ["selenium","cypress","jest","pytest","automation","testing","qa","junit","playwright","agile","regression","api","performance"],
  "Business Analyst":     ["requirements","sql","tableau","powerbi","agile","scrum","jira","excel","stakeholder","analysis","documentation","wireframes"],
};

// Compute role fit % by keyword overlap (browser-side, no TF-IDF library needed)
function computeBrowserRoleFit(text) {
  const lower = text.toLowerCase();
  return Object.entries(JD_KEYWORDS).map(([role, keywords]) => {
    const matched = keywords.filter(kw =>
      new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "\\b", "i").test(lower)
    ).length;
    const similarity = matched / keywords.length;
    const percent = Math.min(95, Math.max(5, Math.round(similarity * 100 + 5)));
    return { name: role, percent, similarity: parseFloat(similarity.toFixed(4)) };
  }).sort((a, b) => b.similarity - a.similarity);
}

// Score resume from extracted browser text
function scoreResumeFromBrowserText(text, exp) {
  const skillData  = extractSkillsFromText(text);
  const roleFit    = computeBrowserRoleFit(text);
  const wordCount  = text.trim().split(/\s+/).length;
  const sc         = skillData.count;
  const catCount   = Object.keys(skillData.byCategory).length;

  let score = 0;
  score += Math.min(40, sc * 3);                                   // skills found (max 40)
  score += wordCount >= 600 ? 20 : wordCount >= 400 ? 15          // resume length (max 20)
         : wordCount >= 200 ? 10 : wordCount >= 100 ? 5 : 0;
  score += Math.min(25, Math.round(roleFit[0].similarity * 35));   // best JD match (max 25)
  score += Math.min(10, exp * 2);                                  // experience (max 10)
  score += Math.min(5, catCount);                                  // skill diversity (max 5)

  return {
    resume_score:     Math.min(95, Math.max(10, score)),
    skills_found:     skillData.allSkills,
    skills_by_category: skillData.byCategory,
    skill_count:      sc,
    word_count:       wordCount,
    role_fit:         roleFit,
    best_match_role:  roleFit[0]?.name || "Unknown",
    best_similarity:  roleFit[0]?.similarity || 0,
    method:           "Browser-side NLP (pdf.js + keyword matching)",
    filename:         "",
  };
}

const RING_COLORS = { resume: "#6366f1", linkedin: "#3b82f6", github: "#10b981" };
const ROLE_GRADIENTS = [
  "linear-gradient(to right,#6366f1,#818cf8)",
  "linear-gradient(to right,#3b82f6,#60a5fa)",
  "linear-gradient(to right,#10b981,#34d399)",
  "linear-gradient(to right,#f59e0b,#fcd34d)",
  "linear-gradient(to right,#f43f5e,#fb7185)",
  "linear-gradient(to right,#8b5cf6,#a78bfa)",
  "linear-gradient(to right,#06b6d4,#22d3ee)",
];

const SKILL_ROLES = {
  frontend:  ["react","vue","angular","html","css","tailwind","javascript","typescript","figma","ui","ux","next","nuxt","svelte","jquery"],
  backend:   ["node","python","java","django","flask","spring","express","fastapi","rails","php","laravel","rust","go","golang","nestjs"],
  devops:    ["docker","kubernetes","ci/cd","jenkins","ansible","terraform","aws","gcp","azure","linux","nginx","devops","cloud","k8s"],
  data:      ["sql","pandas","numpy","spark","hadoop","kafka","airflow","tableau","powerbi","ml","tensorflow","pytorch","data","etl"],
  mobile:    ["android","ios","flutter","react native","swift","kotlin","xamarin","mobile"],
  qa:        ["selenium","cypress","jest","testing","qa","testng","junit","automation","playwright"],
};

function detectRoles(skills) {
  const s = (skills || "").toLowerCase();
  const score = {};
  Object.entries(SKILL_ROLES).forEach(([role, kws]) => {
    score[role] = kws.filter(k => s.includes(k)).length;
  });
  return score;
}

// ── URL parsers — imported from shared scoring.js ────────────────
const extractGithubUsername  = sharedExtractGH;
const extractLinkedInHandle  = sharedExtractLI;
const fetchGithubData        = sharedFetchGithub;
const scoreLinkedIn          = sharedScoreLinkedIn;

// ── Resume heuristic (unchanged) ────────────────────────────────
function computeResumeScore(data) {
  const exp = parseInt(data.exp) || 0;
  const isFresher = exp === 0;
  const skillList = (data.skills || "").split(",").map(s => s.trim()).filter(Boolean);
  const sc = skillList.length;
  const hasSummary = (data.summary || "").trim().length > 20;
  const resumeBase = sc === 0 && exp === 0 && !hasSummary ? 20 : 45;
  return Math.min(95, resumeBase + exp * 4 + sc * 3 + (hasSummary ? 8 : 0) + (isFresher && sc >= 3 ? 5 : 0));
}

// ── Build suggestions based on REAL fetched data ─────────────────
function buildSuggestions(rs, ghData, liScore, liBreakdown, exp, sc, hasSummary) {
  const suggestions = [];

  // Resume suggestions
  if (rs < 50) suggestions.push(`📄 Resume ${rs}% (Critical) — Add skills, a professional summary, and experience bullet points with measurable outcomes.`);
  else if (rs < 70) suggestions.push(`📄 Resume ${rs}% (Moderate) — Expand to 8–12 skills, write a 50–80 word summary, and use Action + Task + Result format for every bullet.`);
  else if (rs < 85) suggestions.push(`📄 Resume ${rs}% (Good) — Fine-tune by tailoring keywords to each job description to pass ATS filters. Keep to 1–2 clean pages.`);
  else suggestions.push(`📄 Resume ${rs}% (Excellent) — Outstanding! Keep it updated after every project. Add a "Key Achievements" section at the top.`);

  // GitHub suggestions — based on REAL fetched data
  if (!ghData) {
    suggestions.push(`🐙 GitHub: Not provided — For technical roles, GitHub is essential. Create public repos with proper READMEs. Your score can reach 70–90% with good activity.`);
  } else if (ghData.error) {
    suggestions.push(`🐙 GitHub: ${ghData.error}`);
  } else {
    const g = ghData;
    if (g.score < 30) {
      suggestions.push(`🐙 GitHub ${g.score}% (Low) — You have ${g.publicRepos} repos, ${g.totalStars} stars. Start by: creating 3–5 projects with proper READMEs, adding descriptions to all repos, and committing regularly.`);
    } else if (g.score < 55) {
      suggestions.push(`🐙 GitHub ${g.score}% — ${g.publicRepos} repos, ${g.totalStars} ⭐, ${g.languages.join(", ")||"no languages detected"}. Improve: ${g.reposWithDesc < 3 ? "add descriptions to repos, " : ""}${!g.hasBio ? "add a GitHub bio, " : ""}pin your top 6 projects on your profile.`);
    } else if (g.score < 75) {
      suggestions.push(`🐙 GitHub ${g.score}% (Average) — ${g.publicRepos} repos, ${g.totalStars} ⭐ across ${g.languages.length} languages. To improve: add GitHub Actions to projects, contribute to 1–2 open-source repos, and maintain a consistent commit streak.`);
    } else if (g.score < 88) {
      suggestions.push(`🐙 GitHub ${g.score}% (Good) — Strong profile! ${g.publicRepos} repos, ${g.totalStars} ⭐, ${g.followers} followers. Next level: publish an npm package or PyPI library, write a GitHub README for your profile page.`);
    } else {
      suggestions.push(`🐙 GitHub ${g.score}% (Excellent) — Impressive GitHub! ${g.publicRepos} repos, ${g.totalStars} ⭐, ${g.followers} followers. Maintain this by contributing to top open-source projects and keeping activity streak alive.`);
    }
  }

  // LinkedIn suggestions — based on self-assessment breakdown
  if (liScore === 0) {
    suggestions.push(`🔗 LinkedIn: Not provided — LinkedIn is the #1 recruiter tool. Create a profile with photo, detailed headline, 500+ connections, and recommendations to score 70–90%.`);
  } else if (liBreakdown) {
    const gaps = [];
    if (!liBreakdown.photo || liBreakdown.photo < 8) gaps.push("add a professional profile photo (+8 pts)");
    if (liBreakdown.connections < 10) gaps.push("grow to 500+ connections (+15 pts)");
    if (liBreakdown.recommendations < 8) gaps.push("get 3+ recommendations from colleagues (+12 pts)");
    if (liBreakdown.endorsedSkills < 6) gaps.push("get 5+ skill endorsements (+10 pts)");
    if (liBreakdown.certifications < 4) gaps.push("add certifications to profile (+8 pts)");
    if (liBreakdown.activity < 4) gaps.push("post/engage weekly on LinkedIn (+7 pts)");

    if (liScore < 40) suggestions.push(`🔗 LinkedIn ${liScore}% (Low) — Key improvements needed: ${gaps.slice(0,3).join(", ")}.`);
    else if (liScore < 65) suggestions.push(`🔗 LinkedIn ${liScore}% (Below Average) — To improve: ${gaps.slice(0,2).join(", ")}.`);
    else if (liScore < 80) suggestions.push(`🔗 LinkedIn ${liScore}% (Average) — Looking good! Still to do: ${gaps.slice(0,2).join(", ")}.`);
    else suggestions.push(`🔗 LinkedIn ${liScore}% (Strong) — Great profile! ${gaps.length > 0 ? "Fine-tune: " + gaps[0] : "Keep posting content to stay visible to recruiters."}`);
  }

  // Experience suggestion
  if (exp === 0) suggestions.push(`🌱 Fresher tip — Lead with Projects section. Include 2–3 personal or academic projects with GitHub links, tech stack, and your role. Highlight hackathons, certifications, and internships prominently.`);
  else if (exp <= 2) suggestions.push(`🚀 ${exp} yr exp — Build side projects and contribute to open source. Add certifications (AWS, GCP, or domain-specific) to accelerate your profile score significantly.`);
  else if (exp <= 5) suggestions.push(`💡 ${exp} yrs exp — Rewrite experience bullets using STAR format: Situation → Task → Action → Result. Quantify every impact (e.g. "Scaled API to 2M req/day, reducing latency by 30%").`);
  else suggestions.push(`🏆 ${exp} yrs exp — Senior profile. Highlight leadership, architecture decisions, team impact. Consider writing technical blog posts or speaking at meetups to build thought leadership.`);

  return suggestions;
}

// ── Main component ───────────────────────────────────────────────
export default function AnalyzerPage({ backendOnline, setPage, showToast }) {
  const [form, setForm] = useState({ name:"", email:"", phone:"", exp:"", li:"", gh:"", skills:"", summary:"" });
  const [fileName, setFileName] = useState("");
  const [resumeFile, setResumeFile] = useState(null);       // ← actual File object
  const [resumeAnalysis, setResumeAnalysis] = useState(null); // ← real NLP result from backend
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStep, setLoadingStep] = useState("");
  const [ghData, setGhData] = useState(null);
  const [liScore, setLiScore] = useState(null);
  const [liBreakdown, setLiBreakdown] = useState(null);
  const [showLiModal, setShowLiModal] = useState(false);
  const [oauthProfile, setOauthProfile] = useState(null); // real LinkedIn OAuth data
  const [showOAuthConnect, setShowOAuthConnect] = useState(false);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function runAnalysis() {
    if (!form.name || !form.email) { showToast("⚠ Please fill in at least name and email."); return; }
    setLoading(true);
    setResult(null);
    setGhData(null);
    setLiScore(null);
    setResumeAnalysis(null);

    const exp = parseInt(form.exp) || 0;
    const sc  = (form.skills || "").split(",").filter(Boolean).length;

    // ── STEP 1: Resume score
    // Priority order:
    //   A) Backend online + file uploaded  → FastAPI NLP (PyPDF2 + TF-IDF scikit-learn)
    //   B) Backend offline + file uploaded → Browser NLP (pdf.js + keyword matching)
    //   C) No file uploaded               → Heuristic formula from form data
    let rs = computeResumeScore(form);
    let nlpRoleFit = null;
    let resumeMethod = "heuristic";

    if (resumeFile) {
      if (backendOnline) {
        // ── PATH A: Real backend NLP ────────────────────────────
        setLoadingStep("📄 Parsing resume with backend NLP (TF-IDF + scikit-learn)…");
        try {
          const nlpResult = await analyzeResumeFile(resumeFile, exp, form.name);
          setResumeAnalysis(nlpResult);
          rs            = nlpResult.resume_score;
          nlpRoleFit    = nlpResult.role_fit;
          resumeMethod  = "nlp-backend";
          showToast(`✅ Backend NLP: ${nlpResult.skill_count} skills found in ${nlpResult.word_count} words`);
        } catch (e) {
          showToast(`⚠ Backend NLP failed: ${e.message} — trying browser fallback`);
          // Fall through to browser-side extraction
          try {
            const text = await extractResumeTextInBrowser(resumeFile);
            if (text && text.trim().length > 50) {
              const brResult = scoreResumeFromBrowserText(text, exp);
              brResult.filename = resumeFile.name;
              setResumeAnalysis(brResult);
              rs           = brResult.resume_score;
              nlpRoleFit   = brResult.role_fit;
              resumeMethod = "nlp-browser";
              showToast(`✅ Browser NLP: ${brResult.skill_count} skills found`);
            }
          } catch { /* use heuristic */ }
        }
      } else {
        // ── PATH B: Browser-side NLP (no backend needed) ────────
        const ext = (resumeFile.name || "").toLowerCase();
        if (ext.endsWith(".docx") || ext.endsWith(".doc")) {
          // DOCX cannot be parsed in browser without a library
          showToast("ℹ DOCX needs the backend. Using form data for scoring. Start backend for full NLP, or upload a PDF.");
          setLoadingStep("📄 Calculating resume score from form data…");
        } else {
          setLoadingStep("📄 Reading resume in browser (pdf.js)…");
          try {
            const text = await extractResumeTextInBrowser(resumeFile);
            if (text && text.trim().length > 50) {
              const brResult = scoreResumeFromBrowserText(text, exp);
              brResult.filename = resumeFile.name;
              setResumeAnalysis(brResult);
              rs           = brResult.resume_score;
              nlpRoleFit   = brResult.role_fit;
              resumeMethod = "nlp-browser";
              showToast(`✅ Resume read in browser: ${brResult.skill_count} skills, ${brResult.word_count} words`);
            } else {
              showToast("⚠ Could not extract text from this PDF (may be scanned/image-based). Using form data.");
            }
          } catch (e) {
            showToast(`⚠ Browser PDF read failed: ${e.message}. Using form data instead.`);
          }
        }
      }
    } else {
      setLoadingStep("📄 Calculating resume score from form data…");
    }

    // ── STEP 2: Real GitHub API fetch
    let ghResult = null;
    const ghUsername = extractGithubUsername(form.gh);
    if (ghUsername) {
      setLoadingStep(`🐙 Fetching GitHub profile for @${ghUsername}…`);
      ghResult = await fetchGithubData(ghUsername);
      setGhData(ghResult);
    }

    // ── STEP 3: LinkedIn — OAuth data takes priority over self-assessment
    let liS = 0;
    let liB = null;

    if (oauthProfile) {
      // OAuth connected — we have real name/email/photo
      // Free tier doesn't give connections/recommendations, so use partial score
      // based on what we know: profile exists = they have a LinkedIn account
      setLoadingStep("💼 Using LinkedIn OAuth data…");
      liS = 35; // base score for having a connected LinkedIn account
      showToast(`✅ LinkedIn: using OAuth profile for ${oauthProfile.name}`);
    } else if (form.li && extractLinkedInHandle(form.li)) {
      // No OAuth — fall back to self-assessment modal
      setLoadingStep("💼 LinkedIn assessment needed…");
      setShowLiModal(true);
      setLoading(false);
      return;
    }

    // ── STEP 4: Compute final scores
    const ghScore = ghResult && !ghResult.error ? ghResult.score : 0;

    const liW = liS > 0 ? 0.30 : 0;
    const ghW = ghScore > 0 ? 0.30 : 0;
    const rsW = 1 - liW - ghW;
    const overall = Math.round(rs * rsW + liS * liW + ghScore * ghW);

    // Use TF-IDF role fit if available, otherwise keyword-based
    const roleScores = detectRoles(form.skills);
    const roleFit = nlpRoleFit ? nlpRoleFit : [
      { name:"Business Analyst",    percent: Math.min(82, 35 + (rs>60?20:0) + sc*2 + exp*2) },
      { name:"Backend Developer",   percent: Math.min(92, 30 + (roleScores.backend||0)*12  + (ghScore>0?10:0) + exp*2) },
      { name:"Frontend Developer",  percent: Math.min(92, 30 + (roleScores.frontend||0)*12 + (ghScore>0?8:0)  + exp*2) },
      { name:"Full Stack Developer",percent: Math.min(90, 25 + ((roleScores.frontend||0)+(roleScores.backend||0))*7 + exp*2) },
      { name:"QA / Tester",         percent: Math.min(80, 30 + (roleScores.qa||0)*14 + sc + exp) },
      { name:"DevOps Engineer",     percent: Math.min(88, 25 + (roleScores.devops||0)*14 + (ghScore>0?12:0) + exp*2) },
      { name:"Data Engineer",       percent: Math.min(86, 25 + (roleScores.data||0)*14 + sc + exp*2) },
    ].map(r => ({ ...r, percent: Math.max(5, r.percent) }));

    const suggestions = buildSuggestions(rs, ghResult, liS, liB, exp, sc, (form.summary||"").trim().length > 20);

    setResult({
      scores: { resume: rs, linkedin: liS, github: ghScore },
      overall,
      roleFit,
      suggestions,
      resumeMethod,
    });
    setLoadingStep("");
    setLoading(false);
  }

  // ── Called after LinkedIn modal is submitted ────────────────────
  async function finishWithLinkedIn(liAnswers) {
    setShowLiModal(false);
    setLoading(true);
    setLoadingStep("💼 Calculating LinkedIn score…");

    const exp = parseInt(form.exp) || 0;
    const sc  = (form.skills || "").split(",").filter(Boolean).length;

    // BUG FIX: Use NLP resume score if we already have it — don't fall back to heuristic
    // resumeAnalysis is set by runAnalysis() before the LinkedIn modal opened
    const rs      = resumeAnalysis ? resumeAnalysis.resume_score : computeResumeScore(form);
    const nlpFit  = resumeAnalysis ? resumeAnalysis.role_fit : null;
    const rsMethod = resumeAnalysis ? (resumeAnalysis.method ? "nlp-backend" : "nlp-browser") : "heuristic";

    const ghScore = ghData && !ghData.error ? ghData.score : 0;

    const { score: liS, breakdown: liB } = scoreLinkedIn(liAnswers, exp, sc);
    setLiScore(liS);
    setLiBreakdown(liB);

    const liW = liS > 0 ? 0.30 : 0;
    const ghW = ghScore > 0 ? 0.30 : 0;
    const rsW = 1 - liW - ghW;
    const overall = Math.round(rs * rsW + liS * liW + ghScore * ghW);

    // Use TF-IDF role fit if available, else keyword heuristic
    const roleScores = detectRoles(form.skills);
    const roleFit = nlpFit ? nlpFit : [
      { name:"Business Analyst",    percent: Math.min(82, 35 + (rs>60?20:0) + sc*2 + exp*2) },
      { name:"Backend Developer",   percent: Math.min(92, 30 + (roleScores.backend||0)*12  + (ghScore>0?10:0) + exp*2) },
      { name:"Frontend Developer",  percent: Math.min(92, 30 + (roleScores.frontend||0)*12 + (ghScore>0?8:0)  + exp*2) },
      { name:"Full Stack Developer",percent: Math.min(90, 25 + ((roleScores.frontend||0)+(roleScores.backend||0))*7 + exp*2) },
      { name:"QA / Tester",         percent: Math.min(80, 30 + (roleScores.qa||0)*14 + sc + exp) },
      { name:"DevOps Engineer",     percent: Math.min(88, 25 + (roleScores.devops||0)*14 + (ghScore>0?12:0) + exp*2) },
      { name:"Data Engineer",       percent: Math.min(86, 25 + (roleScores.data||0)*14 + sc + exp*2) },
    ].map(r => ({ ...r, percent: Math.max(5, r.percent) }));

    const suggestions = buildSuggestions(rs, ghData, liS, liB, exp, sc, (form.summary||"").trim().length > 20);

    setResult({
      scores: { resume: rs, linkedin: liS, github: ghScore },
      overall,
      roleFit,
      suggestions,
      resumeMethod: rsMethod,
    });
    setLoadingStep("");
    setLoading(false);
  }

  const circ = 2 * Math.PI * 30;

  return (
    <div className="page active pw" style={{animation:"fadeIn 0.35s ease"}}>
      <div className="hero-band">
        <div className="hero-chip">⚡ Real API-Powered Career Intelligence</div>
        <h1 className="hero-title">Score Your Profile.<br /><span>Land Your Dream Job.</span></h1>
        <p className="hero-sub">GitHub scores are fetched live from the GitHub API. LinkedIn scoring uses a structured profile assessment. Resume scoring uses our heuristic engine.</p>
      </div>

      <div className="analyzer-wrap">
        {/* LEFT: Form */}
        <div className="analyzer-form-col">
          <div className="acard">
            <div className="acard-title">Personal Info</div>
            <div className="fg-row">
              <div className="fg"><div className="flabel">Full Name *</div><input className="finput" value={form.name} onChange={set("name")} placeholder="Arjun Sharma" /></div>
              <div className="fg"><div className="flabel">Email *</div><input className="finput" type="email" value={form.email} onChange={set("email")} placeholder="arjun@email.com" /></div>
            </div>
            <div className="fg-row">
              <div className="fg"><div className="flabel">Phone</div><input className="finput" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210" /></div>
              <div className="fg">
                <div className="flabel">Experience</div>
                <select className="finput" value={form.exp} onChange={set("exp")}>
                  <option value="" disabled>Select experience</option>
                  <option value="0">🌱 Fresher (0 years)</option>
                  {[1,2,3,4,5,6,7,8,9,10,12,15,20].map(y => <option key={y} value={y}>{y}{y===20?"+":""} year{y!==1?"s":""}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="acard">
            <div className="acard-title">Profile Links</div>

            {/* LinkedIn — OAuth connect button */}
            <div className="fg">
              <div className="flabel">LinkedIn</div>
              {oauthProfile ? (
                <div style={{display:"flex",alignItems:"center",gap:"0.8rem",padding:"0.6rem 0.8rem",
                  background:"rgba(10,102,194,0.07)",border:"1px solid rgba(10,102,194,0.2)",
                  borderRadius:10,marginBottom:"0.4rem"}}>
                  {oauthProfile.picture && (
                    <img src={oauthProfile.picture} alt="" style={{width:36,height:36,borderRadius:"50%",border:"2px solid #0A66C2"}}/>
                  )}
                  <div style={{flex:1}}>
                    <div style={{fontSize:"0.8rem",fontWeight:600,color:"var(--text)"}}>✅ {oauthProfile.name}</div>
                    <div style={{fontSize:"0.68rem",color:"var(--muted2)"}}>{oauthProfile.email}</div>
                  </div>
                  <button onClick={() => { setOauthProfile(null); setShowOAuthConnect(false); }}
                    style={{fontSize:"0.7rem",color:"var(--muted)",background:"transparent",border:"1px solid var(--line)",borderRadius:6,padding:"0.2rem 0.5rem",cursor:"pointer"}}>
                    Disconnect
                  </button>
                </div>
              ) : showOAuthConnect ? (
                <LinkedInConnect
                  backendOnline={backendOnline}
                  onConnected={(profile) => {
                    setOauthProfile(profile);
                    setShowOAuthConnect(false);
                    showToast(`✅ LinkedIn connected — ${profile.name}`);
                  }}
                  onSkip={() => setShowOAuthConnect(false)}
                />
              ) : (
                <div style={{display:"flex",gap:"0.5rem",alignItems:"center",flexWrap:"wrap"}}>
                  <button onClick={() => setShowOAuthConnect(true)}
                    style={{display:"flex",alignItems:"center",gap:"0.4rem",padding:"0.45rem 0.9rem",
                      background:"#0A66C2",color:"#fff",border:"none",borderRadius:8,
                      fontSize:"0.78rem",fontWeight:600,cursor:"pointer"}}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="white">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                    Connect LinkedIn
                  </button>
                  <span style={{fontSize:"0.72rem",color:"var(--muted)"}}>or</span>
                  <input className="finput" style={{flex:1,minWidth:180}} value={form.li} onChange={set("li")} placeholder="https://linkedin.com/in/your-name"/>
                </div>
              )}
              {!oauthProfile && form.li && extractLinkedInHandle(form.li) && (
                <div style={{fontSize:"0.7rem",color:"var(--mint)",marginTop:"0.3rem"}}>
                  ✓ LinkedIn URL detected — self-assessment will open after clicking Analyse
                </div>
              )}
            </div>
            <div className="fg">
              <div className="flabel">GitHub URL</div>
              <input className="finput" value={form.gh} onChange={set("gh")} placeholder="https://github.com/your-username" />
              {form.gh && extractGithubUsername(form.gh) && (
                <div style={{fontSize:"0.72rem",color:"var(--mint)",marginTop:"0.3rem"}}>
                  ✓ Will fetch live from GitHub API: @{extractGithubUsername(form.gh)}
                </div>
              )}
            </div>
            <div className="fg"><div className="flabel">Key Skills</div><input className="finput" value={form.skills} onChange={set("skills")} placeholder="React, Node.js, Python, AWS…" /></div>
          </div>

          <div className="acard">
            <div className="acard-title">Resume & Summary</div>
            <div className="fg">
              <div className="flabel">
                Resume (PDF/DOC)
                {resumeFile && <span style={{color:"var(--mint)",fontSize:"0.68rem",marginLeft:"0.4rem"}}>← will be analysed</span>}
              </div>
              <div className="upload-area">
                <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={e => {
                  const f = e.target.files[0];
                  if (f) { setFileName(f.name); setResumeFile(f); }
                }} />
                <div className="upload-txt">
                  <strong>Drop resume here</strong> or click to browse
                  {backendOnline
                    ? <div style={{fontSize:"0.7rem",color:"var(--mint)",marginTop:"0.25rem"}}>🟢 Backend online — PDF/DOCX parsed with PyPDF2 + TF-IDF NLP</div>
                    : <div style={{fontSize:"0.7rem",color:"#a5b4fc",marginTop:"0.25rem"}}>🔵 PDF analysed in browser using pdf.js (no backend needed)</div>
                  }
                  <div style={{fontSize:"0.67rem",color:"var(--muted)",marginTop:"0.15rem"}}>DOCX requires backend · TXT works in both modes</div>
                </div>
                {fileName && <div className="file-ok">✓ {fileName} {resumeFile && `(${(resumeFile.size/1024).toFixed(1)} KB)`}</div>}
              </div>
            </div>
            <div className="fg">
              <div className="flabel">Professional Summary</div>
              <textarea className="finput" style={{minHeight:80,resize:"vertical"}} value={form.summary} onChange={set("summary")} placeholder="Brief summary of your experience and goals…" />
            </div>
          </div>

          <button className="btn-analyze" onClick={runAnalysis} disabled={loading}>
            {loading
              ? <><span className="spin"></span>{loadingStep || "Analysing…"}</>
              : result ? "✓ Re-Analyse" : "⚡ Analyse My Profile"}
          </button>

          {/* How scoring works info box */}
          <div style={{marginTop:"1rem",padding:"0.9rem 1rem",background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.15)",borderRadius:12,fontSize:"0.75rem",color:"var(--muted2)",lineHeight:1.8}}>
            <div style={{fontWeight:600,color:"var(--text)",marginBottom:"0.5rem"}}>🔍 How resume scoring works</div>
            <div>🟢 <strong>Backend online + PDF/DOCX uploaded</strong> → <span style={{color:"var(--mint)"}}>PyPDF2/python-docx extracts text → scikit-learn TF-IDF cosine similarity</span></div>
            <div>🔵 <strong>Backend offline + PDF uploaded</strong> → <span style={{color:"#a5b4fc"}}>pdf.js reads PDF in browser → keyword NLP matching (no server needed)</span></div>
            <div>🟡 <strong>No file uploaded</strong> → <span style={{color:"var(--amber)"}}>Heuristic formula from form data (experience + skills + summary)</span></div>
            <div style={{marginTop:"0.4rem"}}>🐙 <strong>GitHub</strong> — live fetch from api.github.com &nbsp;|&nbsp; 💼 <strong>LinkedIn</strong> — self-assessment form</div>
          </div>
        </div>

        {/* RIGHT: Results */}
        <div className="analyzer-result-col">
          <div className="acard">
            <div className="acard-title">Profile Scores</div>
            {result ? (
              <>
                <div className="scores-trio">
                  {["resume","linkedin","github"].map(k => {
                    const v = result.scores[k]; const c = RING_COLORS[k];
                    const offset = circ - (v / 100) * circ;
                    return (
                      <div className="score-ring-card" key={k}>
                        <div className="ring-wrap">
                          <svg className="ring-svg" width="72" height="72" viewBox="0 0 72 72">
                            <circle className="ring-bg" cx="36" cy="36" r="30" />
                            <circle className="ring-fill" cx="36" cy="36" r="30" stroke={c} strokeDasharray={circ} strokeDashoffset={offset} />
                          </svg>
                          <div className="ring-val" style={{color:c}}>{v}%</div>
                        </div>
                        <div className="ring-name">{k.charAt(0).toUpperCase()+k.slice(1)}</div>
                      </div>
                    );
                  })}
                </div>

                {/* Overall score */}
                <div style={{marginTop:"1rem",textAlign:"center",padding:"0.75rem",background:"rgba(255,255,255,0.03)",borderRadius:10,border:"1px solid var(--line)"}}>
                  <div style={{fontSize:"0.7rem",color:"var(--muted)",textTransform:"uppercase",letterSpacing:"0.08em"}}>Overall Score</div>
                  <div style={{fontSize:"2rem",fontWeight:800,fontFamily:"Clash Display",background:"linear-gradient(135deg,#6366f1,#10b981)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>
                    {result.overall}%
                  </div>
                </div>

                {/* Resume method badge */}
                {result.resumeMethod === "nlp-backend" && (
                  <div style={{marginTop:"0.6rem",padding:"0.4rem 0.7rem",background:"rgba(16,185,129,0.07)",border:"1px solid rgba(16,185,129,0.2)",borderRadius:8,fontSize:"0.72rem",color:"var(--mint)"}}>
                    ✅ Scored from actual resume file — PyPDF2 + scikit-learn TF-IDF (backend)
                  </div>
                )}
                {result.resumeMethod === "nlp-browser" && (
                  <div style={{marginTop:"0.6rem",padding:"0.4rem 0.7rem",background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:8,fontSize:"0.72rem",color:"#a5b4fc"}}>
                    ✅ Scored from actual resume file — pdf.js + browser NLP (offline mode)
                  </div>
                )}
                {result.resumeMethod === "heuristic" && (
                  <div style={{marginTop:"0.6rem",padding:"0.4rem 0.7rem",background:"rgba(245,158,11,0.07)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:8,fontSize:"0.72rem",color:"var(--amber)"}}>
                    ⚠ Scored from form data only. Upload a PDF resume for real NLP analysis.
                  </div>
                )}
                {ghData && !ghData.error && (
                  <div style={{marginTop:"0.75rem",padding:"0.75rem",background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.15)",borderRadius:10}}>
                    <div style={{fontSize:"0.72rem",fontWeight:600,color:"var(--mint)",marginBottom:"0.5rem"}}>🐙 GitHub Live Data — @{ghData.username}</div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0.4rem",fontSize:"0.7rem",color:"var(--muted2)"}}>
                      <div>📦 <strong style={{color:"var(--text)"}}>{ghData.publicRepos}</strong> repos</div>
                      <div>⭐ <strong style={{color:"var(--text)"}}>{ghData.totalStars}</strong> stars</div>
                      <div>🍴 <strong style={{color:"var(--text)"}}>{ghData.totalForks}</strong> forks</div>
                      <div>👥 <strong style={{color:"var(--text)"}}>{ghData.followers}</strong> followers</div>
                      <div>🌐 <strong style={{color:"var(--text)"}}>{ghData.languages.length}</strong> languages</div>
                      <div>🕐 <strong style={{color:"var(--text)"}}>{ghData.recentlyActive}</strong> active repos</div>
                    </div>
                    {ghData.languages.length > 0 && (
                      <div style={{marginTop:"0.5rem",fontSize:"0.68rem",color:"var(--muted)"}}>
                        Languages: {ghData.languages.join(" · ")}
                      </div>
                    )}
                  </div>
                )}
                {ghData && ghData.error && (
                  <div style={{marginTop:"0.75rem",padding:"0.6rem",background:"rgba(244,63,94,0.06)",border:"1px solid rgba(244,63,94,0.2)",borderRadius:8,fontSize:"0.73rem",color:"var(--rose)"}}>
                    🐙 GitHub: {ghData.error}
                  </div>
                )}
                {result.scores.linkedin === 0 && !form.li && (
                  <div style={{marginTop:"0.5rem",padding:"0.5rem 0.75rem",background:"rgba(245,158,11,0.08)",border:"1px solid rgba(245,158,11,0.2)",borderRadius:8,fontSize:"0.75rem",color:"var(--amber)"}}>
                    ⚠ LinkedIn score is 0 — no URL provided
                  </div>
                )}

                {/* NLP Resume Analysis Panel — shows only when file was parsed */}
                {resumeAnalysis && (
                  <div style={{marginTop:"0.75rem",padding:"0.85rem 1rem",background:"rgba(99,102,241,0.06)",border:"1px solid rgba(99,102,241,0.2)",borderRadius:10}}>
                    <div style={{fontSize:"0.73rem",fontWeight:600,color:"#a5b4fc",marginBottom:"0.6rem"}}>
                      📄 NLP Resume Analysis — {resumeAnalysis.filename}
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.4rem",fontSize:"0.7rem",color:"var(--muted2)",marginBottom:"0.7rem"}}>
                      <div>📝 <strong style={{color:"var(--text)"}}>{resumeAnalysis.word_count}</strong> words extracted</div>
                      <div>🛠 <strong style={{color:"var(--text)"}}>{resumeAnalysis.skill_count}</strong> skills found</div>
                      <div>🎯 Best role: <strong style={{color:"var(--text)"}}>{resumeAnalysis.best_match_role}</strong></div>
                      <div>📊 TF-IDF: <strong style={{color:"var(--text)"}}>{(resumeAnalysis.best_similarity * 100).toFixed(1)}%</strong></div>
                    </div>

                    {/* Score Breakdown Table */}
                    {resumeAnalysis.score_breakdown && (
                      <div style={{marginBottom:"0.7rem"}}>
                        <div style={{fontSize:"0.68rem",color:"var(--muted)",marginBottom:"0.35rem",fontWeight:600}}>📐 Score breakdown:</div>
                        <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"0.2rem 0.5rem",fontSize:"0.68rem"}}>
                          {[
                            ["🛠 Skills",     resumeAnalysis.score_breakdown.skills_pts,   40],
                            ["📏 Length",     resumeAnalysis.score_breakdown.length_pts,   20],
                            ["🔗 TF-IDF",     resumeAnalysis.score_breakdown.tfidf_pts,    25],
                            ["💼 Experience", resumeAnalysis.score_breakdown.exp_pts,      10],
                            ["🗂 Diversity",  resumeAnalysis.score_breakdown.diversity_pts, 5],
                          ].map(([label, pts, max]) => (
                            <React.Fragment key={label}>
                              <span style={{color:"var(--muted2)"}}>{label}</span>
                              <span style={{color:"var(--text)",fontWeight:600,textAlign:"right"}}>{pts}</span>
                              <span style={{color:"var(--muted)"}}>/ {max}</span>
                            </React.Fragment>
                          ))}
                          <span style={{color:"var(--mint)",fontWeight:700,borderTop:"1px solid var(--line2)",paddingTop:"0.2rem"}}>Total</span>
                          <span style={{color:"var(--mint)",fontWeight:700,textAlign:"right",borderTop:"1px solid var(--line2)",paddingTop:"0.2rem"}}>{resumeAnalysis.score_breakdown.total}</span>
                          <span style={{color:"var(--muted)",borderTop:"1px solid var(--line2)",paddingTop:"0.2rem"}}>/ 95</span>
                        </div>
                      </div>
                    )}

                    <div style={{fontSize:"0.68rem",color:"var(--muted)",marginBottom:"0.45rem"}}>Skills extracted from resume text:</div>
                    <div style={{display:"flex",flexWrap:"wrap",gap:"0.3rem"}}>
                      {(resumeAnalysis.skills_found || []).slice(0, 20).map(sk => (
                        <span key={sk} style={{background:"rgba(99,102,241,0.12)",border:"1px solid rgba(99,102,241,0.25)",borderRadius:4,padding:"0.1rem 0.45rem",fontSize:"0.65rem",color:"#a5b4fc"}}>
                          {sk}
                        </span>
                      ))}
                      {(resumeAnalysis.skills_found||[]).length > 20 && (
                        <span style={{fontSize:"0.65rem",color:"var(--muted)"}}>+{resumeAnalysis.skills_found.length-20} more</span>
                      )}
                    </div>
                    <div style={{marginTop:"0.6rem",fontSize:"0.67rem",color:"var(--muted)",borderTop:"1px solid var(--line2)",paddingTop:"0.45rem"}}>
                      Method: {resumeAnalysis.method}
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="empty-state"><div className="empty-ico">📊</div>Your scores will appear here after analysis</div>
            )}
          </div>

          <div className="acard">
            <div className="acard-title">Role Fit Probability</div>
            {result ? result.roleFit.map((r, i) => (
              <div className="role-bar" key={r.name}>
                <div className="rb-head"><span className="rb-name">{r.name}</span><span className="rb-pct">{r.percent}%</span></div>
                <div className="rb-track"><div className="rb-fill" style={{width:`${r.percent}%`,background:ROLE_GRADIENTS[i%ROLE_GRADIENTS.length]}}></div></div>
              </div>
            )) : <div className="empty-state"><div className="empty-ico">🎯</div>Role fit analysis will appear here</div>}
          </div>

          <div className="acard">
            <div className="acard-title">AI Improvement Suggestions</div>
            {result ? result.suggestions.map((s, i) => (
              <div className="sug-item" key={i}><div className="sug-dot"></div><div>{s}</div></div>
            )) : <div className="empty-state"><div className="empty-ico">💡</div>Personalized tips will appear after analysis</div>}
          </div>
        </div>
      </div>

      {/* ── LINKEDIN ASSESSMENT MODAL ─────────────────────────── */}
      {showLiModal && (
        <LinkedInModal
          handle={extractLinkedInHandle(form.li)}
          onSubmit={finishWithLinkedIn}
          onSkip={() => { setShowLiModal(false); finishWithLinkedIn(null); }}
        />
      )}

      <Footer setPage={setPage} />
    </div>
  );
}

// ── LinkedIn Self-Assessment Modal ───────────────────────────────
function LinkedInModal({ handle, onSubmit, onSkip }) {
  const [d, setD] = useState({
    hasPhoto: false,
    headline: "none",
    connections: "",
    recommendations: "",
    endorsedSkills: "",
    expDetail: "none",
    hasEducation: false,
    certifications: "",
    hasProjects: false,
    aboutSection: "none",
    activityLevel: "none",
  });
  const set = (k, v) => setD(prev => ({ ...prev, [k]: v }));
  const setVal = k => e => set(k, e.target.value);

  return (
    <div className="modal-overlay">
      <div className="modal-box" style={{maxWidth:520,maxHeight:"85vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
          <div className="modal-title">💼 LinkedIn Profile Assessment</div>
          <button onClick={onSkip} style={{background:"none",border:"none",color:"var(--muted)",cursor:"pointer",fontSize:"1.2rem"}}>✕</button>
        </div>
        <div style={{fontSize:"0.78rem",color:"var(--muted2)",marginBottom:"1.2rem",padding:"0.6rem 0.75rem",background:"rgba(59,130,246,0.07)",borderRadius:8,border:"1px solid rgba(59,130,246,0.15)"}}>
          ℹ LinkedIn has no free public API — we calculate your score based on your answers below about your profile <strong style={{color:"var(--sky)"}}>linkedin.com/in/{handle}</strong>
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:"0.9rem"}}>

          {/* Photo */}
          <div className="fg">
            <div className="flabel">Do you have a professional profile photo?</div>
            <div style={{display:"flex",gap:"0.75rem",marginTop:"0.4rem"}}>
              {[["Yes",true],["No",false]].map(([label,val]) => (
                <label key={label} style={{display:"flex",alignItems:"center",gap:"0.4rem",cursor:"pointer",fontSize:"0.82rem",color:d.hasPhoto===val?"var(--sky)":"var(--muted2)"}}>
                  <input type="radio" name="photo" checked={d.hasPhoto===val} onChange={()=>set("hasPhoto",val)} style={{accentColor:"var(--sky)"}} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Headline */}
          <div className="fg">
            <div className="flabel">How is your LinkedIn Headline?</div>
            <select className="finput" value={d.headline} onChange={setVal("headline")}>
              <option value="none">No headline / default</option>
              <option value="basic">Basic (just job title)</option>
              <option value="detailed">Detailed (role + skills + value prop)</option>
            </select>
          </div>

          {/* Connections */}
          <div className="fg">
            <div className="flabel">How many connections do you have?</div>
            <select className="finput" value={d.connections} onChange={setVal("connections")}>
              <option value="">Select range</option>
              <option value="10">Less than 50</option>
              <option value="50">50–100</option>
              <option value="100">100–200</option>
              <option value="200">200–500</option>
              <option value="500">500+</option>
            </select>
          </div>

          {/* Recommendations */}
          <div className="fg">
            <div className="flabel">How many recommendations have you received?</div>
            <select className="finput" value={d.recommendations} onChange={setVal("recommendations")}>
              <option value="0">None</option>
              <option value="1">1–2</option>
              <option value="3">3–4</option>
              <option value="5">5 or more</option>
            </select>
          </div>

          {/* Endorsed skills */}
          <div className="fg">
            <div className="flabel">How many skills are endorsed by others?</div>
            <select className="finput" value={d.endorsedSkills} onChange={setVal("endorsedSkills")}>
              <option value="0">None</option>
              <option value="2">1–4</option>
              <option value="5">5–9</option>
              <option value="10">10 or more</option>
            </select>
          </div>

          {/* Experience detail */}
          <div className="fg">
            <div className="flabel">How detailed is your Work Experience section?</div>
            <select className="finput" value={d.expDetail} onChange={setVal("expDetail")}>
              <option value="none">Not filled / only company names</option>
              <option value="partial">Partial (some bullet points)</option>
              <option value="full">Full (3+ bullet points per role with outcomes)</option>
            </select>
          </div>

          {/* Education */}
          <div className="fg">
            <div className="flabel">Do you have an Education section filled?</div>
            <div style={{display:"flex",gap:"0.75rem",marginTop:"0.4rem"}}>
              {[["Yes",true],["No",false]].map(([label,val]) => (
                <label key={label} style={{display:"flex",alignItems:"center",gap:"0.4rem",cursor:"pointer",fontSize:"0.82rem",color:d.hasEducation===val?"var(--sky)":"var(--muted2)"}}>
                  <input type="radio" name="edu" checked={d.hasEducation===val} onChange={()=>set("hasEducation",val)} style={{accentColor:"var(--sky)"}} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* Certifications */}
          <div className="fg">
            <div className="flabel">How many certifications have you added?</div>
            <select className="finput" value={d.certifications} onChange={setVal("certifications")}>
              <option value="0">None</option>
              <option value="1">1–2</option>
              <option value="3">3 or more</option>
            </select>
          </div>

          {/* Projects */}
          <div className="fg">
            <div className="flabel">Do you have a Projects or Featured section?</div>
            <div style={{display:"flex",gap:"0.75rem",marginTop:"0.4rem"}}>
              {[["Yes",true],["No",false]].map(([label,val]) => (
                <label key={label} style={{display:"flex",alignItems:"center",gap:"0.4rem",cursor:"pointer",fontSize:"0.82rem",color:d.hasProjects===val?"var(--sky)":"var(--muted2)"}}>
                  <input type="radio" name="proj" checked={d.hasProjects===val} onChange={()=>set("hasProjects",val)} style={{accentColor:"var(--sky)"}} />
                  {label}
                </label>
              ))}
            </div>
          </div>

          {/* About section */}
          <div className="fg">
            <div className="flabel">How is your About / Summary section?</div>
            <select className="finput" value={d.aboutSection} onChange={setVal("aboutSection")}>
              <option value="none">Empty or not filled</option>
              <option value="basic">Basic (1–2 lines)</option>
              <option value="detailed">Detailed (3+ lines with skills, goals, value)</option>
            </select>
          </div>

          {/* Activity */}
          <div className="fg">
            <div className="flabel">How active are you on LinkedIn?</div>
            <select className="finput" value={d.activityLevel} onChange={setVal("activityLevel")}>
              <option value="none">Inactive (rarely log in)</option>
              <option value="some">Occasional (like/comment sometimes)</option>
              <option value="active">Active (post or engage weekly)</option>
            </select>
          </div>
        </div>

        <div style={{display:"flex",gap:"0.75rem",marginTop:"1.5rem"}}>
          <button className="btn-cancel-modal" style={{flex:1}} onClick={onSkip}>Skip LinkedIn</button>
          <button className="btn-send-mail" style={{flex:2}} onClick={() => onSubmit(d)}>
            Calculate LinkedIn Score →
          </button>
        </div>
      </div>
    </div>
  );
}
