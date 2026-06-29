import React, { createContext, useContext, useEffect, useState } from 'react';
import * as CognitoService from './CognitoService';
import type { AuthUser } from './CognitoService';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, tenantId: string, firstName: string, lastName: string, phone?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    CognitoService.getSessionUser()
      .then(setUser)
      .finally(() => setIsLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    const authUser = await CognitoService.login(email, password);
    setUser(authUser);
  };

  const register = async (email: string, password: string, tenantId: string, firstName: string, lastName: string, phone?: string) => {
    await CognitoService.register(email, password, tenantId, firstName, lastName, phone);
    const authUser = await CognitoService.login(email, password);
    setUser(authUser);
  };

  const logout = async () => {
    await CognitoService.logout();
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, isAuthenticated: !!user, isLoading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
