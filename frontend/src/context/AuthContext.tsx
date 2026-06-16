import { useState, useEffect, type ReactNode } from 'react';
import { AuthContext } from '../store/authStore';
import type { User } from '../types';

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

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user,      setUser]      = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const token  = localStorage.getItem(STORAGE_ACCESS);
        const stored = localStorage.getItem(STORAGE_USER);

        if (token && stored && !isTokenExpired(token)) {
          setUser(JSON.parse(stored));
        } else {
          localStorage.removeItem(STORAGE_USER);
          localStorage.removeItem(STORAGE_ACCESS);
          localStorage.removeItem(STORAGE_REFRESH);
        }
      } catch {
        localStorage.clear();
      } finally {
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
    // React Router redirects to /signin via ProtectedRoute
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
