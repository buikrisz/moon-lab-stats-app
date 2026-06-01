"use client";

import { useEffect, useState } from 'react';
import { LoginScreen } from './LoginScreen';

type AuthState = {
  authenticated: boolean;
  username?: string;
  googleEmail?: string | null;
  loginMethod?: 'password' | 'google';
};

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<AuthState | null>(null);

  const refresh = async () => {
    const res = await fetch('/api/auth/me', { cache: 'no-store' });
    if (!res.ok) {
      setAuth({ authenticated: false });
      return;
    }
    setAuth(await res.json());
  };

  useEffect(() => {
    refresh();
  }, []);

  if (!auth) return <div className="loadingScreen">Belépés ellenőrzése...</div>;
  if (!auth.authenticated) return <LoginScreen onLoggedIn={refresh} />;

  return <>{children}</>;
}
