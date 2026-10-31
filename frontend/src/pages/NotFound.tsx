import { Link } from 'react-router-dom';
import '../styles/NotFound.css';

const NotFound = () => {
  return (
    <div className="not-found">
      <h1>404</h1>
      <p>The page you're looking for does not exist</p>
      <Link to="/">Return to the homepage</Link>
    </div>
  );
};

export default NotFound;
