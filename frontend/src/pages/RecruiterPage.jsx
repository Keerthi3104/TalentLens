// src/pages/RecruiterPage.jsx
import React, { useState } from "react";
import { COMPANIES } from "../data/companies";
import { fetchApplicants, updateStatus, clearApplicants } from "../api/talentlens";
import EmailModal from "../components/EmailModal";
import Footer from "../components/Footer";

const aiRecords = {};

function buildEmail(ap, co, decision) {
  const isSelected = decision === "shortlisted";
  if (isSelected) {
    const subject = `🎉 Congratulations! You've been Shortlisted — ${co.name}`;
    const body = `Dear ${ap.name},\n\nWe are delighted to inform you that your application to <strong>${co.name}</strong> has been reviewed and you have been <strong>shortlisted</strong> for the next stage of our recruitment process.\n\n📊 Your Profile Scores:\n  • Resume Score   : ${ap.scores.resume}%\n  • LinkedIn Score : ${ap.scores.linkedin}%\n  • GitHub Score   : ${ap.scores.github}%\n  • Overall Score  : ${ap.overall}%\n\nOur HR team will reach out within 3–5 business days with interview details.\n\nCongratulations!\n\nBest regards,\nTalent Acquisition Team\n${co.name}`;
    return { subject, body };
  } else {
    const subject = `Your Application Update — ${co.name}`;
    const body = `Dear ${ap.name},\n\nThank you for applying to <strong>${co.name}</strong>.\n\nAfter careful consideration, we regret to inform you that we will not be moving forward at this time.\n\n📊 Your Profile Scores:\n  • Resume Score   : ${ap.scores.resume}%\n  • LinkedIn Score : ${ap.scores.linkedin}%\n  • GitHub Score   : ${ap.scores.github}%\n  • Overall Score  : ${ap.overall}%\n\nWe wish you the very best in your career journey.\n\nBest regards,\nTalent Acquisition Team\n${co.name}`;
    return { subject, body };
  }
}

