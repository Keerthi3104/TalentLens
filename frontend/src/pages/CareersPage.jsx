// src/pages/CareersPage.jsx
import React, { useState } from "react";
import { COMPANIES } from "../data/companies";
import Footer from "../components/Footer";

export default function CareersPage({ setPage, setCurrentCompany, applicants }) {
  const [filter, setFilter] = useState("all");
  const list = filter === "all" ? COMPANIES : COMPANIES.filter(c => c.type === filter);

  function openJob(co) {
    setCurrentCompany(co);
    setPage("job");
  }

  // Derive actual filled count from applicants state (accurate, not stale hardcoded value)
  function getRemain(co) {
    const filled = applicants ? (applicants[co.id] || []).length : co.filled;
    return Math.max(0, co.vacancies - filled);
  }

  return (
    <div className="page active pw" style={{animation:"fadeIn 0.35s ease"}}>
      <div className="careers-hero">
        <div className="hero-chip">🏢 Top IT Companies Hiring Now</div>
        <h1>Find Your Dream Job</h1>
        <p>Explore openings at India&apos;s leading IT companies. Limited seats — apply before they fill up.</p>
        <div className="filter-bar">
          {["all","product","service","mnc","startup"].map(t => (
            <div key={t} className={`filter-chip ${filter===t?"on":""}`} onClick={() => setFilter(t)}>
              {t.charAt(0).toUpperCase()+t.slice(1)}{t==="all"?" Companies":""}
            </div>
          ))}
        </div>
      </div>

      <div className="companies-grid">
        {list.map(co => {
          const remain = getRemain(co);
          return (
            <div className="company-card" key={co.id} onClick={() => openJob(co)}>
              <div className="cc-banner" style={{background:`linear-gradient(to right,${co.c1},${co.c2})`}}></div>
              <div className="cc-body">
                <div className="cc-top">
                  <div className="cc-logo">{co.emoji}</div>
                  <div>
                    <div className="cc-name">{co.name}</div>
                    <div className="cc-sector">{co.sector} · {co.location}</div>
                  </div>
                </div>
                <div className="cc-stats">
                  <div className="cc-stat"><div className="cc-stat-val" style={{color:co.c1}}>{co.vacancies}</div><div className="cc-stat-lbl">Total Seats</div></div>
                  <div className="cc-stat"><div className="cc-stat-val" style={{color:"#f59e0b"}}>{remain}</div><div className="cc-stat-lbl">Remaining</div></div>
                  <div className="cc-stat"><div className="cc-stat-val">{co.package}</div><div className="cc-stat-lbl">Package</div></div>
                </div>
                <div className="vacancy-badge">{remain} seats left</div>
                <div className="cc-roles">
                  {co.roles.slice(0,4).map(r => <span key={r} className="role-pill">{r}</span>)}
                  {co.roles.length > 4 && <span className="role-pill">+{co.roles.length-4}</span>}
                </div>
              </div>
              <div className="cc-footer">
                <span className="cc-footer-txt">{co.desc.slice(0,42)}…</span>
                <button className="view-jobs-btn">View & Apply →</button>
              </div>
            </div>
          );
        })}
      </div>
      <Footer setPage={setPage} />
    </div>
  );
}
