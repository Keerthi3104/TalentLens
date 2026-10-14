// src/hooks/useBackend.js
// FIX: polls every 8 seconds so if backend starts after page load,
//      backendOnline updates automatically. Longer timeout (5s) handles slow machines.
import { useState, useEffect, useCallback } from 'react';
import { checkHealth } from '../api/talentlens';

export function useBackend() {
  const [backendOnline, setBackendOnline] = useState(false);
  const [checking, setChecking] = useState(true);

  const check = useCallback(() => {
    checkHealth()
      .then(ok => setBackendOnline(ok))
      .catch(() => setBackendOnline(false))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    check();                                    // immediate check on mount
    const id = setInterval(check, 8000);        // re-check every 8 seconds
    return () => clearInterval(id);
  }, [check]);

  return { backendOnline, checking };
}
