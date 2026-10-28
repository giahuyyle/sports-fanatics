import { Routes, Route, Link } from 'react-router-dom';
import Navbar from './components/Navbar';
import NotFound from './pages/NotFound';

function App() {
    return (
        <div className="app-container">
            <Navbar />

            <div className='app-content'>
                <Routes>
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </div>
        </div>
    );
}
 
export default App;