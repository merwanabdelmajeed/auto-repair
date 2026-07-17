import React, { createContext, useContext, useEffect, useState } from 'react';
import { Alert } from 'react-native';
import * as CognitoService from './CognitoService';
import type { AuthUser } from './CognitoService';

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, tenantId: string, firstName: string, lastName: string, phone?: string, smsConsent?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  updateUser: (patch: Partial<AuthUser>) => void;
  // Guest browsing: Home and the drawer are visible without an account, but
  // account-based actions (booking, vehicles, promotions, notifications,
  // profile, settings) go through this gate instead of navigating directly.
  authPromptVisible: boolean;
  requireAuth: (action: () => void) => void;
  hideAuthPrompt: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [authPromptVisible, setAuthPromptVisible] = useState(false);

  useEffect(() => {
    CognitoService.getSessionUser()
      .then(setUser)
      .finally(() => setIsLoading(false));
  }, []);

  // Auto-dismiss the login overlay the moment a real session exists, however
  // it got there (direct login, or register -> verify -> login).
  useEffect(() => {
    if (user) setAuthPromptVisible(false);
  }, [user]);

  function requireAuth(action: () => void) {
    if (user) {
      action();
      return;
    }
    Alert.alert(
      'Sign In Required',
      'This feature requires an account. Would you like to sign in?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign In', onPress: () => setAuthPromptVisible(true) },
      ],
    );
  }

  function hideAuthPrompt() {
    setAuthPromptVisible(false);
  }

  const login = async (email: string, password: string) => {
    const authUser = await CognitoService.login(email, password);
    setUser(authUser);
  };

  const register = async (email: string, password: string, tenantId: string, firstName: string, lastName: string, phone?: string, smsConsent?: boolean) => {
    await CognitoService.register(email, password, tenantId, firstName, lastName, phone, smsConsent);
  };

  const logout = async () => {
    await CognitoService.logout();
    setUser(null);
  };

  const updateUser = (patch: Partial<AuthUser>) =>
    setUser(prev => prev ? { ...prev, ...patch } : null);

  return (
    <AuthContext.Provider
      value={{
        user, isAuthenticated: !!user, isLoading, login, register, logout, updateUser,
        authPromptVisible, requireAuth, hideAuthPrompt,
      }}
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
