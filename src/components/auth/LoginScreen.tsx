'use client';

import { Lock, Mail } from 'lucide-react';
import { useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { Button } from '../common/Button';

type Props = {
  onLoggedIn: () => void;
};

export function LoginScreen({ onLoggedIn }: Props) {
  const [username, setUsername] = useState('moonlab');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const login = async () => {
    setIsLoading(true);
    setError('');

    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const payload = await res.json().catch(() => null);
      setError(payload?.error || 'Nem sikerült belépni.');
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    onLoggedIn();
  };

  const handleGoogleLogin = () => {
    window.location.href = '/api/auth/google/start?action=login';
  };

  return (
    <div className="loginScreen">
      <div className="loginCard">
        <img src="/moonlab-logo.png" alt="Moon Lab Pilates logo" />
        <h1>Moon Lab Pilates</h1>
        <p>Jelentkezz be az admin felülethez.</p>

        <label>
          Felhasználónév
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />
        </label>

        <label>
          Jelszó
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            onKeyDown={(e) => e.key === 'Enter' && login()}
          />
        </label>

        {error && <div className="loginError">{error}</div>}

        <Button variant="primary" onClick={login} disabled={isLoading}>
          <Lock size={16} /> {isLoading ? 'Belépés...' : 'Belépés'}
        </Button>

        <FcGoogle className="googleLoginButton" onClick={handleGoogleLogin} />
      </div>
    </div>
  );
}
