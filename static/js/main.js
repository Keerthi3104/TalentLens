// ══════════════════════════════════════════════════════════════
//  TalentLens — main.js
//  File: static/js/main.js
//
//  Final Year Project
//  Sivasakthi K · Janani C · Keerthika K · Keerthika R
//  Annamalai University, Chidambaram
// ══════════════════════════════════════════════════════════════

// ── Flask backend base URL
const API_BASE = 'http://127.0.0.1:5000/api';
let backendOnline = false;

// ── Check if Flask backend is running
async function checkBackend() {
  try {
    const res = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(2500) });
    if (res.ok) {
      backendOnline = true;
      const el = document.getElementById('backendIndicator');
      if (el) { el.textContent = '🟢 Flask Backend Connected'; el.style.color = 'var(--mint)'; }
      console.log('[TalentLens] ✅ Flask backend connected');
    }
  } catch (e) {
    backendOnline = false;
    const el = document.getElementById('backendIndicator');
    if (el) { el.textContent = '🔴 Backend Offline (local mode)'; el.style.color = 'var(--rose)'; }
    console.warn('[TalentLens] ⚠ Flask backend not running. Start with: python app.py');
  }
}

// ══════════════════════════════════════════════════════════════
//  COMPANIES DATA
// ══════════════════════════════════════════════════════════════
const COMPANIES = [
  { id:'tcs',       name:'TCS',            emoji:'🔵', sector:'Services', type:'service', vacancies:20, filled:8,  c1:'#1a73e8',c2:'#0d47a1', roles:['Backend Dev','Frontend Dev','QA Engineer','DevOps','BA'],              location:'Pan India',              package:'5–18 LPA', desc:'India\'s largest IT company with global delivery centers.' },
  { id:'hcl',       name:'HCL Technologies',emoji:'🟢', sector:'Services', type:'service', vacancies:15, filled:5,  c1:'#43a047',c2:'#1b5e20', roles:['Full Stack Dev','Cloud Engineer','Data Analyst','Java Dev'],           location:'Noida, Chennai, Pune',   package:'4–16 LPA', desc:'Global technology company with strong engineering focus.' },
  { id:'infosys',   name:'Infosys',         emoji:'🟣', sector:'Services', type:'service', vacancies:25, filled:10, c1:'#7c3aed',c2:'#4c1d95', roles:['React Developer','Node.js Dev','Python Dev','QA','Scrum Master'],      location:'Bangalore, Hyderabad',   package:'4–20 LPA', desc:'Global leader in consulting, technology & outsourcing.' },
  { id:'wipro',     name:'Wipro',           emoji:'🟡', sector:'Services', type:'service', vacancies:12, filled:3,  c1:'#f59e0b',c2:'#b45309', roles:['Angular Dev','AWS Architect','DBA','Business Analyst'],               location:'Bangalore, Mumbai',      package:'4–15 LPA', desc:'IT, consulting and business process services company.' },
  { id:'zoho',      name:'Zoho Corporation',emoji:'🔴', sector:'Product',  type:'product', vacancies:8,  filled:2,  c1:'#ef4444',c2:'#991b1b', roles:['SDE-1','SDE-2','Mobile Dev','UI/UX Engineer'],                        location:'Chennai, Tenkasi',       package:'6–22 LPA', desc:'Product-first company building world-class SaaS products.' },
  { id:'freshworks',name:'Freshworks',      emoji:'🟠', sector:'Product',  type:'product', vacancies:10, filled:4,  c1:'#f97316',c2:'#c2410c', roles:['Frontend Engineer','Backend Engineer','Data Engineer','PM'],           location:'Chennai, San Mateo',     package:'8–30 LPA', desc:'Customer engagement software with global scale.' },
  { id:'ibm',       name:'IBM India',       emoji:'🔷', sector:'MNC',     type:'mnc',     vacancies:18, filled:7,  c1:'#1d4ed8',c2:'#1e3a8a', roles:['Cloud Dev','AI Engineer','Cybersecurity','DevOps','SAP'],              location:'Bangalore, Pune, Delhi', package:'6–25 LPA', desc:'Global tech leader in AI, Cloud and Quantum computing.' },
  { id:'accenture', name:'Accenture',       emoji:'🟤', sector:'MNC',     type:'mnc',     vacancies:30, filled:15, c1:'#7c3aed',c2:'#9333ea', roles:['Mulesoft Dev','Salesforce Dev','Java Dev','React Dev','Analyst'],       location:'Pan India',              package:'4–22 LPA', desc:'Global professional services company across industries.' },
];

// In-memory applicant store (seeded from Flask DB on load)
const APPLICANTS = {};
COMPANIES.forEach(c => APPLICANTS[c.id] = []);

