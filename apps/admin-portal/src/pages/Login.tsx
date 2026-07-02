import React, { useState } from 'react';
import { useAuth } from '../auth/AuthContext';
import { NewPasswordRequiredError } from '../auth/CognitoService';
import { SHOP_NAME, SHOP_CITY } from '../constants';

type Step = 'login' | 'new-password';

export default function Login() {
  const { login, completeNewPassword } = useAuth();
  const [step, setStep] = useState<Step>('login');

  // Login step state
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // New password step state
  const [newPassword, setNewPassword] = useState('');
  const [confirmNew, setConfirmNew] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Email and password are required.'); return; }
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (err: unknown) {
      if (err instanceof NewPasswordRequiredError) {
        setStep('new-password');
      } else {
        const msg = err instanceof Error ? err.message : 'Login failed. Please try again.';
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPassword || !confirmNew) { setError('Both fields are required.'); return; }
    if (newPassword !== confirmNew) { setError('Passwords do not match.'); return; }
    if (newPassword.length < 8) { setError('Password must be at least 8 characters.'); return; }
    setError('');
    setLoading(true);
    try {
      await completeNewPassword(newPassword);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to set password. Please try again.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (step === 'new-password') {
    return (
      <div style={styles.root}>
        <div style={styles.card}>
          <div style={styles.logoWrap}><div style={styles.logo}>🔧</div></div>
          <h1 style={styles.title}>Set New Password</h1>
          <p style={styles.subtitle}>Your account requires a new password before you can continue.</p>

          {error && (
            <div style={styles.error}><span>⚠️</span><span>{error}</span></div>
          )}

          <form onSubmit={handleNewPassword} style={styles.form}>
            <label style={styles.label}>New Password</label>
            <div style={styles.passwordWrap}>
              <input
                type={showNewPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 8 characters"
                style={{ ...styles.input, paddingRight: '44px' }}
                autoComplete="new-password"
                required
              />
              <button type="button" onClick={() => setShowNewPassword((v) => !v)} style={styles.eyeBtn}>
                {showNewPassword ? '🙈' : '👁️'}
              </button>
            </div>

            <label style={styles.label}>Confirm New Password</label>
            <input
              type={showNewPassword ? 'text' : 'password'}
              value={confirmNew}
              onChange={(e) => setConfirmNew(e.target.value)}
              placeholder="Repeat new password"
              style={styles.input}
              autoComplete="new-password"
              required
            />

            <button type="submit" style={styles.btn} disabled={loading}>
              {loading ? 'Setting password…' : 'Set Password & Sign In'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.card}>
        <div style={styles.logoWrap}><div style={styles.logo}>🔧</div></div>
        <h1 style={styles.title}>{SHOP_NAME}</h1>
        {SHOP_CITY && <p style={styles.cityLabel}>{SHOP_CITY}</p>}
        <span style={styles.badge}>ADMIN PORTAL</span>
        <p style={styles.subtitle}>Sign in with your admin credentials</p>

        {error && (
          <div style={styles.error}><span>⚠️</span><span>{error}</span></div>
        )}

        <form onSubmit={handleLogin} style={styles.form}>
          <label style={styles.label}>Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@yourshop.com"
            style={styles.input}
            autoComplete="email"
            required
          />

          <label style={styles.label}>Password</label>
          <div style={styles.passwordWrap}>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              style={{ ...styles.input, paddingRight: '44px' }}
              autoComplete="current-password"
              required
            />
            <button type="button" onClick={() => setShowPassword((v) => !v)} style={styles.eyeBtn}>
              {showPassword ? '🙈' : '👁️'}
            </button>
          </div>

          <button type="submit" style={styles.btn} disabled={loading}>
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={styles.hint}>Admin accounts are created by your platform administrator.</p>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    backgroundColor: 'var(--color-background)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
  },
  card: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '16px',
    padding: '40px 36px',
    width: '100%',
    maxWidth: '400px',
    boxShadow: 'var(--shadow-lg)',
    border: '1px solid var(--color-border)',
    textAlign: 'center',
  },
  logoWrap: { display: 'flex', justifyContent: 'center', marginBottom: '16px' },
  logo: {
    width: '72px', height: '72px', borderRadius: '50%',
    backgroundColor: 'var(--color-primary)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '32px',
  },
  title: { fontSize: '22px', fontWeight: 700, color: 'var(--color-primary)', margin: '0 0 2px' },
  cityLabel: { fontSize: '12px', color: 'var(--color-text-muted)', margin: '0 0 8px' },
  badge: {
    display: 'inline-block', fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px',
    color: 'var(--color-secondary)', backgroundColor: 'rgba(245,158,11,0.12)',
    border: '1px solid rgba(245,158,11,0.3)', borderRadius: '4px',
    padding: '2px 8px', marginBottom: '8px',
  },
  subtitle: { fontSize: '14px', color: 'var(--color-text-secondary)', margin: '0 0 24px' },
  error: {
    display: 'flex', alignItems: 'center', gap: '8px',
    backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: '8px', padding: '10px 12px', marginBottom: '16px',
    fontSize: '13px', color: 'var(--color-error)', textAlign: 'left',
  },
  form: { textAlign: 'left' },
  label: {
    display: 'block', fontSize: '13px', fontWeight: 600,
    color: 'var(--color-text-primary)', marginBottom: '6px', marginTop: '16px',
  },
  input: {
    width: '100%', padding: '11px 14px', borderRadius: '8px',
    border: '1px solid var(--color-border)', fontSize: '15px',
    color: 'var(--color-text-primary)', backgroundColor: 'var(--color-background)',
    outline: 'none', boxSizing: 'border-box',
  },
  passwordWrap: { position: 'relative' },
  eyeBtn: {
    position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)',
    background: 'none', border: 'none', cursor: 'pointer', fontSize: '16px', padding: '4px',
  },
  btn: {
    width: '100%', padding: '13px', marginTop: '24px',
    backgroundColor: 'var(--color-secondary)', color: 'var(--color-primary)',
    border: 'none', borderRadius: '10px', fontSize: '16px', fontWeight: 700,
    cursor: 'pointer',
  },
  hint: { marginTop: '16px', fontSize: '12px', color: 'var(--color-text-muted)' },
};
