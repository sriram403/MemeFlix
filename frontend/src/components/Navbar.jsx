// frontend/src/components/Navbar.jsx
import React, { useState, useEffect } from 'react'; // Added useEffect
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

function Navbar() {
    const [searchParams] = useSearchParams(); // Keep for reading initial
    const [inputValue, setInputValue] = useState(''); // Local input state
    const { user, logout, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    // Sync input value if search param changes externally (e.g., back button)
    useEffect(() => {
        setInputValue(searchParams.get('search') || '');
    }, [searchParams]);

    const handleInputChange = (event) => setInputValue(event.target.value);

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        const searchTerm = inputValue.trim();
        if (searchTerm) {
            // Navigate to browse page with search query
            navigate(`/browse?search=${encodeURIComponent(searchTerm)}`);
        } else {
            // If search is cleared, maybe navigate to base browse page? Or home?
            navigate('/browse'); // Navigate to browse even if search is empty
        }
    };

    const handleLogoutClick = () => { logout(); navigate('/'); };

    return (
        <nav className="navbar">
            <div className="navbar-brand"><Link to="/">Memeflix</Link></div>
            <div className="navbar-search">
                <form onSubmit={handleSearchSubmit} style={{ display: 'flex' }}>
                    <input type="text" placeholder="Search memes..." value={inputValue} onChange={handleInputChange} aria-label="Search memes"/>
                    <button type="submit">Search</button>
                </form>
            </div>
            <div className="navbar-links">
                {/* --- NEW: Browse Link --- */}
                 <Link to="/browse" title="Browse All" aria-label="Browse All">Browse</Link>
                 {/* --- End Browse Link --- */}
                {isAuthenticated ? (
                    <>
                        <Link to="/my-list" className="navbar-my-list-link" title="My List" aria-label="My List">
                            <span className="my-list-icon">❤️</span>
                            <span className="my-list-text">My List</span>
                        </Link>
                        <Link to="/history" title="Viewing History" aria-label="Viewing History">History</Link>
                        <span className="navbar-username">Hi, {user.username}!</span>
                        <button type="button" onClick={handleLogoutClick} className="logout-button">Logout</button>
                    </>
                ) : (
                    <>
                        <Link to="/login">Login</Link>
                        <Link to="/register">Register</Link>
                    </>
                )}
            </div>
        </nav>
    );
}

export default Navbar;