// Demo seed data (used when Flask offline)
APPLICANTS['tcs'] = [
  { name:'Priya Venkat',  email:'priya@mail.com',   phone:'9876543210', experience:4, skills:'React, Node.js, AWS',       li:'https://linkedin.com/in/priyavenkat',  gh:'https://github.com/priyav',   cover:'Passionate full-stack developer.',  scores:{resume:88,linkedin:82,github:91}, overall:87, status:'shortlisted', applied:'2024-01-15' },
  { name:'Karthik Rajan', email:'karthik@mail.com', phone:'9876543211', experience:3, skills:'Python, Django, PostgreSQL', li:'https://linkedin.com/in/karthikrajan', gh:'https://github.com/karthikr', cover:'Backend engineer.',                 scores:{resume:75,linkedin:68,github:80}, overall:74, status:'reviewed',    applied:'2024-01-16' },
  { name:'Sneha Pillai',  email:'sneha@mail.com',   phone:'9876543212', experience:2, skills:'Vue.js, Laravel, MySQL',     li:'',                                      gh:'https://github.com/snehap',   cover:'Frontend developer.',               scores:{resume:65,linkedin:72,github:60}, overall:66, status:'new',         applied:'2024-01-17' },
  { name:'Dev Kumar',     email:'dev@mail.com',     phone:'9876543213', experience:5, skills:'Java, Spring Boot, Kafka',   li:'https://linkedin.com/in/devkumar',     gh:'https://github.com/devkumar', cover:'Senior Java engineer.',             scores:{resume:91,linkedin:85,github:88}, overall:88, status:'new',         applied:'2024-01-18' },
];
APPLICANTS['hcl'] = [
  { name:'Ananya Rathi', email:'ananya@mail.com', phone:'9876543214', experience:3, skills:'Angular, .NET, Azure',      li:'https://linkedin.com/in/ananyarathi', gh:'',                            cover:'Full stack developer.',  scores:{resume:78,linkedin:74,github:70}, overall:74, status:'new', applied:'2024-01-15' },
  { name:'Rahul Sharma', email:'rahul@mail.com',  phone:'9876543215', experience:6, skills:'Kubernetes, Docker, CI/CD', li:'https://linkedin.com/in/rahulsharma', gh:'https://github.com/rahuls', cover:'DevOps engineer.',       scores:{resume:85,linkedin:80,github:92}, overall:86, status:'new', applied:'2024-01-16' },
];

let currentCompany    = null;
let activeRecruiterCo = null;
let tableData         = [];
let sortField         = 'overall';
let sortDir           = -1;
const aiRecords       = {};
const clearedSnapshots = {};

// ══════════════════════════════════════════════════════════════
//  NAVIGATION
// ══════════════════════════════════════════════════════════════
function goTo(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
  const pg = document.getElementById('pg-' + page);
  if (pg) pg.classList.add('active');
  const nb = document.getElementById('nb-' + page);
  if (nb) nb.classList.add('active');
  window.scrollTo(0, 0);
  if (page === 'careers')   renderCompanies('all');
  if (page === 'recruiter') renderRecruiter();
}

// ══════════════════════════════════════════════════════════════
//  PAGE 1 — SCORE ANALYZER
// ══════════════════════════════════════════════════════════════
function onFileChange(inp) {
  if (inp.files[0]) {
    document.getElementById('fileName').textContent = inp.files[0].name;
    document.getElementById('fileOk').style.display = 'block';
    document.getElementById('uploadArea').style.borderColor = 'var(--mint)';
  }
}

