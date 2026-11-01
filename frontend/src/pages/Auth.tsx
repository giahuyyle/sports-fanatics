import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth } from '../auth/firebase';
import { useAuth } from '../auth/AuthProvider';
import { authMessage } from '../auth/client';

export default function Auth({ mode }: { mode: 'login' | 'signup' | 'reset' }) {
  const { user, account, loading, syncing, error, retry } = useAuth();
  const location = useLocation();
  const from: unknown = location.state?.from;
  const destination =
    typeof from === 'string' &&
    from.startsWith('/') &&
    !from.startsWith('//') &&
    !from.includes('\\') &&
    !['/login', '/signup', '/forgot-password'].includes(from.split('?')[0])
      ? from
      : '/account';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [formError, setFormError] = useState('');
  const title =
    mode === 'signup'
      ? 'Create your account'
      : mode === 'reset'
        ? 'Reset your password'
        : 'Welcome back';
  if (!auth)
    return (
      <section className="panel auth-panel">
        <h1>Accounts unavailable</h1>
        <p>Sign-in is not configured yet. You can still play as a guest.</p>
        <Link to="/game">Browse games</Link>
      </section>
    );
  if (loading) return <p role="status">Restoring your session…</p>;
  if (user && account && !busy && mode !== 'reset') return <Navigate to={destination} replace />;
  async function submit(event?: FormEvent, google = false) {
    event?.preventDefault();
    if (!auth || busy) return;
    setBusy(true);
    setFormError('');
    setMessage('');
    try {
      if (google) await signInWithPopup(auth, new GoogleAuthProvider());
      else if (mode === 'reset') {
        await sendPasswordResetEmail(auth, email);
        setMessage('If an account exists for this email, you’ll receive a password reset link.');
      } else if (mode === 'signup') {
        const result = await createUserWithEmailAndPassword(auth, email, password);
        try {
          await sendEmailVerification(result.user);
        } catch {
          setFormError(
            'Account created, but the verification email could not be sent. Resend it from your account page.',
          );
        }
      } else await signInWithEmailAndPassword(auth, email, password);
    } catch (e) {
      setFormError(authMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel auth-panel">
      <h1>{title}</h1>
      {mode !== 'reset' && !user && (
        <p className="auth-intro">
          <span>
            {mode === 'login' ? 'Don’t have an account?' : 'Already have an account?'}{' '}
            <Link to={mode === 'login' ? '/signup' : '/login'} state={{ from: destination }}>
              {mode === 'login' ? 'Sign Up' : 'Sign In'}
            </Link>
          </span>
          <span>
            or <Link to="/game">Continue as Guest</Link>
          </span>
        </p>
      )}
      {user && mode !== 'reset' ? (
        <>
          {syncing && <p role="status">Setting up your account…</p>}
          {error && (
            <div role="alert">
              <p>{error}</p>
              <button className="secondary" disabled={syncing} onClick={() => void retry()}>
                Retry account sync
              </button>
              <Link to="/account">Manage account</Link>
            </div>
          )}
        </>
      ) : (
        <>
          <form onSubmit={(event) => void submit(event)}>
            <label htmlFor="auth-email">Email</label>
            <input
              id="auth-email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              disabled={busy}
            />
            {mode !== 'reset' && (
              <>
                <label htmlFor="auth-password">Password</label>
                <input
                  id="auth-password"
                  type="password"
                  autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                  required
                  minLength={mode === 'signup' ? 6 : undefined}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  disabled={busy}
                />
              </>
            )}
            <button className="primary" disabled={busy}>
              {busy
                ? 'Please wait…'
                : mode === 'signup'
                  ? 'Sign up'
                  : mode === 'reset'
                    ? 'Send reset link'
                    : 'Sign in'}
            </button>
          </form>
          {mode !== 'reset' && (
            <button
              className="secondary"
              disabled={busy}
              onClick={() => void submit(undefined, true)}
            >
              Continue with Google
            </button>
          )}
        </>
      )}
      {formError && <p role="alert">{formError}</p>}
      {message && <p role="status">{message}</p>}
      {mode !== 'signup' && (
        <div className="auth-actions">
          {mode === 'reset' && (
            <Link to="/login" state={{ from: destination }}>
              Sign in
            </Link>
          )}
          {mode === 'login' && <Link to="/forgot-password">Forgot password?</Link>}
          {mode === 'reset' && <Link to="/game">Continue as Guest</Link>}
        </div>
      )}
    </section>
  );
}
