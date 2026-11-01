import { useState } from 'react';
import { UserRound } from 'lucide-react';
import { Link, NavLink } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
export default function Navbar() {
  const { user, loading } = useAuth();
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null);
  const google = user?.providerData.find((provider) => provider.providerId === 'google.com');
  const photo = google?.photoURL || (google ? user?.photoURL : null);
  const initial = (user?.email?.trim()[0] || user?.displayName?.trim()[0] || '?').toUpperCase();
  const accountLabel = loading ? 'Loading account' : user ? 'Your account' : 'Log in';
  return (
    <header className="header">
      <Link className="brand" to="/" aria-label="Sports Fanatics home">
        <span className="brand-icon">sf.</span>
        <span>sports fanatics</span>
      </Link>
      <nav aria-label="Main navigation">
        <NavLink className="nav" to="/" end>
          The Hub
        </NavLink>
        <NavLink className="nav" to="/game">
          Minigames
        </NavLink>
        <NavLink className="nav" to="/fantasy">
          Fantasy League
        </NavLink>
      </nav>
      <div className="header-account">
        <NavLink className="profile" to="/locker">
          My locker
        </NavLink>
        <NavLink
          className="account-avatar"
          to={user ? '/account' : '/login'}
          aria-label={accountLabel}
          title={accountLabel}
          aria-busy={loading}
        >
          {photo && failedPhoto !== photo ? (
            <img
              src={photo}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setFailedPhoto(photo)}
            />
          ) : user ? (
            <span aria-hidden="true">{initial}</span>
          ) : (
            <UserRound size={20} strokeWidth={1.7} aria-hidden="true" />
          )}
        </NavLink>
      </div>
    </header>
  );
}
