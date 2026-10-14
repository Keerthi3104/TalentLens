// src/App.js
import React, { useState } from "react";
import "./index.css";
import { useBackend } from "./hooks/useBackend";
import { useToast } from "./hooks/useToast";
import { COMPANIES } from "./data/companies";
import Navbar from "./components/Navbar";
import AnalyzerPage from "./pages/AnalyzerPage";
import CareersPage from "./pages/CareersPage";
import JobPage from "./pages/JobPage";
import RecruiterPage from "./pages/RecruiterPage";

// ── Seed demo data (shown when backend is offline)
const SEED = {
  tcs: [
    { name:"Priya Venkat",  email:"priya@mail.com",   phone:"9876543210", experience:4, skills:"React, Node.js, AWS",        li:"https://linkedin.com/in/priyavenkat",  gh:"https://github.com/priyav",  cover:"Passionate full-stack developer.", scores:{resume:88,linkedin:82,github:91}, overall:87, status:"shortlisted", applied:"2024-01-15" },
    { name:"Karthik Rajan", email:"karthik@mail.com",  phone:"9876543211", experience:3, skills:"Python, Django, PostgreSQL", li:"https://linkedin.com/in/karthikrajan",gh:"https://github.com/karthikr",cover:"Backend engineer.",                 scores:{resume:75,linkedin:68,github:80}, overall:74, status:"reviewed",    applied:"2024-01-16" },
    { name:"Sneha Pillai",  email:"sneha@mail.com",    phone:"9876543212", experience:2, skills:"Vue.js, Laravel, MySQL",     li:"",                                     gh:"https://github.com/snehap",  cover:"Frontend developer.",              scores:{resume:65,linkedin:72,github:60}, overall:66, status:"new",         applied:"2024-01-17" },
    { name:"Dev Kumar",     email:"dev@mail.com",      phone:"9876543213", experience:5, skills:"Java, Spring Boot, Kafka",   li:"https://linkedin.com/in/devkumar",     gh:"https://github.com/devkumar", cover:"Senior Java engineer.",           scores:{resume:91,linkedin:85,github:88}, overall:88, status:"new",         applied:"2024-01-18" },
  ],
  hcl: [
    { name:"Ananya Rathi",  email:"ananya@mail.com",   phone:"9876543214", experience:3, skills:"Angular, .NET, Azure",       li:"https://linkedin.com/in/ananyarathi", gh:"",                           cover:"Full stack developer.",            scores:{resume:78,linkedin:74,github:70}, overall:74, status:"new",         applied:"2024-01-15" },
    { name:"Rahul Sharma",  email:"rahul@mail.com",    phone:"9876543215", experience:6, skills:"Kubernetes, Docker, CI/CD",  li:"https://linkedin.com/in/rahulsharma", gh:"https://github.com/rahuls",  cover:"DevOps engineer.",                 scores:{resume:85,linkedin:80,github:92}, overall:86, status:"new",         applied:"2024-01-16" },
  ],
};

// Initialize empty lists for all companies
const initialApplicants = {};
COMPANIES.forEach(c => { initialApplicants[c.id] = SEED[c.id] || []; });

function App() {
  const [page, setPage] = useState("analyzer");
  const [currentCompany, setCurrentCompany] = useState(null);
  // ✅ SHARED APPLICANTS STATE — JobPage writes here, RecruiterPage reads from here
  const [applicants, setApplicants] = useState(initialApplicants);
  const { backendOnline, checking } = useBackend();
  const { toast, showToast } = useToast();

  function navigate(p) { setPage(p); window.scrollTo(0, 0); }

  // Called by JobPage after a successful application
  function onApplicationSubmit(companyId, newApplicant) {
    setApplicants(prev => {
      const existing = prev[companyId] || [];
      // Prevent duplicates by email
      if (existing.find(a => a.email === newApplicant.email)) return prev;
      return { ...prev, [companyId]: [...existing, newApplicant] };
    });
  }

  // ── Derive filled count from actual applicants array (not static companies.js value)
  // This ensures remaining seats always reflects the real number of applications
  function getFilledCount(companyId) {
    return (applicants[companyId] || []).length;
  }

  return (
    <>
      <Navbar page={page} setPage={navigate} backendOnline={backendOnline} checking={checking} />
      {page === "analyzer"  && <AnalyzerPage  backendOnline={backendOnline} setPage={navigate} showToast={showToast} />}
      {page === "careers"   && <CareersPage   setPage={navigate} setCurrentCompany={setCurrentCompany} applicants={applicants} />}
      {page === "job"       && (
        <JobPage
          co={currentCompany}
          backendOnline={backendOnline}
          setPage={navigate}
          showToast={showToast}
          onApplicationSubmit={onApplicationSubmit}
          applicants={applicants}
        />
      )}
      {page === "recruiter" && (
        <RecruiterPage
          backendOnline={backendOnline}
          setPage={navigate}
          showToast={showToast}
          applicants={applicants}
          setApplicants={setApplicants}
        />
      )}
      {toast && <div className="toast">{toast}</div>}
    </>
  );
}

export default App;
