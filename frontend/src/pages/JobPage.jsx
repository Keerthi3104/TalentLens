// src/pages/JobPage.jsx
import React, { useState, useEffect, useRef } from "react";
import { submitApplication, analyzeResumeFile } from "../api/talentlens";
import { fetchGithubData, scoreLinkedIn, extractGithubUsername, extractLinkedInHandle, LI_QUESTIONS } from "../api/scoring";
import Footer from "../components/Footer";

// ─── pdf.js browser fallback (when backend offline) ─────────────
function loadPdfJs() {
  return new Promise((resolve, reject) => {
    if (window.pdfjsLib) { resolve(window.pdfjsLib); return; }
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
      resolve(window.pdfjsLib);
    };
    s.onerror = reject;
    document.head.appendChild(s);
  });
}
async function extractPdfTextBrowser(file) {
  try {
    const lib = await loadPdfJs();
    const buf = await file.arrayBuffer();
    const pdf = await lib.getDocument({ data: buf }).promise;
    let text = "";
    for (let i = 1; i <= pdf.numPages; i++) {
      const pg = await pdf.getPage(i);
      const ct = await pg.getTextContent();
      text += ct.items.map(s => s.str).join(" ") + "\n";
    }
    return text.trim().length > 30 ? text : null;
  } catch { return null; }
}

// ─── Browser-side NLP (mirrors backend pipeline exactly) ─────────
const SKILLS_DICT = {
  languages: ["python","java","javascript","typescript","c++","c#","go","rust","php","ruby","swift","kotlin","scala","r","bash","shell"],
  frontend:  ["react","vue","angular","html","css","tailwind","bootstrap","jquery","nextjs","svelte","sass","webpack","vite","figma","redux"],
  backend:   ["nodejs","node.js","django","flask","fastapi","spring","express","rails","laravel","nestjs","graphql","rest","microservices"],
  database:  ["sql","mysql","postgresql","mongodb","redis","sqlite","oracle","cassandra","dynamodb","firebase","elasticsearch"],
  cloud:     ["aws","azure","gcp","docker","kubernetes","terraform","ansible","jenkins","devops","linux","nginx","heroku","vercel"],
  data:      ["pandas","numpy","tensorflow","pytorch","keras","spark","hadoop","kafka","airflow","tableau","powerbi","scikit-learn","ml","nlp"],
  mobile:    ["android","ios","flutter","react native","xamarin","ionic"],
  tools:     ["git","github","gitlab","jira","postman","swagger","agile","scrum"],
  testing:   ["selenium","cypress","jest","pytest","junit","playwright","automation","qa"],
};
const JD_DICT = {
  "Backend Developer":    ["python","java","nodejs","django","flask","fastapi","rest","api","postgresql","mysql","mongodb","redis","docker","git","microservices"],
  "Frontend Developer":   ["react","vue","angular","javascript","typescript","html","css","tailwind","responsive","nextjs","figma","ui","ux","jest"],
  "Full Stack Developer": ["react","nodejs","python","html","css","rest","api","postgresql","mongodb","docker","git","javascript","typescript"],
  "DevOps Engineer":      ["docker","kubernetes","terraform","ansible","aws","azure","gcp","jenkins","linux","nginx","bash","devops","cloud"],
  "Data Engineer":        ["python","sql","pandas","spark","kafka","airflow","postgresql","aws","etl","ml","tensorflow","pytorch","tableau","powerbi"],
  "QA / Tester":          ["selenium","cypress","jest","pytest","automation","testing","qa","junit","playwright","agile","regression","api"],
  "Business Analyst":     ["requirements","sql","tableau","powerbi","agile","scrum","jira","excel","stakeholder","analysis","documentation"],
};
function browserNLP(text, exp) {
  const lower = text.toLowerCase();
  const byCat = {}, all = [];
  Object.entries(SKILLS_DICT).forEach(([cat, skills]) => {
    const hits = skills.filter(sk => new RegExp("\\b" + sk.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + "\\b","i").test(lower));
    if (hits.length) { byCat[cat] = hits; all.push(...hits); }
  });
  const unique = [...new Set(all)];
  const roleFit = Object.entries(JD_DICT).map(([role, kws]) => {
    const m = kws.filter(kw => new RegExp("\\b" + kw.replace(/[.*+?^${}()|[\]\\]/g,"\\$&") + "\\b","i").test(lower)).length;
    const sim = m / kws.length;
    return { name: role, percent: Math.min(95, Math.max(5, Math.round(sim*100+5))), similarity: parseFloat(sim.toFixed(4)) };
  }).sort((a,b) => b.similarity - a.similarity);
  const wc=lower.trim().split(/\s+/).length, sc=unique.length, cats=Object.keys(byCat).length;
  const bestSim = roleFit[0]?.similarity || 0;
  const skills_pts=Math.min(40,sc*3), length_pts=wc>=600?20:wc>=400?15:wc>=200?10:wc>=100?5:0;
  const tfidf_pts=Math.min(25,Math.round(bestSim*35)), exp_pts=Math.min(10,(parseInt(exp)||0)*2), diversity_pts=Math.min(5,cats);
  const total=Math.min(95,Math.max(10,skills_pts+length_pts+tfidf_pts+exp_pts+diversity_pts));
  return { resume_score:total, skills_found:unique, skills_by_category:byCat, skill_count:sc, word_count:wc,
    role_fit:roleFit, best_match_role:roleFit[0]?.name||"Unknown", best_similarity:bestSim,
    method:"Browser NLP (pdf.js + keyword matching)", filename:"",
    score_breakdown:{skills_pts,length_pts,tfidf_pts,exp_pts,diversity_pts,total} };
}
function heuristic(exp, skills) {
  const sc=(skills||"").split(",").map(s=>s.trim()).filter(Boolean).length;
  return Math.min(95,(sc===0&&exp===0?20:45)+exp*4+sc*3+(exp===0&&sc>=3?5:0));
}