export default function RecruiterPage({ backendOnline, showToast, setPage, applicants, setApplicants }) {
  const [activeCo, setActiveCo] = useState(COMPANIES[0]);
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState("overall");
  const [sortDir, setSortDir] = useState(-1);
  const [emailPending, setEmailPending] = useState(null);
  const [clearedSnaps, setClearedSnaps] = useState({});
  const [showClearModal, setShowClearModal] = useState(false);
  const [refreshed, setRefreshed] = useState({});

  async function selectCo(co) {
    setActiveCo(co);
    setSearch("");
    // Refresh from backend when switching tabs (once per session)
    if (backendOnline && !refreshed[co.id]) {
      try {
        const res = await fetchApplicants(co.id);
        setApplicants(prev => ({ ...prev, [co.id]: res.applicants }));
        setRefreshed(prev => ({ ...prev, [co.id]: true }));
        showToast(`📦 Loaded ${res.count} applicants from database`);
      } catch {}
    }
  }

  function getList() {
    const q = search.toLowerCase();
    const src = applicants[activeCo.id] || [];
    let list = q
      ? src.filter(a =>
          a.name.toLowerCase().includes(q) ||
          a.email.toLowerCase().includes(q) ||
          (a.skills || "").toLowerCase().includes(q))
      : [...src];

    const fm = { name:"name", experience:"experience", resume:"scores.resume", linkedin:"scores.linkedin", github:"scores.github", overall:"overall" };
    const key = fm[sortField] || sortField;
    list.sort((a, b) => {
      const av = key.includes(".") ? a[key.split(".")[0]][key.split(".")[1]] : a[key];
      const bv = key.includes(".") ? b[key.split(".")[0]][key.split(".")[1]] : b[key];
      return (typeof av === "string" ? av.localeCompare(bv) : (av - bv)) * sortDir;
    });
    return list;
  }

  function sort(field) {
    if (sortField === field) setSortDir(d => d * -1);
    else { setSortField(field); setSortDir(-1); }
  }

  async function decide(ap, decision) {
    // Update in shared state immediately (optimistic)
    setApplicants(prev => ({
      ...prev,
      [activeCo.id]: (prev[activeCo.id] || []).map(a =>
        a.email === ap.email ? { ...a, status: decision } : a
      )
    }));
    // Persist to backend if online — use ap.id (integer) not email
    if (backendOnline && ap.id) {
      try { await updateStatus(ap.id, decision); } catch {}
    }
    const { subject, body } = buildEmail({ ...ap, status: decision }, activeCo, decision);
    setEmailPending({ ap: { ...ap, status: decision }, co: activeCo, subject, body, decision });
  }

  async function doClear() {
    const id = activeCo.id;
    setClearedSnaps(prev => ({ ...prev, [id]: applicants[id] || [] }));
    setApplicants(prev => ({ ...prev, [id]: [] }));
    setShowClearModal(false);
    if (backendOnline) { try { await clearApplicants(id); } catch {} }
    showToast(`🗑 ${activeCo.name} applicant list cleared.`);
  }

  function restore(coId) {
    setApplicants(prev => ({ ...prev, [coId]: clearedSnaps[coId] || [] }));
    setClearedSnaps(prev => { const n = {...prev}; delete n[coId]; return n; });
    showToast(`↩ Restored ${(clearedSnaps[coId] || []).length} applicants`);
  }

  function exportCSV() {
    const data = applicants[activeCo.id] || [];
    if (!data.length) { showToast("ℹ No applicants to export."); return; }
    const headers = ["Name","Email","Phone","Experience","Skills","Resume%","LinkedIn%","GitHub%","Overall%","Status","LinkedIn URL","Applied"];
    const rows = data.map(a => [
      a.name, a.email, a.phone || "", a.experience, a.skills || "",
      a.scores.resume, a.scores.linkedin, a.scores.github,
      a.overall, a.status, a.li || a.linkedin_url || "", a.applied || a.applied_at || ""
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    const a = document.createElement("a"); a.href = url;
    a.download = `${activeCo.name}_applicants.csv`; a.click();
    URL.revokeObjectURL(url);
    showToast(`⬇ Exported ${data.length} applicants`);
  }

  function generateRecord(ap) {
    const key = ap.email;
    const level = ap.experience===0?"Fresher":ap.experience>=5?"Senior":ap.experience>=3?"Mid-level":"Junior";
    const expLabel = ap.experience===0?"as a fresher":`with ${ap.experience} yr${ap.experience!==1?"s":""} of exp`;
    const skills = (ap.skills||"").split(",").slice(0,3).map(s=>s.trim()).join(", ");
    const strength = ap.overall>=80?"strong across all dimensions":ap.overall>=65?"solid technical foundation":"growing skill profile";
    aiRecords[key] = `${level} professional ${expLabel}, skilled in ${skills||"various technologies"}. Shows a ${strength} with overall score ${ap.overall}%.`;
    setApplicants(prev => ({ ...prev })); // trigger re-render
  }

  const isCleared = !!clearedSnaps[activeCo.id] && (applicants[activeCo.id] || []).length === 0;
  const filtered = getList();

  // ── Derive filled count from ACTUAL applicants — never use hardcoded companies.js value
  const actualFilled   = (applicants[activeCo.id] || []).length;
  const actualRemaining = Math.max(0, activeCo.vacancies - actualFilled);
  const fillPct         = Math.min(100, Math.round((actualFilled / activeCo.vacancies) * 100));

  const statusMap   = { new:"sb-new", reviewed:"sb-reviewed", shortlisted:"sb-shortlisted", rejected:"sb-rej" };
  const statusLabel = { new:"New", reviewed:"Reviewed", shortlisted:"Shortlisted", rejected:"Rejected" };

  return (
    <div className="page active pw" style={{animation:"fadeIn 0.35s ease"}}>
      <div className="recruiter-wrap">
        <div className="rec-header">
          <div>
            <div className="rec-title">Recruiter Dashboard</div>
            <div className="rec-sub">Review and rank applicants by AI-scored profile quality</div>
          </div>
          <div style={{display:"flex",gap:"0.6rem",alignItems:"center"}}>
            <button className="btn-export" onClick={exportCSV}>⬇ Export CSV</button>
            <button className="btn-clear" onClick={() => setShowClearModal(true)}>🗑 Clear Page</button>
          </div>
        </div>

        <div className="company-selector">
          {COMPANIES.map(co => (
            <button
              key={co.id}
              className={`co-sel-btn ${activeCo.id===co.id?"active":""}`}
              onClick={() => selectCo(co)}
            >
              {co.emoji} {co.name}
              <span style={{background:"rgba(99,102,241,0.15)",borderRadius:5,padding:"0.1rem 0.4rem",fontSize:"0.68rem",marginLeft:"0.3rem"}}>
                {(applicants[co.id]||[]).length}
              </span>
            </button>
          ))}
        </div>

        <div className="table-wrap">
          {/* ── Live seat stats bar ── */}
          <div style={{display:"flex",alignItems:"center",gap:"1.5rem",padding:"0.85rem 1.2rem",background:"rgba(99,102,241,0.05)",borderBottom:"1px solid var(--line2)",flexWrap:"wrap"}}>
            <div style={{display:"flex",gap:"1.2rem",flex:1,flexWrap:"wrap"}}>
              <div style={{fontSize:"0.78rem",color:"var(--muted2)"}}>
                <span style={{fontWeight:600,color:"var(--text)",fontSize:"1.1rem"}}>{activeCo.vacancies}</span>
                <span style={{marginLeft:"0.3rem"}}>total seats</span>
              </div>
              <div style={{fontSize:"0.78rem",color:"var(--muted2)"}}>
                <span style={{fontWeight:600,color:"#6366f1",fontSize:"1.1rem"}}>{actualFilled}</span>
                <span style={{marginLeft:"0.3rem"}}>applications received</span>
              </div>
              <div style={{fontSize:"0.78rem",color:"var(--muted2)"}}>
                <span style={{fontWeight:600,color:actualRemaining===0?"var(--rose)":actualRemaining<=3?"var(--amber)":"var(--mint)",fontSize:"1.1rem"}}>{actualRemaining}</span>
                <span style={{marginLeft:"0.3rem"}}>seats remaining</span>
              </div>
            </div>
            <div style={{display:"flex",flexDirection:"column",gap:"0.3rem",minWidth:180}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:"0.7rem",color:"var(--muted)"}}>
                <span>Fill rate</span>
                <span style={{fontWeight:600,color:"var(--text)"}}>{fillPct}%</span>
              </div>
              <div style={{height:6,background:"var(--line2)",borderRadius:4,overflow:"hidden"}}>
                <div style={{
                  height:"100%",borderRadius:4,
                  width:`${fillPct}%`,
                  background: fillPct>=90?"var(--rose)":fillPct>=60?"var(--amber)":"#6366f1",
                  transition:"width 0.5s ease"
                }}/>
              </div>
            </div>
            <div style={{fontSize:"0.72rem",color:actualRemaining===0?"var(--rose)":actualRemaining<=3?"var(--amber)":"var(--mint)",fontWeight:600}}>
              {actualRemaining===0?"🔴 Fully filled":actualRemaining<=3?"🟡 Almost full":"🟢 Accepting applications"}
            </div>
          </div>
          <div className="table-toolbar">
            <div className="table-toolbar-left">
              Applicants <span className="tcount">{filtered.length}</span>
            </div>
            <input
              className="table-search"
              placeholder="Search name, skills…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          {isCleared ? (
            <div className="empty-table-state">
              <div className="empty-table-ico">📭</div>
              <div className="empty-table-title">Applicant list cleared</div>
              <div className="empty-table-sub">All {activeCo.name} applicants have been removed.</div>
              {(clearedSnaps[activeCo.id]||[]).length > 0 && (
                <button className="btn-restore" onClick={() => restore(activeCo.id)}>
                  ↩ Undo — Restore {clearedSnaps[activeCo.id].length} applicants
                </button>
              )}
            </div>
          ) : (
            <div style={{overflowX:"auto",overflowY:"visible",borderRadius:"0 0 20px 20px"}}>
              <table>
                <thead>
                  <tr>
                    <th onClick={()=>sort("name")}>Candidate ↕</th>
                    <th onClick={()=>sort("experience")}>Exp ↕</th>
                    <th onClick={()=>sort("resume")}>Resume ↕</th>
                    <th onClick={()=>sort("linkedin")}>LinkedIn ↕</th>
                    <th onClick={()=>sort("github")}>GitHub ↕</th>
                    <th onClick={()=>sort("overall")}>Overall ↕</th>
                    <th style={{minWidth:120}}>LinkedIn</th>
                    <th style={{minWidth:120}}>AI Record</th>
                    <th>Status</th>
                    <th style={{minWidth:150}}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.length === 0 ? (
                    <tr>
                      <td colSpan="10" style={{textAlign:"center",padding:"2.5rem",color:"var(--muted)"}}>
                        No applicants yet. Apply via Careers → company page.
                      </td>
                    </tr>
                  ) : filtered.map(ap => {
                    const rs=ap.scores.resume, ls=ap.scores.linkedin, gs=ap.scores.github;
                    const st = ap.status || "new";
                    const sc = v => v>=80?"sp-high":v>=60?"sp-mid":"sp-low";
                    const rec = aiRecords[ap.email];
                    const liUrl = ap.li || ap.linkedin_url || "";
                    return (
                      <tr key={ap.email}>
                        <td>
                          <div className="td-name">{ap.name}</div>
                          <div className="td-email">{ap.email}</div>
                          <div style={{fontSize:"0.7rem",color:"var(--muted)",marginTop:"0.2rem"}}>📞 {ap.phone||"—"}</div>
                        </td>
                        <td>
                          {ap.experience===0
                            ? <span style={{color:"var(--mint)",fontSize:"0.75rem",fontWeight:600}}>🌱 Fresher</span>
                            : `${ap.experience} yr${ap.experience!==1?"s":""}`}
                        </td>
                        <td><span className={`score-pill ${sc(rs)}`}>{rs}%</span></td>
                        <td><span className={`score-pill ${sc(ls)}`}>{ls}%</span></td>
                        <td><span className={`score-pill ${sc(gs)}`}>{gs}%</span></td>
                        <td>
                          <div className="overall-bar-wrap">
                            <div className="overall-bar-track">
                              <div className="overall-bar-fill" style={{width:`${ap.overall}%`}}></div>
                            </div>
                            <div className="overall-num">{ap.overall}%</div>
                          </div>
                        </td>
                        <td>
                          {liUrl
                            ? <a className="li-link" href={liUrl} target="_blank" rel="noreferrer">🔗 View Profile</a>
                            : <span className="li-none">Not provided</span>}
                        </td>
                        <td>
                          <div className="record-cell" style={{maxWidth:160}}>
                            {rec
                              ? <div className="record-text">{rec}</div>
                              : <span className="record-gen" onClick={()=>generateRecord(ap)}>✨ Generate AI Record</span>}
                          </div>
                        </td>
                        <td>
                          <span className={`status-badge ${statusMap[st]||"sb-new"}`}>
                            {statusLabel[st]||"New"}
                          </span>
                        </td>
                        <td className="td-action">
                          <button className={`btn-select ${st==="shortlisted"?"selected":""}`} onClick={()=>decide(ap,"shortlisted")}>
                            {st==="shortlisted"?"✓ Selected":"✔ Select"}
                          </button>
                          <button className={`btn-reject ${st==="rejected"?"rejected":""}`} onClick={()=>decide(ap,"rejected")}>
                            {st==="rejected"?"✕ Rejected":"✖ Reject"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showClearModal && (
        <div className="modal-overlay" onClick={e=>e.target===e.currentTarget&&setShowClearModal(false)}>
          <div className="modal-box" style={{maxWidth:420,textAlign:"center"}}>
            <div style={{fontSize:"3rem",marginBottom:"1rem"}}>🗑</div>
            <div className="modal-title">Clear Applicant List?</div>
            <div style={{color:"var(--muted2)",fontSize:"0.85rem",margin:"0.5rem 0 1.5rem",lineHeight:1.6}}>
              This will remove all <strong style={{color:"var(--text)"}}>{(applicants[activeCo.id]||[]).length} {activeCo.name}</strong> applicants.<br/>
              <span style={{color:"var(--rose)",fontSize:"0.78rem"}}>Cannot be undone (unless you use Undo).</span>
            </div>
            <div style={{display:"flex",gap:"0.75rem",justifyContent:"center"}}>
              <button className="btn-cancel-modal" style={{flex:1}} onClick={()=>setShowClearModal(false)}>Cancel</button>
              <button className="btn-send-mail btn-send-rejected" style={{flex:1}} onClick={doClear}>Yes, Clear All</button>
            </div>
          </div>
        </div>
      )}

      {emailPending && (
        <EmailModal
          pending={emailPending}
          onClose={() => setEmailPending(null)}
          onSent={() => setEmailPending(null)}
          showToast={showToast}
        />
      )}

      <Footer setPage={setPage}/>
    </div>
  );
}
