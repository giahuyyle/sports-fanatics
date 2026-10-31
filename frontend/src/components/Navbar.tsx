import { Link, NavLink } from 'react-router-dom';
export default function Navbar() {
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
      <NavLink className="profile" to="/locker">
        My locker
      </NavLink>
    </header>
  );
}
