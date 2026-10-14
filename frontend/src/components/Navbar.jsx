// src/components/Navbar.jsx
import React from 'react';

export default function Navbar({ page, setPage, backendOnline, checking }) {
  return (
    <nav>
      <div className="nav-logo" onClick={() => setPage('analyzer')}>TalentLens</div>
      <div className="nav-links">
        <span
          className="backend-indicator"
          style={{ color: checking ? 'var(--muted)' : backendOnline ? 'var(--mint)' : 'var(--rose)' }}
        >
          {checking ? '⏳ Checking…' : backendOnline ? '🟢 FastAPI :8000' : '🔴 Backend Offline — local mode'}
        </span>
        <button className={`nav-btn ${page==='analyzer'?'active':''}`} onClick={() => setPage('analyzer')}>Score Analyzer</button>
        <button className={`nav-btn ${page==='careers'?'active':''}`}  onClick={() => setPage('careers')}>Careers</button>
        <button className={`nav-btn ${page==='recruiter'?'active':''}`} onClick={() => setPage('recruiter')}>Recruiter</button>
        <button className="nav-cta" onClick={() => setPage('careers')}>Browse Jobs →</button>
      </div>
    </nav>
  );
}