// ─── LinkedIn 11-question Modal (exact copy from AnalyzerPage) ────
function LinkedInModal({ onSubmit, onClose }) {
  const init = {};
  // FIX: Default bool fields to null (unanswered) so user must explicitly pick Yes/No
  // Default select fields to first option as before
  LI_QUESTIONS.forEach(q => { init[q.key] = q.type==="bool" ? null : q.opts[0][0]; });
  const [ans, setAns] = useState(init);

  // Count how many questions are answered
  const answeredCount = LI_QUESTIONS.filter(q => {
    if (q.type === "bool") return ans[q.key] !== null;
    return true; // selects always have a value
  }).length;

  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,0.72)",zIndex:2000,
      display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
      <div style={{background:"var(--card)",border:"1px solid var(--line)",borderRadius:16,
        padding:"1.5rem",maxWidth:520,width:"100%",maxHeight:"90vh",overflowY:"auto"}}>
        <div style={{fontSize:"1rem",fontWeight:700,color:"var(--text)",marginBottom:"0.2rem"}}>
          💼 LinkedIn Profile Assessment
        </div>
        <div style={{fontSize:"0.75rem",color:"var(--muted2)",marginBottom:"0.5rem"}}>
          LinkedIn has no public API. Answer all 11 questions honestly for an accurate score.
        </div>
        {/* Progress bar */}
        <div style={{background:"var(--line)",borderRadius:4,height:4,marginBottom:"1.2rem"}}>
          <div style={{background:"#6366f1",borderRadius:4,height:4,
            width:`${(answeredCount/LI_QUESTIONS.length)*100}%`,transition:"width 0.3s"}}/>
        </div>
        {LI_QUESTIONS.map((q, idx) => (
          <div key={q.key} style={{marginBottom:"1rem"}}>
            <div style={{fontSize:"0.78rem",color:"var(--text)",marginBottom:"0.35rem"}}>
              <span style={{color:"var(--muted)",marginRight:"0.3rem"}}>{idx+1}.</span>
              {q.label}
            </div>
            {q.type==="bool" ? (
              <div style={{display:"flex",gap:"0.5rem"}}>
                {[["Yes",true],["No",false]].map(([lbl,val]) => (
                  <button key={lbl} onClick={() => setAns(a=>({...a,[q.key]:val}))}
                    style={{flex:1,padding:"0.45rem",borderRadius:8,cursor:"pointer",fontSize:"0.8rem",
                      border:`1px solid ${ans[q.key]===val?"#6366f1":ans[q.key]===null?"var(--amber)":"var(--line)"}`,
                      background:ans[q.key]===val?"rgba(99,102,241,0.15)":"transparent",
                      color:ans[q.key]===val?"#a5b4fc":"var(--muted2)"}}>
                    {lbl}
                  </button>
                ))}
                {ans[q.key] === null && (
                  <span style={{fontSize:"0.65rem",color:"var(--amber)",alignSelf:"center",marginLeft:"0.3rem"}}>← answer required</span>
                )}
              </div>
            ) : (
              <select value={ans[q.key]} onChange={e=>setAns(a=>({...a,[q.key]:e.target.value}))}
                style={{width:"100%",padding:"0.5rem 0.7rem",borderRadius:8,fontSize:"0.8rem",
                  border:"1px solid var(--line)",background:"var(--input)",color:"var(--text)"}}>
                {q.opts.map(([val,lbl]) => <option key={val} value={val}>{lbl}</option>)}
              </select>
            )}
          </div>
        ))}
        {/* Score preview */}
        <div style={{padding:"0.5rem 0.7rem",background:"rgba(99,102,241,0.06)",
          border:"1px solid rgba(99,102,241,0.15)",borderRadius:8,fontSize:"0.72rem",
          color:"var(--muted2)",marginBottom:"1rem"}}>
          {answeredCount < LI_QUESTIONS.length
            ? `Answer all ${LI_QUESTIONS.length} questions to calculate your LinkedIn score`
            : `✅ All questions answered — click below to calculate your LinkedIn score`}
        </div>
        <div style={{display:"flex",gap:"0.7rem"}}>
          <button onClick={onClose}
            style={{flex:1,padding:"0.6rem",borderRadius:10,cursor:"pointer",fontSize:"0.82rem",
              border:"1px solid var(--line)",background:"transparent",color:"var(--muted2)"}}>
            Skip (score = 0)
          </button>
          <button
            onClick={() => {
              // Replace any unanswered bools with false before submitting
              const final = { ...ans };
              LI_QUESTIONS.forEach(q => { if (q.type==="bool" && final[q.key]===null) final[q.key]=false; });
              onSubmit(final);
            }}
            style={{flex:2,padding:"0.6rem",borderRadius:10,cursor:"pointer",fontSize:"0.82rem",
              fontWeight:600,border:"none",background:"linear-gradient(135deg,#6366f1,#3b82f6)",color:"#fff"}}>
            Calculate LinkedIn Score ({answeredCount}/{LI_QUESTIONS.length} answered) →
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────
export default function JobPage({ co, backendOnline, setPage, showToast, onApplicationSubmit, applicants }) {
  const [form, setForm]           = useState({name:"",email:"",phone:"",exp:"",li:"",gh:"",skills:"",cover:""});
  const [fileName, setFileName]   = useState("");
  const [resumeFile, setResumeFile] = useState(null);
  const [loading, setLoading]     = useState(false);
  const [step, setStep]           = useState("");
  const [success, setSuccess]     = useState(null);
  const [barWidth, setBarWidth]   = useState(0);
  const [showLiModal, setShowLiModal] = useState(false);
  const pending = useRef(null); // stores interim data while LinkedIn modal is open

  const set = k => e => setForm(f=>({...f,[k]:e.target.value}));

  // Always derive filled from actual applicants array — stays accurate across the session
  const filledCount = applicants ? (applicants[co?.id] || []).length : (co?.filled || 0);

  useEffect(() => {
    if (!co) return;
    const pct = Math.round((filledCount / co.vacancies) * 100);
    setTimeout(() => setBarWidth(Math.min(100, pct)), 100);
  }, [co, filledCount]);

  if (!co) return null;
  const remain = Math.max(0, co.vacancies - filledCount);

  // ─── SUBMIT: runs all 3 pipelines in order ─────────────────────
  async function submit() {
    if (!form.name||!form.email||!form.phone) { showToast("⚠ Name, email and phone are required."); return; }
    if (remain<=0) { showToast("❌ No seats remaining."); return; }
    setLoading(true); setSuccess(null);
    const exp = form.exp!==""?parseInt(form.exp):0;

    // ══ PIPELINE 1: RESUME NLP ════════════════════════════════════
    let nlpData = null;
    let resumeScore = heuristic(exp, form.skills); // default fallback
    let resumeError = null;

    if (resumeFile) {
      const isPdf  = resumeFile.name.toLowerCase().endsWith(".pdf");
      const isDocx = resumeFile.name.toLowerCase().match(/\.docx?$/);

      if (backendOnline) {
        // PATH A: Real backend — PyPDF2 / python-docx + TF-IDF scikit-learn
        setStep("📄 Extracting resume text via PyPDF2 + TF-IDF…");
        try {
          const r = await analyzeResumeFile(resumeFile, exp, form.name);
          nlpData = { ...r, filename: resumeFile.name };
          resumeScore = r.resume_score;
          showToast(`✅ Resume NLP done: ${r.skill_count} skills · ${r.word_count} words · Score: ${r.resume_score}%`);
        } catch(err) {
          resumeError = err.message;
          showToast(`❌ Resume backend error: ${err.message} — trying browser fallback…`);
          // PATH B fallback: browser pdf.js for PDFs
          if (isPdf) {
            setStep("📄 Falling back to browser PDF reader…");
            const text = await extractPdfTextBrowser(resumeFile);
            if (text) {
              nlpData = { ...browserNLP(text, exp), filename: resumeFile.name };
              resumeScore = nlpData.resume_score;
              resumeError = null;
              showToast(`✅ Browser NLP fallback: ${nlpData.skill_count} skills · ${nlpData.word_count} words`);
            } else {
              showToast("⚠ Could not read PDF text. Is it a scanned/image PDF? Using form-based score.");
            }
          } else if (isDocx) {
            showToast("⚠ DOCX needs backend to parse. Start backend and try again, or convert to PDF.");
          }
        }
      } else if (isPdf) {
        // PATH B: Backend offline — browser pdf.js only
        setStep("📄 Reading PDF in browser (pdf.js)…");
        const text = await extractPdfTextBrowser(resumeFile);
        if (text) {
          nlpData = { ...browserNLP(text, exp), filename: resumeFile.name };
          resumeScore = nlpData.resume_score;
          showToast(`✅ Browser NLP: ${nlpData.skill_count} skills · ${nlpData.word_count} words · Score: ${nlpData.resume_score}%`);
        } else {
          showToast("⚠ Could not extract text from PDF. It may be image-based or scanned. Using form score.");
        }
      } else if (isDocx) {
        showToast("⚠ DOCX scoring needs the backend. Start backend (uvicorn main:app --port 8000) and re-submit, or upload as PDF.");
      }
    } else {
      setStep("📄 No file uploaded — using form-based score…");
      await new Promise(r => setTimeout(r, 300)); // brief pause so user sees the step
    }

    // ══ PIPELINE 2: GITHUB LIVE API ═══════════════════════════════
    let ghResult = null;
    const ghUser = extractGithubUsername(form.gh);
    if (ghUser) {
      setStep(`🐙 Fetching live GitHub data for @${ghUser}…`);
      try {
        const raw = await fetchGithubData(ghUser);
        if (raw.error) {
          showToast(`⚠ GitHub: ${raw.error}`);
          ghResult = null; // score = 0, but error is visible
        } else {
          ghResult = raw;
          showToast(`✅ GitHub @${ghUser}: ${ghResult.publicRepos} repos · ${ghResult.totalStars}⭐ · Score: ${ghResult.score}%`);
        }
      } catch(e) {
        showToast(`❌ GitHub fetch failed: ${e.message}`);
      }
    } else if (form.gh) {
      // URL provided but username not parseable
      showToast("⚠ Could not parse GitHub username from URL. Check the format: https://github.com/username");
    }

    // ══ PIPELINE 3: LINKEDIN — show modal if URL provided ═════════
    pending.current = { resumeScore, nlpData, ghResult, exp, resumeError };

    if (form.li && extractLinkedInHandle(form.li)) {
      setStep("💼 Opening LinkedIn 11-question assessment…");
      setLoading(false);
      setShowLiModal(true);
      return; // continues in afterLinkedIn()
    } else if (form.li && !extractLinkedInHandle(form.li)) {
      showToast("⚠ Could not parse LinkedIn handle from URL. Check format: https://linkedin.com/in/yourname");
    }

    // No LinkedIn URL — finish immediately with liScore = 0
    await finishSubmit(0, null);
  }

  // ─── After LinkedIn modal answered ─────────────────────────────
  async function afterLinkedIn(liAnswers) {
    setShowLiModal(false);
    setLoading(true);
    setStep("💼 Scoring LinkedIn answers…");
    const sc  = (form.skills||"").split(",").filter(Boolean).length;
    const exp = pending.current?.exp ?? 0;
    const { score: liScore, breakdown: liBreakdown } = scoreLinkedIn(liAnswers, exp, sc);
    showToast(`✅ LinkedIn scored: ${liScore}% (from 11-question assessment)`);
    await finishSubmit(liScore, liBreakdown);
  }

  async function skipLinkedIn() {
    setShowLiModal(false);
    setLoading(true);
    showToast("ℹ LinkedIn skipped — score set to 0");
    await finishSubmit(0, null);
  }

  // ─── Assemble all scores + save ───────────────────────────────
  async function finishSubmit(liScore, liBreakdown) {
    const { resumeScore, nlpData, ghResult, exp } = pending.current || {};
    const ghScore = (ghResult && !ghResult.error) ? ghResult.score : 0;

    // Weighted overall — identical formula to AnalyzerPage
    const liW = liScore > 0 ? 0.30 : 0;
    const ghW = ghScore > 0 ? 0.30 : 0;
    const rsW = 1 - liW - ghW;
    const overall = Math.round((resumeScore||0)*rsW + liScore*liW + ghScore*ghW);

    const scores = { resume: resumeScore||0, linkedin: liScore, github: ghScore, overall };

    setStep("💾 Saving application…");
    try {
      if (backendOnline) {
        await submitApplication({
          company_id:     co.id,
          name:           form.name,
          email:          form.email,
          phone:          form.phone,
          experience:     exp,
          skills:         form.skills,
          linkedin:       form.li,
          github:         form.gh,
          cover:          form.cover,
          // ── Send the real NLP/GitHub/LinkedIn scores ──
          // Backend will store these directly — no re-scoring
          resume_score:   scores.resume,
          linkedin_score: scores.linkedin,
          github_score:   scores.github,
          overall_score:  scores.overall,
        });
        showToast("✅ Application saved to database!");
      } else {
        await new Promise(r=>setTimeout(r,400));
        showToast(`✅ Submitted to ${co.name}!`);
      }

      onApplicationSubmit(co.id, {
        name:form.name, email:form.email, phone:form.phone,
        experience:exp, skills:form.skills, li:form.li, gh:form.gh, cover:form.cover,
        scores:{resume:scores.resume, linkedin:scores.linkedin, github:scores.github},
        overall:scores.overall, status:"new",
        applied:new Date().toISOString().split("T")[0],
      });

      setSuccess({
        ...scores, saved:backendOnline, nlpData, ghData:ghResult, liBreakdown,
        resumeMethod: nlpData
          ? (nlpData.method?.includes("Browser") ? "Browser NLP" : "NLP — TF-IDF backend")
          : "Heuristic (no file uploaded)",
      });
      // filledCount auto-updates because applicants state in App.js is updated by onApplicationSubmit
    } catch(e) {
      showToast("❌ " + (e.message||"Submission failed"));
    }
    setStep(""); setLoading(false);
  }

  // ─── JSX ─────────────────────────────────────────────────────────
  return (
    <div className="page active pw" style={{animation:"fadeIn 0.35s ease"}}>
      {showLiModal && <LinkedInModal onSubmit={afterLinkedIn} onClose={skipLinkedIn}/>}

      <div className="job-detail-wrap">
        <div className="back-link" onClick={()=>setPage("careers")}>← Back to Companies</div>

        {/* Company header */}
        <div className="jd-header">
          <div className="jd-logo">{co.emoji}</div>
          <div>
            <div className="jd-co-name">{co.name}</div>
            <div className="jd-meta">
              <span className="jd-chip">📍 {co.location}</span>
              <span className="jd-chip">🏢 {co.sector}</span>
              <span className="jd-chip blue">💰 {co.package}</span>
              <span className="jd-chip green">✅ {remain} seats</span>
            </div>
            <div style={{marginTop:"0.7rem",fontSize:"0.82rem",color:"var(--muted2)",lineHeight:1.6}}>
              {co.desc}<br/>
              <strong style={{color:"var(--text)"}}>Open Roles:</strong> {co.roles.join(" · ")}
            </div>
          </div>
        </div>

        {/* Seat bar */}
        <div className="jd-slots">
          <div>
            <h3 style={{fontFamily:"Clash Display,sans-serif",fontSize:"0.85rem",fontWeight:600,color:"#a5b4fc",marginBottom:"0.2rem"}}>Seat Availability</h3>
            <div style={{fontSize:"0.75rem",color:"var(--muted2)"}}>{filledCount} applied of {co.vacancies} seats</div>
          </div>
          <div className="slots-bar-wrap">
            <div className="slots-bar-track"><div className="slots-bar-fill" style={{width:`${barWidth}%`}}></div></div>
            <div style={{fontSize:"0.75rem",color:"var(--muted)",marginTop:"0.3rem"}}>
              {remain>5?"🟢 Good availability":remain>2?"🟡 Filling fast!":"🔴 Almost full!"}
            </div>
          </div>
          <div className="slots-count">{remain}<span style={{fontSize:"0.75rem",color:"var(--muted)",fontWeight:400}}> / {co.vacancies}</span></div>
        </div>

        {success ? (
          /* ── Success Card ──────────────────────────────────────── */
          <div className="success-card">
            <div className="success-ico">🎉</div>
            <div className="success-title">Application Submitted!</div>
            <div className="success-sub" style={{marginBottom:"1rem"}}>
              Applied to <strong>{co.name}</strong> — {success.saved?"saved to database":"submitted locally"}
            </div>

            {/* 4 score boxes */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:"0.5rem",marginBottom:"1rem"}}>
              {[
                ["📄 Resume",  success.resume,  success.resumeMethod,       "#a5b4fc"],
                ["🔗 LinkedIn",success.linkedin, success.linkedin>0?"11-question form":"Not provided","#60a5fa"],
                ["🐙 GitHub",  success.github,  success.github>0?"Live API":"Not provided",           "#34d399"],
                ["⭐ Overall", success.overall, "Weighted average",                                   "#fbbf24"],
              ].map(([label,val,method,color])=>(
                <div key={label} style={{background:"rgba(255,255,255,0.03)",border:"1px solid rgba(255,255,255,0.08)",
                  borderRadius:10,padding:"0.6rem 0.3rem",textAlign:"center"}}>
                  <div style={{fontSize:"0.63rem",color:"var(--muted2)",marginBottom:"0.2rem"}}>{label}</div>
                  <div style={{fontSize:"1.3rem",fontWeight:700,color}}>{val}%</div>
                  <div style={{fontSize:"0.57rem",color:"var(--muted)",marginTop:"0.1rem",lineHeight:1.3}}>{method}</div>
                </div>
              ))}
            </div>

            {/* NLP resume breakdown */}
            {success.nlpData && (
              <div style={{background:"rgba(99,102,241,0.07)",border:"1px solid rgba(99,102,241,0.2)",
                borderRadius:10,padding:"0.8rem",marginBottom:"0.75rem",textAlign:"left"}}>
                <div style={{fontSize:"0.72rem",fontWeight:600,color:"#a5b4fc",marginBottom:"0.45rem"}}>
                  📄 Resume NLP — {success.nlpData.filename || "uploaded file"}
                  <span style={{marginLeft:"0.5rem",fontSize:"0.62rem",color:"var(--muted)",fontWeight:400}}>
                    via {success.nlpData.method}
                  </span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:"0.3rem",fontSize:"0.7rem",color:"var(--muted2)",marginBottom:"0.5rem"}}>
                  <div>📝 <strong style={{color:"var(--text)"}}>{success.nlpData.word_count}</strong> words extracted</div>
                  <div>🛠 <strong style={{color:"var(--text)"}}>{success.nlpData.skill_count}</strong> skills found</div>
                  <div>🎯 Best role: <strong style={{color:"var(--text)"}}>{success.nlpData.best_match_role}</strong></div>
                  <div>📊 TF-IDF sim: <strong style={{color:"var(--text)"}}>{((success.nlpData.best_similarity||0)*100).toFixed(1)}%</strong></div>
                </div>
                {/* Score breakdown table */}
                {success.nlpData.score_breakdown && (
                  <div style={{display:"grid",gridTemplateColumns:"1fr auto auto",gap:"0.15rem 0.5rem",
                    fontSize:"0.66rem",marginBottom:"0.5rem",borderTop:"1px solid var(--line2)",paddingTop:"0.4rem"}}>
                    {[
                      ["🛠 Skills",     success.nlpData.score_breakdown.skills_pts,    40],
                      ["📏 Length",     success.nlpData.score_breakdown.length_pts,    20],
                      ["🔗 TF-IDF",     success.nlpData.score_breakdown.tfidf_pts,     25],
                      ["💼 Experience", success.nlpData.score_breakdown.exp_pts,       10],
                      ["🗂 Diversity",  success.nlpData.score_breakdown.diversity_pts,  5],
                    ].map(([lbl,pts,max])=>(
                      <React.Fragment key={lbl}>
                        <span style={{color:"var(--muted2)"}}>{lbl}</span>
                        <span style={{color:"var(--text)",fontWeight:600,textAlign:"right"}}>{pts}</span>
                        <span style={{color:"var(--muted)"}}>/ {max}</span>
                      </React.Fragment>
                    ))}
                    <span style={{color:"#a5b4fc",fontWeight:700,borderTop:"1px solid var(--line2)",paddingTop:"0.2rem"}}>Total</span>
                    <span style={{color:"#a5b4fc",fontWeight:700,textAlign:"right",borderTop:"1px solid var(--line2)",paddingTop:"0.2rem"}}>{success.nlpData.score_breakdown.total||success.nlpData.resume_score}</span>
                    <span style={{color:"var(--muted)",borderTop:"1px solid var(--line2)",paddingTop:"0.2rem"}}>/ 95</span>
                  </div>
                )}
                {/* Skills chips */}
                <div style={{display:"flex",flexWrap:"wrap",gap:"0.25rem"}}>
                  {(success.nlpData.skills_found||[]).slice(0,18).map(sk=>(
                    <span key={sk} style={{background:"rgba(99,102,241,0.12)",border:"1px solid rgba(99,102,241,0.25)",
                      borderRadius:4,padding:"0.1rem 0.4rem",fontSize:"0.63rem",color:"#a5b4fc"}}>{sk}</span>
                  ))}
                  {(success.nlpData.skills_found||[]).length>18 &&
                    <span style={{fontSize:"0.63rem",color:"var(--muted)"}}>+{success.nlpData.skills_found.length-18} more</span>}
                </div>
              </div>
            )}

            {/* GitHub live data */}
            {success.ghData && !success.ghData.error && (
              <div style={{background:"rgba(16,185,129,0.05)",border:"1px solid rgba(16,185,129,0.18)",
                borderRadius:10,padding:"0.7rem",marginBottom:"0.75rem",textAlign:"left"}}>
                <div style={{fontSize:"0.72rem",fontWeight:600,color:"var(--mint)",marginBottom:"0.4rem"}}>
                  🐙 GitHub Live Data — @{success.ghData.username}
                  <span style={{marginLeft:"0.5rem",fontSize:"0.62rem",color:"var(--muted)",fontWeight:400}}>via api.github.com</span>
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:"0.3rem",fontSize:"0.7rem",color:"var(--muted2)"}}>
                  <div>📦 <strong style={{color:"var(--text)"}}>{success.ghData.publicRepos}</strong> repos</div>
                  <div>⭐ <strong style={{color:"var(--text)"}}>{success.ghData.totalStars}</strong> stars</div>
                  <div>🍴 <strong style={{color:"var(--text)"}}>{success.ghData.totalForks}</strong> forks</div>
                  <div>👥 <strong style={{color:"var(--text)"}}>{success.ghData.followers}</strong> followers</div>
                  <div>🌐 <strong style={{color:"var(--text)"}}>{success.ghData.languages?.length||0}</strong> languages</div>
                  <div>🕐 <strong style={{color:"var(--text)"}}>{success.ghData.recentlyActive}</strong> active</div>
                </div>
                {success.ghData.languages?.length>0 && (
                  <div style={{marginTop:"0.4rem",fontSize:"0.67rem",color:"var(--muted)"}}>
                    {success.ghData.languages.join(" · ")}
                  </div>
                )}
              </div>
            )}

            {/* LinkedIn breakdown */}
            {success.liBreakdown && success.linkedin > 0 && (
              <div style={{background:"rgba(59,130,246,0.05)",border:"1px solid rgba(59,130,246,0.18)",
                borderRadius:10,padding:"0.7rem",marginBottom:"0.75rem",textAlign:"left"}}>
                <div style={{fontSize:"0.72rem",fontWeight:600,color:"#60a5fa",marginBottom:"0.4rem"}}>
                  🔗 LinkedIn Score Breakdown — {success.linkedin}%
                </div>
                <div style={{display:"grid",gridTemplateColumns:"1fr auto",gap:"0.2rem 0.5rem",fontSize:"0.67rem"}}>
                  {Object.entries(success.liBreakdown).map(([k,v])=>(
                    <React.Fragment key={k}>
                      <span style={{color:"var(--muted2)",textTransform:"capitalize"}}>{k.replace(/([A-Z])/g," $1")}</span>
                      <span style={{color:v>0?"#60a5fa":"var(--muted)",fontWeight:600,textAlign:"right"}}>{v} pts</span>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            )}

            <div style={{fontSize:"0.8rem",color:"var(--mint)",marginBottom:"1rem"}}>
              ✅ Now visible in Recruiter Dashboard
            </div>
            <div style={{display:"flex",gap:"0.75rem",justifyContent:"center"}}>
              <button className="btn-analyze" style={{maxWidth:200}} onClick={()=>setPage("careers")}>Browse More Jobs</button>
              <button className="btn-analyze" style={{maxWidth:220,background:"linear-gradient(135deg,#6366f1,#3b82f6)"}} onClick={()=>setPage("recruiter")}>View in Recruiter →</button>
            </div>
          </div>

        ) : (
          /* ── Application Form ──────────────────────────────────── */
          <div className="apply-form-card">
            <div className="af-title">Apply Now</div>
            <div className="af-sub">Fill in your details. All 3 scores (Resume · GitHub · LinkedIn) are calculated on submit.</div>

            <div className="af-grid2">
              <div className="fg"><div className="flabel">Full Name *</div>
                <input className="finput" value={form.name} onChange={set("name")} placeholder="Arjun Sharma"/></div>
              <div className="fg"><div className="flabel">Email *</div>
                <input className="finput" type="email" value={form.email} onChange={set("email")} placeholder="arjun@email.com"/></div>
            </div>
            <div className="af-grid2">
              <div className="fg"><div className="flabel">Phone *</div>
                <input className="finput" value={form.phone} onChange={set("phone")} placeholder="+91 98765 43210"/></div>
              <div className="fg">
                <div className="flabel">Experience</div>
                <select className="finput" value={form.exp} onChange={set("exp")}>
                  <option value="" disabled>Select experience</option>
                  <option value="0">🌱 Fresher (0 years)</option>
                  {[1,2,3,4,5,6,7,8,9,10,12,15,20].map(y=>
                    <option key={y} value={y}>{y}{y===20?"+":""} year{y!==1?"s":""}</option>)}
                </select>
              </div>
            </div>
            <div className="af-grid2">
              <div className="fg">
                <div className="flabel">LinkedIn URL</div>
                <input className="finput" value={form.li} onChange={set("li")} placeholder="https://linkedin.com/in/your-name"/>
                {form.li && extractLinkedInHandle(form.li) && (
                  <div style={{fontSize:"0.7rem",color:"var(--mint)",marginTop:"0.25rem"}}>
                    ✅ Valid LinkedIn URL — 11-question assessment opens automatically after Submit
                  </div>
                )}
                {form.li && !extractLinkedInHandle(form.li) && (
                  <div style={{fontSize:"0.7rem",color:"var(--rose)",marginTop:"0.25rem"}}>
                    ⚠ Invalid URL format. Use: https://linkedin.com/in/yourname
                  </div>
                )}
                {!form.li && (
                  <div style={{fontSize:"0.68rem",color:"var(--muted)",marginTop:"0.2rem"}}>
                    Optional — 11-question self-assessment will open after Submit
                  </div>
                )}
              </div>
              <div className="fg">
                <div className="flabel">GitHub URL</div>
                <input className="finput" value={form.gh} onChange={set("gh")} placeholder="https://github.com/username"/>
                {form.gh && extractGithubUsername(form.gh) && (
                  <div style={{fontSize:"0.7rem",color:"var(--mint)",marginTop:"0.25rem"}}>
                    ✅ Valid GitHub URL — live data fetched from api.github.com on Submit
                  </div>
                )}
                {form.gh && !extractGithubUsername(form.gh) && (
                  <div style={{fontSize:"0.7rem",color:"var(--rose)",marginTop:"0.25rem"}}>
                    ⚠ Invalid URL format. Use: https://github.com/username
                  </div>
                )}
                {!form.gh && (
                  <div style={{fontSize:"0.68rem",color:"var(--muted)",marginTop:"0.2rem"}}>
                    Optional — repos, stars, activity fetched live from GitHub API
                  </div>
                )}
              </div>
            </div>
            <div className="af-grid1">
              <div className="fg"><div className="flabel">Key Skills</div>
                <input className="finput" value={form.skills} onChange={set("skills")} placeholder="React, Node.js, Python, AWS…"/></div>
            </div>
            <div className="af-grid1">
              <div className="fg">
                <div className="flabel">
                  Resume (PDF/DOCX)
                  {backendOnline
                    ? <span style={{color:"var(--mint)",fontSize:"0.68rem",marginLeft:"0.4rem"}}>← PyPDF2 + TF-IDF NLP</span>
                    : <span style={{color:"#a5b4fc",fontSize:"0.68rem",marginLeft:"0.4rem"}}>← pdf.js browser NLP</span>}
                </div>
                <div className="upload-area">
                  <input type="file" accept=".pdf,.doc,.docx,.txt" onChange={e=>{
                    const f=e.target.files[0]; if(f){setFileName(f.name);setResumeFile(f);}
                  }}/>
                  <div className="upload-txt">
                    <strong>Drop resume here</strong> or click to browse
                    {backendOnline
                      ? <div style={{fontSize:"0.7rem",color:"var(--mint)",marginTop:"0.25rem"}}>🟢 Backend online — PDF/DOCX parsed with PyPDF2 + TF-IDF NLP</div>
                      : <div style={{fontSize:"0.7rem",color:"#a5b4fc",marginTop:"0.25rem"}}>🔵 PDF analysed in browser using pdf.js (no backend needed)</div>}
                    <div style={{fontSize:"0.67rem",color:"var(--muted)",marginTop:"0.15rem"}}>DOCX requires backend · TXT works in both modes</div>
                  </div>
                  {fileName && <div className="file-ok">✓ {fileName} {resumeFile&&`(${(resumeFile.size/1024).toFixed(1)} KB)`}</div>}
                </div>
              </div>
            </div>
            <div className="af-grid1">
              <div className="fg" style={{marginBottom:0}}>
                <div className="flabel">Cover Note</div>
                <textarea className="finput ftarea" value={form.cover} onChange={set("cover")} placeholder="Briefly explain why you're a great fit…"/>
              </div>
            </div>

            {/* Scoring explanation */}
            <div style={{marginTop:"1rem",padding:"0.8rem 0.9rem",background:"rgba(99,102,241,0.05)",
              border:"1px solid rgba(99,102,241,0.12)",borderRadius:10,fontSize:"0.72rem",
              color:"var(--muted2)",lineHeight:1.8}}>
              <div style={{fontWeight:600,color:"var(--text)",marginBottom:"0.3rem"}}>🔍 How your 3 scores are calculated on Submit</div>
              <div>📄 <strong>Resume</strong> — {backendOnline
                ? "PyPDF2 extracts text → clean_text() → extract_skills() → TF-IDF vs 7 JDs → score formula"
                : "pdf.js reads PDF in browser → keyword matching → same score formula"}</div>
              <div>🐙 <strong>GitHub</strong> — Live fetch from <code>api.github.com</code> → repos, stars, forks, languages, activity → real score</div>
              <div>🔗 <strong>LinkedIn</strong> — 11-question self-assessment modal opens automatically after Submit if URL is provided</div>
              <div style={{color:"var(--muted)",marginTop:"0.2rem",fontSize:"0.67rem"}}>
                ⚠ GitHub and LinkedIn scores are 0 if the URL is not provided
              </div>
            </div>

            <div style={{marginTop:"1.25rem"}}>
              <button className="btn-apply" onClick={submit} disabled={loading}>
                {loading
                  ? <><span className="spin"></span> {step||"Processing…"}</>
                  : "Submit Application →"}
              </button>
            </div>
          </div>
        )}
        <Footer setPage={setPage}/>
      </div>
    </div>
  );
}