async function runAnalysis() {
  const name  = document.getElementById('a-name').value;
  const email = document.getElementById('a-email').value;
  if (!name || !email) { toast('⚠ Please fill in at least name and email.'); return; }

  const btn = document.getElementById('analyzeBtn');
  btn.innerHTML = '<span class="spin"></span>Analysing…'; btn.disabled = true;

  const data = {
    name, email,
    phone:   document.getElementById('a-phone').value,
    exp:     document.getElementById('a-exp').value || '0',
    li:      document.getElementById('a-li').value,
    gh:      document.getElementById('a-gh').value,
    skills:  document.getElementById('a-skills').value,
    summary: document.getElementById('a-summary').value,
  };

  let result;
  try {
    if (backendOnline) {
      // ── Call Flask backend /api/score
      const res = await fetch(`${API_BASE}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      result = await res.json();
      toast('✅ Scored by Python Flask backend 🐍');
    } else {
      result = heuristicScore(data);
    }
  } catch (e) {
    result = heuristicScore(data);
  }

  renderAnalysis(result);
  btn.innerHTML = '✓ Re-Analyse'; btn.disabled = false;
}

function heuristicScore(data) {
  const exp        = parseInt(data.exp) || 0;
  const isFresher  = exp === 0;
  const skillList  = (data.skills || '').split(',').filter(Boolean);
  const sc         = skillList.length;
  const rs         = Math.min(95, 45 + exp*4 + sc*2 + (data.summary ? 5 : 0) + (isFresher ? 5 : 0));
  const li         = Math.min(90, 58 + Math.floor(Math.random()*18));
  const gh         = Math.min(93, 60 + Math.floor(Math.random()*20));
  const liScore    = data.li ? li : 18;
  const ghScore    = data.gh ? gh : 15;

  return {
    scores:  { resume: rs, linkedin: liScore, github: ghScore },
    overall: Math.round((rs + liScore + ghScore) / 3),
    roleFit: [
      { name:'Business Analyst',     percent: Math.max(0, Math.min(100, rs - 8)) },
      { name:'Backend Developer',    percent: Math.max(0, Math.min(100, ghScore + 12)) },
      { name:'Frontend Developer',   percent: Math.max(0, Math.min(100, ghScore + 8)) },
      { name:'Full Stack Developer', percent: Math.max(0, Math.min(100, (rs + ghScore) >> 1)) },
      { name:'QA / Tester',          percent: Math.max(0, Math.min(100, rs - 18)) },
      { name:'DevOps Engineer',      percent: Math.max(0, Math.min(100, ghScore - 5)) },
      { name:'Data Engineer',        percent: Math.max(0, Math.min(100, rs - 15)) },
    ],
    suggestions: [
      data.li ? 'Add 3–5 quantified achievements to your LinkedIn experience.' : '⚠ LinkedIn URL missing — a complete profile increases recruiter visibility by 3×.',
      data.gh ? 'Pin your top repositories and write descriptive READMEs.' : '⚠ GitHub URL missing — add public projects to prove coding ability to recruiters.',
      sc < 6 ? 'Expand skills list to 8–12 entries covering languages, frameworks, tools and cloud platforms.' : 'Great skill breadth! Group them by category for better ATS parsing.',
      isFresher ? '🌱 As a fresher, highlight academic projects, internships, hackathons and certifications prominently.' : exp < 3 ? 'Supplement experience with open-source contributions or freelance projects.' : 'Restructure experience bullets using STAR format: Situation → Task → Action → Result.',
      'Ensure your resume passes ATS: use standard headings, avoid columns/tables, and save as PDF.',
    ]
  };
}

const RING_COLORS    = { resume: '#6366f1', linkedin: '#3b82f6', github: '#10b981' };
const ROLE_GRADIENTS = [
  'linear-gradient(to right,#6366f1,#818cf8)',
  'linear-gradient(to right,#3b82f6,#60a5fa)',
  'linear-gradient(to right,#10b981,#34d399)',
  'linear-gradient(to right,#f59e0b,#fcd34d)',
  'linear-gradient(to right,#f43f5e,#fb7185)',
  'linear-gradient(to right,#8b5cf6,#a78bfa)',
  'linear-gradient(to right,#06b6d4,#22d3ee)',
];

function renderAnalysis(r) {
  const sc = r.scores;
  document.getElementById('scoreContent').innerHTML = `
    <div class="scores-trio">
      ${['resume','linkedin','github'].map(k => {
        const v = sc[k], c = RING_COLORS[k], circ = 2 * Math.PI * 30;
        return `<div class="score-ring-card">
          <div class="ring-wrap">
            <svg class="ring-svg" width="72" height="72" viewBox="0 0 72 72">
              <circle class="ring-bg" cx="36" cy="36" r="30"/>
              <circle class="ring-fill" cx="36" cy="36" r="30" stroke="${c}"
                stroke-dasharray="${circ}" stroke-dashoffset="${circ}" id="ring-${k}"
                style="transition:stroke-dashoffset 1.2s ease"/>
            </svg>
            <div class="ring-val" style="color:${c}" id="rval-${k}">0%</div>
          </div>
          <div class="ring-name">${k.charAt(0).toUpperCase()+k.slice(1)}</div>
        </div>`;
      }).join('')}
    </div>`;

  setTimeout(() => {
    ['resume','linkedin','github'].forEach(k => {
      const v = sc[k], circ = 2 * Math.PI * 30;
      document.getElementById('ring-'+k).style.strokeDashoffset = circ - (v/100)*circ;
      animCount(document.getElementById('rval-'+k), 0, v, '%', 1100);
    });
  }, 80);

  document.getElementById('roleContent').innerHTML = r.roleFit.map((role, i) => `
    <div class="role-bar">
      <div class="rb-head"><span class="rb-name">${role.name}</span><span class="rb-pct" id="rp-${i}">0%</span></div>
      <div class="rb-track"><div class="rb-fill" id="rb-${i}" style="background:${ROLE_GRADIENTS[i%ROLE_GRADIENTS.length]}"></div></div>
    </div>`).join('');

  setTimeout(() => {
    r.roleFit.forEach((role, i) => {
      document.getElementById('rb-'+i).style.width = role.percent + '%';
      animCount(document.getElementById('rp-'+i), 0, role.percent, '%', 1200);
    });
  }, 120);

  document.getElementById('sugContent').innerHTML = r.suggestions.map(s =>
    `<div class="sug-item"><div class="sug-dot"></div><div>${s}</div></div>`).join('');
}

function animCount(el, from, to, suffix, dur) {
  const start = performance.now();
  const update = now => {
    const p = Math.min((now - start) / dur, 1);
    el.textContent = Math.round(from + (to - from) * p) + suffix;
    if (p < 1) requestAnimationFrame(update);
  };
  requestAnimationFrame(update);
}

// ══════════════════════════════════════════════════════════════
//  PAGE 2 — CAREERS
// ══════════════════════════════════════════════════════════════
function renderCompanies(filter) {
  const list = filter === 'all' ? COMPANIES : COMPANIES.filter(c => c.type === filter);
  document.getElementById('companiesGrid').innerHTML = list.map(c => {
    const remain = c.vacancies - c.filled;
    return `<div class="company-card" onclick="openJob('${c.id}')" data-type="${c.type}">
      <div class="cc-banner" style="--c1:${c.c1};--c2:${c.c2}"></div>
      <div class="cc-body">
        <div class="cc-top">
          <div class="cc-logo">${c.emoji}</div>
          <div><div class="cc-name">${c.name}</div><div class="cc-sector">${c.sector} · ${c.location}</div></div>
        </div>
        <div class="cc-stats">
          <div class="cc-stat"><div class="cc-stat-val" style="color:${c.c1}">${c.vacancies}</div><div class="cc-stat-lbl">Total Seats</div></div>
          <div class="cc-stat"><div class="cc-stat-val" style="color:#f59e0b">${remain}</div><div class="cc-stat-lbl">Remaining</div></div>
          <div class="cc-stat"><div class="cc-stat-val">${c.package}</div><div class="cc-stat-lbl">Package</div></div>
        </div>
        <div class="vacancy-badge">${remain} seats left</div>
        <div class="cc-roles">${c.roles.slice(0,4).map(r=>`<span class="role-pill">${r}</span>`).join('')}${c.roles.length>4?`<span class="role-pill">+${c.roles.length-4}</span>`:''}</div>
      </div>
      <div class="cc-footer">
        <span class="cc-footer-txt">${c.desc.slice(0,42)}…</span>
        <button class="view-jobs-btn">View & Apply →</button>
      </div>
    </div>`;
  }).join('');
}

function filterCo(type, el) {
  document.querySelectorAll('.filter-chip').forEach(c => c.classList.remove('on'));
  el.classList.add('on');
  renderCompanies(type);
}

// ══════════════════════════════════════════════════════════════
//  PAGE 3 — JOB DETAIL & APPLY
// ══════════════════════════════════════════════════════════════
function openJob(id) {
  currentCompany = COMPANIES.find(c => c.id === id);
  if (!currentCompany) return;
  const co     = currentCompany;
  const remain = co.vacancies - co.filled;
  const pct    = Math.round((co.filled / co.vacancies) * 100);

  document.getElementById('jdHeader').innerHTML = `
    <div class="jd-logo">${co.emoji}</div>
    <div>
      <div class="jd-co-name">${co.name}</div>
      <div class="jd-meta">
        <span class="jd-chip">📍 ${co.location}</span>
        <span class="jd-chip">🏢 ${co.sector}</span>
        <span class="jd-chip blue">💰 ${co.package}</span>
        <span class="jd-chip green">✅ ${remain} seats available</span>
      </div>
      <div style="margin-top:0.7rem;font-size:0.82rem;color:var(--muted2);line-height:1.6">${co.desc}<br>
        <strong style="color:var(--text)">Open Roles:</strong> ${co.roles.join(' · ')}
      </div>
    </div>`;

  document.getElementById('jdSlots').innerHTML = `
    <div class="slots-info"><h3>Seat Availability</h3><div style="font-size:0.75rem;color:var(--muted2)">${co.filled} filled of ${co.vacancies} total</div></div>
    <div class="slots-bar-wrap">
      <div class="slots-bar-track"><div class="slots-bar-fill" style="width:0" id="slotBarFill"></div></div>
      <div class="slots-txt">${remain > 5 ? '🟢 Good availability' : remain > 2 ? '🟡 Filling fast!' : '🔴 Almost full!'}</div>
    </div>
    <div class="slots-count">${remain}<span> / ${co.vacancies}</span></div>`;

  setTimeout(() => { document.getElementById('slotBarFill').style.width = pct + '%'; }, 100);

  ['ap-name','ap-email','ap-phone','ap-exp','ap-li','ap-gh','ap-skills','ap-cover'].forEach(id => {
    const el = document.getElementById(id); if (el) el.value = '';
  });
  document.getElementById('applyFormCard').style.display = 'block';
  document.getElementById('successCard').classList.remove('show');
  document.getElementById('applyBtn').innerHTML = 'Submit Application →';
  document.getElementById('applyBtn').disabled = false;
  document.getElementById('apFileOk').style.display = 'none';
  goTo('job');
}

function onApFileChange(inp) {
  if (inp.files[0]) {
    document.getElementById('apFileName').textContent = inp.files[0].name;
    document.getElementById('apFileOk').style.display = 'block';
    document.getElementById('apUploadArea').style.borderColor = 'var(--mint)';
  }
}

async function submitApplication() {
  const name  = document.getElementById('ap-name').value.trim();
  const email = document.getElementById('ap-email').value.trim();
  const phone = document.getElementById('ap-phone').value.trim();

  if (!name || !email || !phone) { toast('⚠ Name, email and phone are required.'); return; }
  if (!currentCompany) return;

  const co     = currentCompany;
  const remain = co.vacancies - co.filled;
  if (remain <= 0) { toast('❌ No seats remaining for this company.'); return; }

  const btn  = document.getElementById('applyBtn');
  btn.innerHTML = '<span class="spin"></span> Submitting…'; btn.disabled = true;

  const expVal   = document.getElementById('ap-exp').value;
  const exp      = expVal !== '' ? parseInt(expVal) : 0;
  const li       = document.getElementById('ap-li').value;
  const gh       = document.getElementById('ap-gh').value;
  const skills   = document.getElementById('ap-skills').value;
  const cover    = document.getElementById('ap-cover').value;

  if (backendOnline) {
    // ── POST to Flask /api/apply → scores + saves to SQLite DB
    try {
      const res  = await fetch(`${API_BASE}/apply`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ company_id: co.id, name, email, phone, experience: exp, skills, linkedin: li, github: gh, cover })
      });
      const data = await res.json();
      if (data.error) { toast('ℹ ' + data.error); btn.innerHTML = 'Submit Application →'; btn.disabled = false; return; }

      const ap = data.applicant;
      APPLICANTS[co.id].push({ name, email, phone, experience: exp, skills, li, gh, cover, scores: ap.scores, overall: ap.overall, status: 'new', applied: new Date().toISOString().split('T')[0], id: ap.id });
      co.filled++;

      document.getElementById('applyFormCard').style.display = 'none';
      document.getElementById('successCard').classList.add('show');
      document.getElementById('successMsg').innerHTML =
        `Application to <strong>${co.name}</strong> saved to database! 🐍<br>
        Resume ${ap.scores.resume}% · LinkedIn ${ap.scores.linkedin}% · GitHub ${ap.scores.github}%<br>
        Overall Score: <strong>${ap.overall}%</strong>`;
      toast('✅ Application saved to Flask database!');
    } catch (e) {
      submitLocalFallback(co, name, email, phone, exp, li, gh, skills, cover);
    }
  } else {
    // ── Offline: save locally
    setTimeout(() => submitLocalFallback(co, name, email, phone, exp, li, gh, skills, cover), 600);
  }

  btn.innerHTML = 'Submit Application →'; btn.disabled = false;
  document.getElementById('apFileOk').style.display = 'none';
}

function submitLocalFallback(co, name, email, phone, exp, li, gh, skills, cover) {
  const existing = APPLICANTS[co.id].findIndex(a => a.email === email);
  if (existing >= 0) { toast('ℹ You have already applied to ' + co.name); return; }

  const sc      = skills.split(',').filter(Boolean).length;
  const resumeS = Math.min(92, 48 + exp*4 + sc*2);
  const liS     = li ? Math.min(90, 58 + Math.floor(Math.random()*18)) : 20;
  const ghS     = gh ? Math.min(92, 60 + Math.floor(Math.random()*20)) : 18;
  const overall = Math.round((resumeS + liS + ghS) / 3);

  APPLICANTS[co.id].push({ name, email, phone, experience: exp, skills, li, gh, cover, scores:{ resume: resumeS, linkedin: liS, github: ghS }, overall, status:'new', applied: new Date().toISOString().split('T')[0] });
  co.filled++;

  document.getElementById('applyFormCard').style.display = 'none';
  document.getElementById('successCard').classList.add('show');
  document.getElementById('successMsg').innerHTML =
    `Application to <strong>${co.name}</strong> received!<br>
    Resume ${resumeS}% · LinkedIn ${liS}% · GitHub ${ghS}%<br>
    Overall Score: <strong>${overall}%</strong>`;
  toast('✅ Application submitted (local mode)!');
}

// ══════════════════════════════════════════════════════════════
//  PAGE 4 — RECRUITER DASHBOARD
// ══════════════════════════════════════════════════════════════
function renderRecruiter() {
  const sel = document.getElementById('recCompanySelector');
  sel.innerHTML = COMPANIES.map(c =>
    `<button class="co-sel-btn ${activeRecruiterCo?.id === c.id ? 'active' : ''}"
      onclick="selectRecruiterCo('${c.id}',this)">${c.emoji} ${c.name}
      <span style="background:rgba(99,102,241,0.15);border-radius:5px;padding:0.1rem 0.4rem;font-size:0.68rem;margin-left:0.3rem">${APPLICANTS[c.id]?.length || 0}</span>
    </button>`).join('');
  if (!activeRecruiterCo) activeRecruiterCo = COMPANIES[0];
  loadTableFor(activeRecruiterCo.id);
}

function selectRecruiterCo(id, el) {
  document.querySelectorAll('.co-sel-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  activeRecruiterCo = COMPANIES.find(c => c.id === id);
  loadTableFor(id);
}

async function loadTableFor(coId) {
  activeRecruiterCo = COMPANIES.find(c => c.id === coId);

  if (backendOnline) {
    // ── Load applicants from Flask SQLite database
    try {
      const res  = await fetch(`${API_BASE}/applicants/${coId}`);
      const data = await res.json();
      APPLICANTS[coId] = data.applicants;
    } catch (e) {
      console.warn('Could not load from backend, using local data');
    }
  }

  tableData = [...(APPLICANTS[coId] || [])].sort((a, b) => b.overall - a.overall);
  renderTable(tableData);

  // Update badge counts in selector
  document.querySelectorAll('.co-sel-btn').forEach((btn, i) => {
    const co    = COMPANIES[i];
    const badge = btn.querySelector('span');
    if (badge && co) badge.textContent = APPLICANTS[co.id]?.length || 0;
  });
}

function renderTable(data) {
  document.getElementById('appCount').textContent = data.length;
  const tbody = document.getElementById('appTbody');
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="10" style="text-align:center;padding:2.5rem;color:var(--muted)">No applicants yet for this company.</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(ap => {
    const rs      = ap.scores.resume, ls = ap.scores.linkedin, gs = ap.scores.github;
    const realIdx = APPLICANTS[activeRecruiterCo.id].findIndex(a => a.email === ap.email);
    const st      = ap.status || 'new';
    const statusMap   = { new:'sb-new', reviewed:'sb-reviewed', shortlisted:'sb-shortlisted', rejected:'sb-rej' };
    const statusLabel = { new:'New', reviewed:'Reviewed', shortlisted:'Shortlisted', rejected:'Rejected' };
    const isSelected  = st === 'shortlisted';
    const isRejected  = st === 'rejected';
    const liCell  = ap.li ? `<a class="li-link" href="${ap.li}" target="_blank">🔗 View Profile</a>` : `<span class="li-none">Not provided</span>`;
    const rec     = aiRecords[ap.email];
    const recCell = rec
      ? `<div class="record-cell"><div class="record-text">${rec}</div></div>`
      : `<div class="record-cell"><span class="record-gen" onclick="generateRecord('${ap.email}',${realIdx})">✨ Generate AI Record</span></div>`;

    return `<tr id="row-${ap.email.replace(/[@.]/g,'_')}">
      <td>
        <div class="td-name">${ap.name}</div>
        <div class="td-email">${ap.email}</div>
        <div style="font-size:0.7rem;color:var(--muted);margin-top:0.2rem">📞 ${ap.phone || '—'}</div>
      </td>
      <td>${ap.experience === 0 ? '<span style="color:var(--mint);font-size:0.75rem;font-weight:600">🌱 Fresher</span>' : `${ap.experience} yr${ap.experience!==1?'s':''}`}</td>
      <td><span class="score-pill ${rs>=80?'sp-high':rs>=60?'sp-mid':'sp-low'}">${rs}%</span></td>
      <td><span class="score-pill ${ls>=80?'sp-high':ls>=60?'sp-mid':'sp-low'}">${ls}%</span></td>
      <td><span class="score-pill ${gs>=80?'sp-high':gs>=60?'sp-mid':'sp-low'}">${gs}%</span></td>
      <td><div class="overall-bar-wrap"><div class="overall-bar-track"><div class="overall-bar-fill" style="width:${ap.overall}%"></div></div><div class="overall-num">${ap.overall}%</div></div></td>
      <td>${liCell}</td>
      <td>${recCell}</td>
      <td><span class="status-badge ${statusMap[st]||'sb-new'}">${statusLabel[st]||'New'}</span></td>
      <td class="td-action">
        <button class="btn-select ${isSelected?'selected':''}" onclick="decideCandidate('${activeRecruiterCo.id}',${realIdx},'shortlisted')">${isSelected?'✓ Selected':'✔ Select'}</button>
        <button class="btn-reject ${isRejected?'rejected':''}" onclick="decideCandidate('${activeRecruiterCo.id}',${realIdx},'rejected')">${isRejected?'✕ Rejected':'✖ Reject'}</button>
      </td>
    </tr>`;
  }).join('');
}

// ── Select / Reject candidate → open email modal
function decideCandidate(coId, idx, decision) {
  const ap = APPLICANTS[coId][idx];
  if (!ap) return;
  const co         = COMPANIES.find(c => c.id === coId);
  const isSelected = decision === 'shortlisted';

  APPLICANTS[coId][idx].status = decision;

  // ── Persist status to Flask DB
  if (backendOnline && ap.id) {
    fetch(`${API_BASE}/applicants/${ap.id}/status`, {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ status: decision })
    }).catch(e => console.warn('Status update failed:', e));
  }

  const subject = isSelected
    ? `🎉 Congratulations! You've been Shortlisted — ${co.name}`
    : `Your Application Update — ${co.name}`;

  const body = isSelected
    ? `Dear ${ap.name},\n\nWe are pleased to inform you that you have been shortlisted for ${co.name}!\n\n📊 Your Profile Scores:\n  • Resume Score   : ${ap.scores.resume}%\n  • LinkedIn Score : ${ap.scores.linkedin}%\n  • GitHub Score   : ${ap.scores.github}%\n  • Overall Score  : ${ap.overall}%\n\nOur HR team will contact you shortly with next steps.\n\nBest regards,\nTalent Acquisition Team\n${co.name}`
    : `Dear ${ap.name},\n\nThank you for applying to ${co.name}. After careful review, we will not be moving forward with your candidacy at this time.\n\n📊 Your Profile Scores:\n  • Resume Score   : ${ap.scores.resume}%\n  • LinkedIn Score : ${ap.scores.linkedin}%\n  • GitHub Score   : ${ap.scores.github}%\n  • Overall Score  : ${ap.overall}%\n\nWe wish you the best in your career journey.\n\nBest regards,\nTalent Acquisition Team\n${co.name}`;

  document.getElementById('modalTitle').textContent  = isSelected ? '✅ Send Selection Email' : '❌ Send Rejection Email';
  document.getElementById('modalSub').textContent    = `Preview email to ${ap.name} before sending`;
  document.getElementById('modalTo').textContent     = `${ap.name} <${ap.email}>`;
  document.getElementById('modalSubject').textContent = subject;
  document.getElementById('modalBody').innerHTML      = body.replace(/\n/g, '<br>');
  document.getElementById('modalActions').style.display = 'flex';

  const sendBtn = document.getElementById('modalSendBtn');
  sendBtn.className   = `btn-send-mail ${isSelected ? 'btn-send-selected' : 'btn-send-rejected'}`;
  sendBtn.textContent = isSelected ? '📧 Send Selection Email' : '📧 Send Rejection Email';

  window._pendingEmail = { coId, idx, decision, subject, body, ap, co };
  document.getElementById('emailModal').classList.add('open');
  loadTableFor(coId);
}

// ══════════════════════════════════════════════════════════════
//  EMAILJS
// ══════════════════════════════════════════════════════════════
const EJS_KEYS = { publicKey:'', serviceId:'', templateId:'', fromName:'TalentLens HR Team' };
let ejsInitialized = false;

function saveEjsConfig() {
  EJS_KEYS.publicKey  = document.getElementById('ejsPublicKey').value.trim();
  EJS_KEYS.serviceId  = document.getElementById('ejsServiceId').value.trim();
  EJS_KEYS.templateId = document.getElementById('ejsTemplateId').value.trim();
  EJS_KEYS.fromName   = document.getElementById('ejsFromName').value.trim() || 'TalentLens HR Team';
  if (!EJS_KEYS.publicKey || !EJS_KEYS.serviceId || !EJS_KEYS.templateId) { toast('⚠ Please fill in all three EmailJS fields.'); return; }
  emailjs.init({ publicKey: EJS_KEYS.publicKey });
  ejsInitialized = true;
  document.getElementById('ejsConfigStatus').style.display = 'inline';
  toast('✅ EmailJS configured! Real emails will now be sent.');
  setTimeout(() => toggleSetup(), 600);
}

function toggleSetup() {
  const panel   = document.getElementById('ejsSetupPanel');
  const showBtn = document.getElementById('showSetupToggle');
  const visible = panel.style.display !== 'none';
  panel.style.display   = visible ? 'none' : 'block';
  showBtn.style.display = visible ? 'inline' : 'none';
}

async function sendEmail() {
  const { ap, subject, body, co } = window._pendingEmail;
  document.getElementById('modalActions').style.display       = 'none';
  document.getElementById('emailPreviewSection').style.display = 'none';
  document.getElementById('sendingState').classList.add('show');

  const plainBody = body.replace(/<br>/g, '\n').replace(/<[^>]+>/g, '');

  if (ejsInitialized && EJS_KEYS.serviceId && EJS_KEYS.templateId) {
    try {
      await emailjs.send(EJS_KEYS.serviceId, EJS_KEYS.templateId, {
        to_email: ap.email, to_name: ap.name,
        from_name: EJS_KEYS.fromName || `${co.name} HR Team`,
        subject, message: plainBody, company: co.name, score: `${ap.overall}%`,
      });
      document.getElementById('sendingState').classList.remove('show');
      document.getElementById('sentSuccess').classList.add('show');
      document.getElementById('sentDetail').textContent = `Delivered to ${ap.email}`;
      setTimeout(() => { closeEmailModal(); toast(`📧 Email sent to ${ap.name}`); }, 2200);
    } catch (err) {
      document.getElementById('sendingState').classList.remove('show');
      document.getElementById('sentError').classList.add('show');
      document.getElementById('sentErrorDetail').innerHTML =
        `EmailJS Error: <strong>${err?.text || err?.message || 'Unknown'}</strong><br>Check your Service ID, Template ID and Public Key.`;
    }
  } else {
    await new Promise(r => setTimeout(r, 800));
    document.getElementById('sendingState').classList.remove('show');
    document.getElementById('sentError').classList.add('show');
    document.getElementById('sentErrorDetail').innerHTML =
      `EmailJS not configured yet.<br>Fill in your keys in the ⚙ setup section above and click Save Config.<br>
      Get free keys at <a href="https://www.emailjs.com" target="_blank" style="color:#60a5fa">emailjs.com</a>`;
  }
}

function closeEmailModal() {
  document.getElementById('emailModal').classList.remove('open');
  setTimeout(() => {
    document.getElementById('sendingState').classList.remove('show');
    document.getElementById('sentSuccess').classList.remove('show');
    document.getElementById('sentError').classList.remove('show');
    document.getElementById('emailPreviewSection').style.display = 'block';
    document.getElementById('modalActions').style.display = 'flex';
  }, 300);
}

document.getElementById('emailModal').addEventListener('click', e => { if (e.target === document.getElementById('emailModal')) closeEmailModal(); });
document.getElementById('clearModal').addEventListener('click', e => { if (e.target === document.getElementById('clearModal')) closeClearModal(); });

// ── AI Record Generation
async function generateRecord(email, idx) {
  const ap  = APPLICANTS[activeRecruiterCo.id][idx];
  if (!ap) return;
  const rowId = `row-${email.replace(/[@.]/g,'_')}`;
  const row   = document.getElementById(rowId);
  if (row) row.querySelectorAll('td')[7].innerHTML = `<div class="record-cell"><span style="color:var(--muted);font-size:0.72rem;font-style:italic">✨ Generating…</span></div>`;

  const level    = ap.experience === 0 ? 'Fresher' : ap.experience >= 5 ? 'Senior' : ap.experience >= 3 ? 'Mid-level' : 'Junior';
  const expLabel = ap.experience === 0 ? 'as a fresher' : `with ${ap.experience} year${ap.experience!==1?'s':''} of experience`;
  const topSkills = (ap.skills || '').split(',').slice(0,3).map(s=>s.trim()).join(', ');
  const strength  = ap.overall >= 80 ? 'strong across all dimensions' : ap.overall >= 65 ? 'solid technical foundation' : 'growing skill profile';
  const record    = `${level} professional ${expLabel}, skilled in ${topSkills || 'various technologies'}. Demonstrates a ${strength} with an overall score of ${ap.overall}%, making them a ${ap.overall>=75?'strong':'potential'} candidate for consideration.`;

  aiRecords[email] = record;
  if (row) row.querySelectorAll('td')[7].innerHTML = `<div class="record-cell"><div class="record-text">${record}</div></div>`;
}

// ══════════════════════════════════════════════════════════════
//  CLEAR PAGE
// ══════════════════════════════════════════════════════════════
function openClearModal() {
  if (!activeRecruiterCo) return;
  const count = APPLICANTS[activeRecruiterCo.id]?.length || 0;
  if (count === 0) { toast('ℹ The list is already empty.'); return; }
  document.getElementById('clearCoName').textContent = `${count} ${activeRecruiterCo.name}`;
  document.getElementById('clearModal').classList.add('open');
}

function closeClearModal() { document.getElementById('clearModal').classList.remove('open'); }

function confirmClear() {
  if (!activeRecruiterCo) return;
  const id = activeRecruiterCo.id;
  clearedSnapshots[id] = [...APPLICANTS[id]];
  APPLICANTS[id] = [];
  tableData = [];

  if (backendOnline) {
    fetch(`${API_BASE}/applicants/${id}/clear`, { method: 'DELETE' })
      .then(r => r.json()).then(d => console.log(`[DB] Cleared ${d.deleted} records`))
      .catch(e => console.warn('DB clear failed:', e));
  }

  closeClearModal();
  showEmptyState(id);
  renderRecruiter();
  toast(`🗑 ${activeRecruiterCo.name} applicant list cleared.`);
}

function showEmptyState(coId) {
  const co = COMPANIES.find(c => c.id === coId);
  document.getElementById('appCount').textContent = '0';
  document.getElementById('appTbody').innerHTML   = '';
  const tableWrap = document.querySelector('.table-wrap');
  const existing  = document.getElementById('emptyTableState');
  if (existing) existing.remove();
  const div = document.createElement('div');
  div.id        = 'emptyTableState';
  div.className = 'empty-table-state';
  div.innerHTML = `
    <div class="empty-table-ico">📭</div>
    <div class="empty-table-title">Applicant list cleared</div>
    <div class="empty-table-sub">All ${co?.name||''} applicants removed. New applications will appear here.</div>
    ${clearedSnapshots[coId]?.length ? `<button class="btn-restore" onclick="restoreApplicants('${coId}')">↩ Undo — Restore ${clearedSnapshots[coId].length} applicants</button>` : ''}`;
  tableWrap.appendChild(div);
}

function restoreApplicants(coId) {
  if (!clearedSnapshots[coId]) return;
  APPLICANTS[coId] = [...clearedSnapshots[coId]];
  delete clearedSnapshots[coId];
  const empty = document.getElementById('emptyTableState');
  if (empty) empty.remove();
  loadTableFor(coId);
  renderRecruiter();
  toast(`↩ Restored ${APPLICANTS[coId].length} applicants for ${COMPANIES.find(c=>c.id===coId)?.name}`);
}

// ══════════════════════════════════════════════════════════════
//  EXPORT CSV
// ══════════════════════════════════════════════════════════════
function exportCSV() {
  if (!activeRecruiterCo) return;
  const data = APPLICANTS[activeRecruiterCo.id] || [];
  if (data.length === 0) { toast('ℹ No applicants to export.'); return; }
  const headers = ['Name','Email','Phone','Experience (yrs)','Skills','Resume %','LinkedIn %','GitHub %','Overall %','Status','LinkedIn URL','Applied'];
  const rows    = data.map(ap => [ap.name, ap.email, ap.phone||'', ap.experience, ap.skills||'', ap.scores.resume, ap.scores.linkedin, ap.scores.github, ap.overall, ap.status, ap.li||'', ap.applied||'']);
  const csv     = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g,'""')}"`).join(',')).join('\n');
  const blob    = new Blob([csv], { type: 'text/csv' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href = url; a.download = `${activeRecruiterCo.name}_applicants_${new Date().toISOString().split('T')[0]}.csv`;
  a.click(); URL.revokeObjectURL(url);
  toast(`⬇ Exported ${data.length} applicants as CSV`);
}

function filterTable() {
  const q = document.getElementById('tableSearch').value.toLowerCase();
  renderTable(tableData.filter(ap =>
    ap.name.toLowerCase().includes(q) || ap.email.toLowerCase().includes(q) || (ap.skills||'').toLowerCase().includes(q)
  ));
}

function sortTable(field) {
  if (sortField === field) sortDir *= -1; else { sortField = field; sortDir = -1; }
  const key = { name:'name', experience:'experience', resume:'scores.resume', linkedin:'scores.linkedin', github:'scores.github', overall:'overall' }[field] || field;
  tableData.sort((a, b) => {
    const av = key.includes('.') ? a[key.split('.')[0]][key.split('.')[1]] : a[key];
    const bv = key.includes('.') ? b[key.split('.')[0]][key.split('.')[1]] : b[key];
    return typeof av === 'string' ? av.localeCompare(bv) * sortDir : (av - bv) * sortDir;
  });
  renderTable(tableData);
}

// ══════════════════════════════════════════════════════════════
//  TOAST
// ══════════════════════════════════════════════════════════════
let toastTimer;
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
}

// ══════════════════════════════════════════════════════════════
//  INIT
// ══════════════════════════════════════════════════════════════
checkBackend();
renderCompanies('all');
