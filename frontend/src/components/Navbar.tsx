import { Link } from "react-router-dom";
import "../styles/Navbar.css";

const Navbar = () => {
    return (
        <nav className="navbar">
            <h1>Sports Fanatics</h1>
            <div className="nav-links">
                <Link to="/">Home</Link>
                <Link to="/game">Games</Link>
            </div>
        </nav>
    );
}
 
export default Navbar;