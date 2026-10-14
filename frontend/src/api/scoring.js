/**
 * scoring.js — Shared scoring logic used by BOTH AnalyzerPage and JobPage
 *
 * Exports:
 *   fetchGithubData(username)        → real GitHub API score
 *   scoreLinkedIn(liData, exp, sc)   → 11-question LinkedIn assessment score
 *   extractGithubUsername(url)       → parse username from URL
 *   extractLinkedInHandle(url)       → parse handle from URL
 *   LI_QUESTIONS                     → the 11 LinkedIn modal questions
 */

// ── URL parsers ───────────────────────────────────────────────────
export function extractGithubUsername(url) {
  if (!url) return null;
  try {
    const u = url.trim().replace(/\/$/, "");
    const match = u.match(/github\.com\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  } catch { return null; }
}

export function extractLinkedInHandle(url) {
  if (!url) return null;
  try {
    const u = url.trim().replace(/\/$/, "");
    const match = u.match(/linkedin\.com\/in\/([a-zA-Z0-9_-]+)/);
    return match ? match[1] : null;
  } catch { return null; }
}

// ── Real GitHub API fetch ─────────────────────────────────────────
export async function fetchGithubData(username) {
  try {
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`),
    ]);
    if (!userRes.ok) {
      if (userRes.status === 404) return { error: "GitHub user not found. Check the username in your URL." };
      if (userRes.status === 403) return { error: "GitHub API rate limit reached. Try again in 1 hour." };
      return { error: "GitHub API error. Try again later." };
    }
    const user  = await userRes.json();
    const repos = reposRes.ok ? await reposRes.json() : [];

    const publicRepos    = user.public_repos || 0;
    const followers      = user.followers || 0;
    const hasBio         = !!(user.bio && user.bio.trim().length > 5);
    const hasWebsite     = !!(user.blog && user.blog.trim().length > 3);
    const hasLocation    = !!(user.location);
    const hasCompany     = !!(user.company);
    const totalStars     = repos.reduce((s, r) => s + (r.stargazers_count || 0), 0);
    const totalForks     = repos.reduce((s, r) => s + (r.forks_count || 0), 0);
    const reposWithDesc  = repos.filter(r => r.description && r.description.trim().length > 5).length;
    const reposNotForked = repos.filter(r => !r.fork).length;
    const languages      = [...new Set(repos.map(r => r.language).filter(Boolean))];
    const recentlyActive = repos.filter(r => {
      const days = (Date.now() - new Date(r.updated_at || r.pushed_at)) / 86400000;
      return days < 180;
    }).length;

    let score = 0;
    score += Math.min(25, publicRepos * 2);
    score += Math.min(15, reposNotForked * 2);
    score += Math.min(15, totalStars * 2);
    score += Math.min(10, totalForks * 2);
    score += Math.min(10, languages.length * 2);
    score += Math.min(8,  reposWithDesc);
    score += Math.min(8,  recentlyActive);
    if (hasBio)      score += 3;
    if (hasWebsite)  score += 2;
    if (hasLocation) score += 1;
    if (hasCompany)  score += 1;
    if (followers > 10) score += 2;

    return {
      score: Math.min(97, Math.max(5, score)),
      username: user.login, name: user.name || user.login,
      publicRepos, followers, totalStars, totalForks,
      languages: languages.slice(0, 8), reposWithDesc,
      reposNotForked, recentlyActive,
      hasBio, hasWebsite,
      bio: user.bio || "",
      profileUrl: user.html_url,
      avatarUrl: user.avatar_url,
    };
  } catch {
    return { error: "Could not connect to GitHub API. Check your internet connection." };
  }
}

// ── LinkedIn 11-question self-assessment scorer ───────────────────
export function scoreLinkedIn(liData, exp, sc) {
  if (!liData) return { score: 0, breakdown: null };
  let score = 0;
  const breakdown = {};

  breakdown.photo = liData.hasPhoto ? 8 : 0; score += breakdown.photo;

  breakdown.headline = liData.headline === "detailed" ? 10 : liData.headline === "basic" ? 5 : 0;
  score += breakdown.headline;

  const conn = parseInt(liData.connections) || 0;
  breakdown.connections = conn >= 500 ? 15 : conn >= 200 ? 10 : conn >= 100 ? 6 : conn >= 50 ? 3 : 0;
  score += breakdown.connections;

  const recs = parseInt(liData.recommendations) || 0;
  breakdown.recommendations = recs >= 5 ? 12 : recs >= 3 ? 8 : recs >= 1 ? 4 : 0;
  score += breakdown.recommendations;

  const endorsed = parseInt(liData.endorsedSkills) || 0;
  breakdown.endorsedSkills = endorsed >= 10 ? 10 : endorsed >= 5 ? 6 : endorsed >= 2 ? 3 : 0;
  score += breakdown.endorsedSkills;

  breakdown.expDetail = liData.expDetail === "full" ? 10 : liData.expDetail === "partial" ? 5 : 0;
  score += breakdown.expDetail;

  breakdown.education = liData.hasEducation ? 5 : 0; score += breakdown.education;

  const certs = parseInt(liData.certifications) || 0;
  breakdown.certifications = certs >= 3 ? 8 : certs >= 1 ? 4 : 0;
  score += breakdown.certifications;

  breakdown.projects = liData.hasProjects ? 8 : 0; score += breakdown.projects;

  breakdown.about = liData.aboutSection === "detailed" ? 7 : liData.aboutSection === "basic" ? 3 : 0;
  score += breakdown.about;

  breakdown.activity = liData.activityLevel === "active" ? 7 : liData.activityLevel === "some" ? 3 : 0;
  score += breakdown.activity;

  return { score: Math.min(97, Math.max(0, score)), breakdown };
}

// ── The 11 LinkedIn assessment questions (used in modal) ──────────
export const LI_QUESTIONS = [
  { key:"hasPhoto",        label:"Do you have a professional profile photo?",
    type:"bool" },
  { key:"headline",        label:"How detailed is your LinkedIn headline?",
    type:"select", opts:[["none","No headline"],["basic","Basic (just job title)"],["detailed","Detailed (role + skills + value)"]] },
  { key:"connections",     label:"How many connections do you have?",
    type:"select", opts:[["0","< 50"],["50","50–99"],["100","100–199"],["200","200–499"],["500","500+"]] },
  { key:"recommendations", label:"How many recommendations have you received?",
    type:"select", opts:[["0","None"],["1","1–2"],["3","3–4"],["5","5+"]] },
  { key:"endorsedSkills",  label:"How many of your skills have been endorsed?",
    type:"select", opts:[["0","None"],["2","1–4"],["5","5–9"],["10","10+"]] },
  { key:"expDetail",       label:"How detailed are your experience descriptions?",
    type:"select", opts:[["none","No descriptions"],["partial","Some bullet points"],["full","Full STAR-format bullets"]] },
  { key:"hasEducation",    label:"Do you have an Education section filled in?",
    type:"bool" },
  { key:"certifications",  label:"How many certifications do you have listed?",
    type:"select", opts:[["0","None"],["1","1–2"],["3","3+"]] },
  { key:"hasProjects",     label:"Do you have a Projects or Portfolio section?",
    type:"bool" },
  { key:"aboutSection",    label:"How complete is your About / Summary section?",
    type:"select", opts:[["none","Empty"],["basic","1–2 sentences"],["detailed","Full paragraph (50+ words)"]] },
  { key:"activityLevel",   label:"How active are you on LinkedIn (posts/comments)?",
    type:"select", opts:[["none","Never"],["some","Occasionally"],["active","Weekly"]] },
];
