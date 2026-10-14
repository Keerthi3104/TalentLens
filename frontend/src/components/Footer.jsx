// src/components/Footer.jsx
import React from 'react';

export default function Footer({ setPage }) {
  return (
    <footer className="site-footer">
      <div className="footer-top">
        <div>
          <div className="footer-brand-logo">🎯 TalentLens</div>
          <div className="footer-brand-desc">AI-powered career intelligence platform helping professionals land their dream jobs at top IT companies across India.</div>
          <div className="footer-social">
            <span className="footer-social-btn">💼</span>
            <span className="footer-social-btn">🐦</span>
            <span className="footer-social-btn">🐙</span>
          </div>
        </div>
        <div>
          <div className="footer-col-title fc-blue">Features</div>
          <div className="footer-links">
            <span className="footer-link" onClick={() => setPage("analyzer")}>⚡ Score Analyzer</span>
            <span className="footer-link" onClick={() => setPage("careers")}>🏢 Job Listings</span>
            <span className="footer-link" onClick={() => setPage("recruiter")}>📊 Recruiter Dashboard</span>
            <span className="footer-link">🤖 AI Resume Builder <span className="soon-tag">Soon</span></span>
          </div>
        </div>
        <div>
          <div className="footer-col-title fc-purple">Resources</div>
          <div className="footer-links">
            <span className="footer-link">📖 About TalentLens</span>
            <span className="footer-link">❓ FAQ</span>
            <span className="footer-link">🔒 Privacy Policy</span>
          </div>
        </div>
        <div>
          <div className="footer-col-title fc-amber">Created By</div>
          <div className="footer-contact-item"><span>🎓</span><span>Final Year Project</span></div>
          <div className="footer-contact-item"><span>👩‍💻</span><span>Sivasakthi K</span></div>
          <div className="footer-contact-item"><span>👩‍💻</span><span>Janani C</span></div>
          <div className="footer-contact-item"><span>👩‍💻</span><span>Keerthika K</span></div>
          <div className="footer-contact-item"><span>👩‍💻</span><span>Keerthika R</span></div>
          <div className="footer-contact-item"><span>🏛</span><span>Annamalai University</span></div>
          <div className="footer-contact-item"><span>📍</span><span>Chidambaram, Cuddalore Dist</span></div>
        </div>
      </div>
      <div className="footer-bottom">
        <div className="footer-copy">© 2025 TalentLens. Made with <span style={{color:"var(--rose)"}}>♥</span> in India.</div>
        <div className="footer-policy-links">
          <span className="footer-policy-link">Privacy Policy</span>
          <span className="footer-policy-link">Terms of Service</span>
        </div>
      </div>
    </footer>
  );
}
