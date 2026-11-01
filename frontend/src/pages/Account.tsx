import { useState } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { sendEmailVerification, signOut } from 'firebase/auth';
import { useAuth } from '../auth/AuthProvider';
import { auth } from '../auth/firebase';
import { authMessage } from '../auth/client';

export default function Account() {
  const { user, account, loading, syncing, error, retry } = useAuth();
  const location = useLocation();
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (!auth)
    return (
      <section className="panel auth-panel">
        <h1>Accounts unavailable</h1>
        <p>Sign-in is not configured yet. You can still play as a guest.</p>
        <Link to="/game">Browse games</Link>
      </section>
    );
  if (loading) return <p role="status">Restoring your session…</p>;
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  async function action(kind: 'logout' | 'verify' | 'refresh') {
    if (!auth || !user) return;
    setBusy(true);
    setMessage('');
    try {
      if (kind === 'logout') await signOut(auth);
      else if (kind === 'verify') {
        await sendEmailVerification(user);
        setMessage('Verification email sent. Check your inbox.');
      } else {
        await user.reload();
        await user.getIdToken(true);
        await retry();
      }
    } catch (e) {
      setMessage(authMessage(e));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="panel auth-panel">
      <h1>Your account</h1>
      {syncing && <p role="status">Loading your account…</p>}
      {error && (
        <div role="alert">
          <p>{error}</p>
          <button className="secondary" onClick={() => void retry()} disabled={syncing}>
            Retry account sync
          </button>
        </div>
      )}
      {account && (
        <>
          <h2>{account.display_name || 'Sports fan'}</h2>
          <p>{account.email || 'No email provided'}</p>
          <p>{account.email_verified ? 'Email verified' : 'Email not verified'}</p>
        </>
      )}
      {!user.emailVerified &&
        user.providerData.some((provider) => provider.providerId === 'password') && (
          <div className="auth-actions">
            <button className="secondary" disabled={busy} onClick={() => void action('verify')}>
              Resend verification email
            </button>
            <button className="secondary" disabled={busy} onClick={() => void action('refresh')}>
              I’ve verified my email
            </button>
          </div>
        )}
      <p role="status">{message}</p>
      <p>
        Your game stats are currently saved on this device. Account stats and league memberships are
        coming later.
      </p>
      <Link to="/locker">View device stats</Link>
      <button className="secondary" disabled={busy} onClick={() => void action('logout')}>
        Sign out
      </button>
    </section>
  );
}
