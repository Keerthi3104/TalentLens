/**
 * LinkedInConnect.jsx
 * ====================
 * "Connect LinkedIn" button that triggers OAuth 2.0 flow.
 *
 * Flow:
 *  1. Generate a session_id (random string stored in localStorage)
 *  2. Open popup window → /api/linkedin/login?session_id=xyz
 *  3. LinkedIn shows their own login page
 *  4. User approves → LinkedIn redirects to /api/linkedin/callback
 *  5. Backend exchanges code → fetches profile → stores it
 *  6. Backend redirects to frontend with ?linkedin_connected=true&session_id=xyz
 *  7. This component polls /api/linkedin/profile/xyz → gets real profile data
 *  8. Calls onConnected(profile) with real name, email, photo
 *
 * Props:
 *   onConnected(profile)  — called with LinkedIn profile when done
 *   onSkip()              — called when user clicks "Skip / use self-assessment"
 *   backendOnline         — whether FastAPI is running
 */

import React, { useState, useEffect, useRef } from "react";

const API = "http://localhost:8000/api/linkedin";

export default function LinkedInConnect({ onConnected, onSkip, backendOnline }) {
  const [status, setStatus]   = useState("idle");
  // idle | waiting | polling | success | error | not_configured
  const [profile, setProfile] = useState(null);
  const [error, setError]     = useState("");
  const [configured, setConfigured] = useState(null);
  const pollRef  = useRef(null);
  const popupRef = useRef(null);

  // Check if OAuth is configured when component mounts
  useEffect(() => {
    if (!backendOnline) return;
    fetch(`${API}/status`)
      .then(r => r.json())
      .then(d => setConfigured(d.configured))
      .catch(() => setConfigured(false));
  }, [backendOnline]);

  // Watch for redirect back from LinkedIn (OAuth callback)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("linkedin_connected") === "true") {
      const sid = params.get("session_id");
      if (sid) {
        // Clean URL
        window.history.replaceState({}, "", window.location.pathname);
        setStatus("polling");
        startPolling(sid);
      }
    }
    if (params.get("linkedin_error")) {
      const err = params.get("linkedin_error");
      window.history.replaceState({}, "", window.location.pathname);
      setStatus("error");
      setError(friendlyError(err));
    }
  }, []);

  function friendlyError(code) {
    const map = {
      "invalid_state":         "Session expired. Please try again.",
      "token_exchange_failed": "LinkedIn rejected the login. Try again.",
      "no_access_token":       "LinkedIn did not return a token. Try again.",
      "profile_fetch_failed":  "Could not load your LinkedIn profile.",
      "user_cancelled_login":  "You cancelled the LinkedIn login.",
      "access_denied":         "You denied access. Click Connect to try again.",
    };
    return map[code] || `LinkedIn error: ${code}`;
  }

  function generateSessionId() {
    return "li_" + Math.random().toString(36).slice(2) + Date.now();
  }

  function startOAuth() {
    if (!configured) {
      setStatus("not_configured");
      return;
    }
    const sid = generateSessionId();
    localStorage.setItem("li_session_id", sid);
    setStatus("waiting");
    setError("");

    // Open LinkedIn login in a popup window
    const w = 600, h = 700;
    const left = window.screen.width  / 2 - w / 2;
    const top  = window.screen.height / 2 - h / 2;
    popupRef.current = window.open(
      `${API}/login?session_id=${sid}`,
      "linkedin_oauth",
      `width=${w},height=${h},left=${left},top=${top},toolbar=no,menubar=no`
    );

    // Poll for popup closing or redirect
    const checkPopup = setInterval(() => {
      try {
        if (!popupRef.current || popupRef.current.closed) {
          clearInterval(checkPopup);
          // Check if we got redirected with success
          const storedSid = localStorage.getItem("li_session_id");
          if (storedSid) startPolling(storedSid);
          return;
        }
        // Check if popup URL changed to our frontend (callback complete)
        const popupUrl = popupRef.current.location.href;
        if (popupUrl.includes("linkedin_connected=true")) {
          const params = new URLSearchParams(popupRef.current.location.search);
          const sid2 = params.get("session_id");
          popupRef.current.close();
          clearInterval(checkPopup);
          if (sid2) startPolling(sid2);
        }
      } catch (e) {
        // Cross-origin error while popup is on linkedin.com — normal, keep waiting
      }
    }, 500);
  }

  function startPolling(sid) {
    setStatus("polling");
    let attempts = 0;
    pollRef.current = setInterval(async () => {
      attempts++;
      try {
        const res = await fetch(`${API}/profile/${sid}`);
        if (res.ok) {
          const data = await res.json();
          clearInterval(pollRef.current);
          localStorage.removeItem("li_session_id");
          setProfile(data);
          setStatus("success");
          onConnected(data);
        } else if (attempts > 20) {
          clearInterval(pollRef.current);
          setStatus("error");
          setError("Timed out waiting for LinkedIn. Please try again.");
        }
      } catch {
        if (attempts > 20) {
          clearInterval(pollRef.current);
          setStatus("error");
          setError("Could not reach backend. Is the server running?");
        }
      }
    }, 1000);
  }

  useEffect(() => () => {
    if (pollRef.current)  clearInterval(pollRef.current);
  }, []);

  // ── Render ────────────────────────────────────────────────────
  return (
    <div style={{
      padding:"1.2rem",background:"rgba(10,102,194,0.06)",
      border:"1px solid rgba(10,102,194,0.2)",borderRadius:12,marginBottom:"1rem"
    }}>
      <div style={{display:"flex",alignItems:"center",gap:"0.6rem",marginBottom:"0.7rem"}}>
        {/* LinkedIn logo */}
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
        <span style={{fontSize:"0.82rem",fontWeight:600,color:"var(--color-text-primary)"}}>
          Connect LinkedIn
        </span>
        {configured === false && (
          <span style={{fontSize:"0.65rem",background:"rgba(245,158,11,0.15)",color:"#b45309",
            padding:"0.1rem 0.4rem",borderRadius:4,border:"1px solid rgba(245,158,11,0.3)"}}>
            Setup needed
          </span>
        )}
        {configured === true && (
          <span style={{fontSize:"0.65rem",background:"rgba(16,185,129,0.12)",color:"#065f46",
            padding:"0.1rem 0.4rem",borderRadius:4,border:"1px solid rgba(16,185,129,0.3)"}}>
            Ready
          </span>
        )}
      </div>

      {/* Success state */}
      {status === "success" && profile && (
        <div style={{display:"flex",alignItems:"center",gap:"0.8rem",marginBottom:"0.6rem"}}>
          {profile.picture && (
            <img src={profile.picture} alt="LinkedIn" style={{
              width:44,height:44,borderRadius:"50%",border:"2px solid #0A66C2"
            }}/>
          )}
          <div>
            <div style={{fontSize:"0.85rem",fontWeight:600,color:"var(--color-text-primary)"}}>
              ✅ Connected — {profile.name}
            </div>
            <div style={{fontSize:"0.72rem",color:"var(--color-text-secondary)",marginTop:"0.15rem"}}>
              {profile.email}
            </div>
            <div style={{fontSize:"0.68rem",color:"var(--color-text-secondary)",marginTop:"0.1rem",
              padding:"0.2rem 0.4rem",background:"rgba(10,102,194,0.08)",borderRadius:4,
              border:"1px solid rgba(10,102,194,0.15)",display:"inline-block",marginTop:"0.3rem"}}>
              ℹ Free tier: name + email + photo only. Complete assessment below for full score.
            </div>
          </div>
        </div>
      )}

      {/* Waiting for popup */}
      {status === "waiting" && (
        <div style={{fontSize:"0.78rem",color:"var(--color-text-secondary)",marginBottom:"0.6rem",
          display:"flex",alignItems:"center",gap:"0.5rem"}}>
          <span style={{display:"inline-block",width:14,height:14,border:"2px solid #0A66C2",
            borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          LinkedIn login window opened — please log in and approve access...
        </div>
      )}

      {/* Polling */}
      {status === "polling" && (
        <div style={{fontSize:"0.78rem",color:"var(--color-text-secondary)",marginBottom:"0.6rem",
          display:"flex",alignItems:"center",gap:"0.5rem"}}>
          <span style={{display:"inline-block",width:14,height:14,border:"2px solid #0A66C2",
            borderTopColor:"transparent",borderRadius:"50%",animation:"spin 0.8s linear infinite"}}/>
          Fetching your LinkedIn profile...
        </div>
      )}

      {/* Error */}
      {status === "error" && (
        <div style={{fontSize:"0.75rem",color:"#b91c1c",marginBottom:"0.6rem",
          padding:"0.4rem 0.6rem",background:"rgba(185,28,28,0.06)",
          border:"1px solid rgba(185,28,28,0.2)",borderRadius:6}}>
          ⚠ {error}
        </div>
      )}

      {/* Not configured */}
      {status === "not_configured" && (
        <div style={{fontSize:"0.72rem",color:"#92400e",marginBottom:"0.6rem",
          padding:"0.5rem 0.7rem",background:"rgba(245,158,11,0.08)",
          border:"1px solid rgba(245,158,11,0.25)",borderRadius:6,lineHeight:1.6}}>
          <strong>LinkedIn OAuth not configured yet.</strong><br/>
          1. Go to <a href="https://www.linkedin.com/developers/apps/new" target="_blank" rel="noreferrer"
            style={{color:"#0A66C2"}}>linkedin.com/developers/apps/new</a><br/>
          2. Create app → request "Sign In with LinkedIn using OpenID Connect"<br/>
          3. Add redirect URL: <code>http://localhost:8000/api/linkedin/callback</code><br/>
          4. Copy Client ID + Secret → paste into <code>backend/.env</code><br/>
          5. Restart the backend
        </div>
      )}

      {/* Buttons */}
      <div style={{display:"flex",gap:"0.5rem",flexWrap:"wrap"}}>
        {status !== "success" && (
          <button onClick={startOAuth} disabled={!backendOnline || status==="waiting" || status==="polling"}
            style={{padding:"0.5rem 1rem",background:"#0A66C2",color:"#fff",border:"none",
              borderRadius:8,fontSize:"0.8rem",fontWeight:600,cursor:"pointer",
              opacity:(!backendOnline || status==="waiting" || status==="polling") ? 0.5 : 1,
              display:"flex",alignItems:"center",gap:"0.4rem"}}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="white">
              <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
            </svg>
            {status === "success" ? "Re-connect" : "Connect with LinkedIn"}
          </button>
        )}
        <button onClick={onSkip}
          style={{padding:"0.5rem 0.9rem",background:"transparent",
            border:"1px solid var(--color-border-tertiary)",color:"var(--color-text-secondary)",
            borderRadius:8,fontSize:"0.78rem",cursor:"pointer"}}>
          {status === "success" ? "Continue →" : "Skip — use self-assessment"}
        </button>
      </div>

      {!backendOnline && (
        <div style={{fontSize:"0.68rem",color:"var(--color-text-secondary)",marginTop:"0.5rem"}}>
          ⚠ Backend offline — start FastAPI server to use LinkedIn OAuth
        </div>
      )}
    </div>
  );
}
