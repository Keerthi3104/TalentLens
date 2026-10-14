// src/api/talentlens.js
const API_BASE = 'http://127.0.0.1:8000/api';

export async function checkHealth() {
  const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(5000) });
  return res.ok;
}

export async function scoreProfile(data) {
  const res = await fetch(`${API_BASE}/analyzer/score`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Score API failed');
  return res.json();
}

export async function submitApplication(payload) {
  const res = await fetch(`${API_BASE}/applicants/apply`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company_id:     payload.company_id,
      name:           payload.name,
      email:          payload.email,
      phone:          payload.phone,
      experience:     payload.experience,
      skills:         payload.skills,
      linkedin_url:   payload.linkedin || "",
      github_url:     payload.github   || "",
      cover:          payload.cover    || "",
      // ── Pre-computed NLP scores from frontend pipelines ──
      // If provided, backend stores these directly — no re-scoring
      resume_score:   payload.resume_score   ?? null,
      linkedin_score: payload.linkedin_score ?? null,
      github_score:   payload.github_score   ?? null,
      overall_score:  payload.overall_score  ?? null,
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || 'Application failed');
  return data;
}

export async function fetchApplicants(companyId) {
  const res = await fetch(`${API_BASE}/applicants/${companyId}`);
  if (!res.ok) throw new Error('Failed to load applicants');
  return res.json(); // { applicants, count }
}

export async function updateStatus(applicantId, status) {
  const res = await fetch(`${API_BASE}/applicants/${applicantId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error('Status update failed');
  return res.json();
}

export async function clearApplicants(companyId) {
  const res = await fetch(`${API_BASE}/applicants/${companyId}/clear`, { method: 'DELETE' });
  if (!res.ok) throw new Error('Clear failed');
  return res.json();
}

// ── Resume File Analysis (real NLP backend) ──────────────────────────────
export async function analyzeResumeFile(file, exp = 0, name = "") {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("exp",  String(exp));
  formData.append("name", name);

  const res = await fetch(`${API_BASE}/resume/analyze`, {
    method: "POST",
    body:   formData,   // NO Content-Type header — browser sets multipart boundary
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.detail || "Resume analysis failed");
  return data;
}

export async function checkResumeLibraries() {
  const res = await fetch(`${API_BASE}/resume/status`);
  return res.json();
}
