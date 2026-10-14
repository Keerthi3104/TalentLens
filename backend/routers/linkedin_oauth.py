"""
TalentLens — LinkedIn OAuth 2.0 Router
=======================================
SETUP REQUIRED (one-time, free):
  1. Go to https://www.linkedin.com/developers/apps/new
  2. Create app → fill name, company, logo
  3. Under "Auth" tab → copy Client ID and Client Secret
  4. Under "Auth" tab → add Redirect URL:
       http://localhost:8000/api/linkedin/callback
  5. Under "Products" tab → request "Sign In with LinkedIn using OpenID Connect"
  6. Copy your Client ID + Secret into backend/.env:
       LINKEDIN_CLIENT_ID=your_client_id
       LINKEDIN_CLIENT_SECRET=your_client_secret

ENDPOINTS:
  GET  /api/linkedin/login      → redirects user to LinkedIn login page
  GET  /api/linkedin/callback   → LinkedIn calls this after user approves
  GET  /api/linkedin/profile    → returns stored profile for a session
  POST /api/linkedin/disconnect → clears stored profile

WHAT YOU GET FREE with "Sign In with LinkedIn using OpenID Connect":
  ✅ Full name
  ✅ Profile photo URL
  ✅ Email address
  ✅ LinkedIn profile URL
  ✅ Sub (unique LinkedIn user ID)

WHAT REQUIRES PAID PARTNER ACCESS (not available free):
  ❌ Connections count
  ❌ Recommendations
  ❌ Endorsements
  ❌ Certifications
  ❌ Work experience details

NOTE: We combine OAuth real data + self-assessment for full scoring.
"""

import os
import httpx
import secrets
from fastapi import APIRouter, HTTPException
from fastapi.responses import RedirectResponse, JSONResponse

router = APIRouter()

# ── Load credentials from environment ────────────────────────────
LINKEDIN_CLIENT_ID     = os.getenv("LINKEDIN_CLIENT_ID", "")
LINKEDIN_CLIENT_SECRET = os.getenv("LINKEDIN_CLIENT_SECRET", "")
REDIRECT_URI           = os.getenv("LINKEDIN_REDIRECT_URI", "http://localhost:8000/api/linkedin/callback")
FRONTEND_URL           = os.getenv("FRONTEND_URL", "http://localhost:3000")

# ── In-memory session store (use Redis in production) ─────────────
# state_token → { "status": "pending" }
_state_store: dict = {}
# session_id  → { profile data }
_profile_store: dict = {}


@router.get("/status")
def linkedin_status():
    """Check if LinkedIn OAuth is configured."""
    configured = bool(LINKEDIN_CLIENT_ID and LINKEDIN_CLIENT_SECRET)
    return {
        "configured": configured,
        "client_id_set": bool(LINKEDIN_CLIENT_ID),
        "secret_set": bool(LINKEDIN_CLIENT_SECRET),
        "redirect_uri": REDIRECT_URI,
        "message": (
            "LinkedIn OAuth ready" if configured
            else "Missing LINKEDIN_CLIENT_ID or LINKEDIN_CLIENT_SECRET in .env"
        ),
        "setup_url": "https://www.linkedin.com/developers/apps/new",
    }


@router.get("/login")
def linkedin_login(session_id: str = ""):
    """
    Step 1 — Redirect user to LinkedIn authorization page.
    React calls: window.location.href = '/api/linkedin/login?session_id=xyz'
    """
    if not LINKEDIN_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="LinkedIn OAuth not configured. Add LINKEDIN_CLIENT_ID to backend/.env"
        )

    # Generate a random state token to prevent CSRF
    state = secrets.token_urlsafe(32)
    _state_store[state] = {"session_id": session_id or state}

    # Build LinkedIn authorization URL
    auth_url = (
        "https://www.linkedin.com/oauth/v2/authorization"
        "?response_type=code"
        f"&client_id={LINKEDIN_CLIENT_ID}"
        f"&redirect_uri={REDIRECT_URI}"
        f"&state={state}"
        "&scope=openid%20profile%20email"
    )
    return RedirectResponse(auth_url)


@router.get("/callback")
async def linkedin_callback(code: str = "", state: str = "", error: str = ""):
    """
    Step 2 — LinkedIn redirects here after user approves/denies.
    Exchanges authorization code for access token, then fetches profile.
    """
    # User denied access
    if error:
        return RedirectResponse(
            f"{FRONTEND_URL}?linkedin_error={error}"
        )

    # Validate state (CSRF protection)
    state_data = _state_store.pop(state, None)
    if not state_data:
        return RedirectResponse(
            f"{FRONTEND_URL}?linkedin_error=invalid_state"
        )

    session_id = state_data.get("session_id", state)

    async with httpx.AsyncClient() as client:

        # ── Step 2a: Exchange code for access token ───────────────
        token_res = await client.post(
            "https://www.linkedin.com/oauth/v2/accessToken",
            data={
                "grant_type":    "authorization_code",
                "code":          code,
                "client_id":     LINKEDIN_CLIENT_ID,
                "client_secret": LINKEDIN_CLIENT_SECRET,
                "redirect_uri":  REDIRECT_URI,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )

        if token_res.status_code != 200:
            return RedirectResponse(
                f"{FRONTEND_URL}?linkedin_error=token_exchange_failed"
            )

        token_data   = token_res.json()
        access_token = token_data.get("access_token", "")

        if not access_token:
            return RedirectResponse(
                f"{FRONTEND_URL}?linkedin_error=no_access_token"
            )

        # ── Step 2b: Fetch profile using OpenID Connect userinfo ──
        # This endpoint works with the free "Sign In with LinkedIn" product
        profile_res = await client.get(
            "https://api.linkedin.com/v2/userinfo",
            headers={"Authorization": f"Bearer {access_token}"},
        )

        if profile_res.status_code != 200:
            return RedirectResponse(
                f"{FRONTEND_URL}?linkedin_error=profile_fetch_failed"
            )

        raw = profile_res.json()

        # ── Step 2c: Build clean profile object ───────────────────
        profile = {
            "connected":    True,
            "sub":          raw.get("sub", ""),               # unique LinkedIn ID
            "name":         raw.get("name", ""),              # full name
            "given_name":   raw.get("given_name", ""),        # first name
            "family_name":  raw.get("family_name", ""),       # last name
            "email":        raw.get("email", ""),             # email
            "picture":      raw.get("picture", ""),           # profile photo URL
            "locale":       raw.get("locale", {}).get("language", ""),
            # These require paid access — always null on free tier:
            "connections":  None,
            "headline":     None,
            "certifications": None,
            "recommendations": None,
            "note": (
                "Free OAuth returns name, email, photo only. "
                "Connections/certifications require LinkedIn Partner access. "
                "Complete the self-assessment below for full scoring."
            ),
        }

        # Store profile keyed by session_id
        _profile_store[session_id] = profile

    # Redirect back to frontend with session_id so React can fetch profile
    return RedirectResponse(
        f"{FRONTEND_URL}?linkedin_connected=true&session_id={session_id}"
    )


@router.get("/profile/{session_id}")
def get_linkedin_profile(session_id: str):
    """
    Step 3 — React polls this after redirect to get the stored profile.
    """
    profile = _profile_store.get(session_id)
    if not profile:
        raise HTTPException(
            status_code=404,
            detail="No LinkedIn profile found for this session. Please connect again."
        )
    return profile


@router.delete("/disconnect/{session_id}")
def disconnect_linkedin(session_id: str):
    """Clear stored LinkedIn profile for this session."""
    _profile_store.pop(session_id, None)
    return {"disconnected": True}
