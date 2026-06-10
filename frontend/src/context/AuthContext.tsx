import { useState, useEffect, type ReactNode } from 'react';
import { AuthContext } from '../store/authStore';
import type { User } from '../types';

// ── Environment ───────────────────────────────────────────────────────────────
const IS_PROD       = import.meta.env.VITE_IS_PRODUCTION === 'true';
const ERP_PORTAL    = 'https://erp.tpfcs.co.tz';
const ERP_DASHBOARD = `${ERP_PORTAL}/dashboard`;

const isTokenExpired = (token: string): boolean => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp * 1000 < Date.now();
  } catch {
    return true;
  }
};

const STORAGE_USER    = 'tpfcs_user';
const STORAGE_ACCESS  = 'access_token';
const STORAGE_REFRESH = 'refresh_token';

// Build a safe minimal User from JWT payload so the app can render
// without waiting for /auth/me. All required fields are given safe defaults.
const minimalUserFromToken = (token: string): User | null => {
  try {
    const p = JSON.parse(atob(token.split('.')[1]));
    return {
      user_id:             Number(p.sub) || 0,
      full_name:           p.email ?? 'User',
      username:            p.email ?? 'user',
      email:               p.email ?? '',
      role:                (p.role as User['role']) ?? 'user',
      status:              'active',
      must_change_password: 0,
    };
  } catch {
    return null;
  }
};

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,      setUser]      = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const token = localStorage.getItem(STORAGE_ACCESS);

        if (!token || isTokenExpired(token)) {
          // No valid token — clear everything
          localStorage.removeItem(STORAGE_USER);
          localStorage.removeItem(STORAGE_ACCESS);
          localStorage.removeItem(STORAGE_REFRESH);
          setIsLoading(false);
          return;
        }

        // Try stored user first
        const stored = localStorage.getItem(STORAGE_USER);
        if (stored) {
          try {
            const parsed: User = JSON.parse(stored);
            // If it has a real full_name it's a complete user — use it directly
            if (parsed.full_name && parsed.full_name !== parsed.email) {
              setUser(parsed);
              setIsLoading(false);
              return;
            }
          } catch { /* fall through */ }
        }

        // Stored user is missing or minimal — build from token immediately
        // so the app can render, then enrich in background
        const minimal = minimalUserFromToken(token);
        if (minimal) {
          setUser(minimal);
          localStorage.setItem(STORAGE_USER, JSON.stringify(minimal));
        }
        setIsLoading(false);

        // Background enrich via /auth/me — non-blocking
        try {
          const base = import.meta.env.VITE_API_URL ?? '/api';
          const res  = await fetch(`${base}/v1/auth/me`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (res.ok) {
            const data = await res.json();
            // /auth/me returns a flat user object (not wrapped in { user: ... })
            const full: User = data.user ?? data;
            if (full.user_id) {
              localStorage.setItem(STORAGE_USER, JSON.stringify(full));
              setUser(full);
            }
          }
        } catch { /* silent — minimal user already set, app works */ }

      } catch {
        localStorage.removeItem(STORAGE_USER);
        localStorage.removeItem(STORAGE_ACCESS);
        localStorage.removeItem(STORAGE_REFRESH);
        setIsLoading(false);
      }
    };

    init();
  }, []);

  const login = (u: User, accessToken: string, refreshToken: string) => {
    localStorage.setItem(STORAGE_USER,    JSON.stringify(u));
    localStorage.setItem(STORAGE_ACCESS,  accessToken);
    localStorage.setItem(STORAGE_REFRESH, refreshToken);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem(STORAGE_USER);
    localStorage.removeItem(STORAGE_ACCESS);
    localStorage.removeItem(STORAGE_REFRESH);
    setUser(null);

    if (IS_PROD) {
      // Production — return user to ERP portal dashboard
      window.location.href = ERP_DASHBOARD;
    }
    // Development — React Router redirects to /signin via ProtectedRoute
  };

  const updateUser = (partial: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...partial };
    localStorage.setItem(STORAGE_USER, JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
