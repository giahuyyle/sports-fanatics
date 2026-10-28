import { Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar';

function App() {
    return (
        <div className="app-container">
            <Navbar />

            <div className='app-content'>
                <h1>Hello</h1>
            </div>
        </div>
    );
}
 
export default App;