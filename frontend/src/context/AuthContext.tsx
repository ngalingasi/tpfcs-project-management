import { useState, useEffect, type ReactNode } from 'react';
import { AuthContext } from '../store/authStore';
import type { User } from '../types';

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rehydrate from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem('tpfcs_user');
      const token  = localStorage.getItem('access_token');
      if (stored && token) {
        setUser(JSON.parse(stored));
      }
    } catch {
      localStorage.clear();
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (u: User, accessToken: string, refreshToken: string) => {
    localStorage.setItem('tpfcs_user',    JSON.stringify(u));
    localStorage.setItem('access_token',  accessToken);
    localStorage.setItem('refresh_token', refreshToken);
    setUser(u);
  };

  const logout = () => {
    localStorage.removeItem('tpfcs_user');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    setUser(null);
  };

  const updateUser = (partial: Partial<User>) => {
    if (!user) return;
    const updated = { ...user, ...partial };
    localStorage.setItem('tpfcs_user', JSON.stringify(updated));
    setUser(updated);
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, logout, updateUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};
