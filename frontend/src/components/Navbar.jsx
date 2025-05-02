import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

function Navbar() {
    const [searchParams, setSearchParams] = useSearchParams();
    const [inputValue, setInputValue] = useState(searchParams.get('search') || '');
    const { user, logout, isAuthenticated } = useAuth();
    const navigate = useNavigate();

    const handleInputChange = (event) => {
        setInputValue(event.target.value);
    };

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        const searchTerm = inputValue.trim();
        const currentPath = window.location.pathname;

        if (searchTerm) {
            // Always update the search parameter
            setSearchParams(prev => {
                prev.set('search', searchTerm);
                return prev;
            }, { replace: true });
            // If not already on the home page, navigate there
            if (currentPath !== '/') {
                navigate(`/?search=${encodeURIComponent(searchTerm)}`);
            }
        } else {
            // Clear the search parameter
            setSearchParams(prev => {
                 prev.delete('search');
                 return prev;
            }, { replace: true });
            // Navigate to home if clearing search from another page
             if (currentPath !== '/') {
                 navigate('/');
             }
        }
    };

    const handleLogoutClick = () => {
        logout();
        navigate('/');
    };

    return (
        <nav className="navbar">
            <div className="navbar-brand">
                <Link to="/">Memeflix</Link>
            </div>

            <div className="navbar-search">
                <form onSubmit={handleSearchSubmit} style={{ display: 'flex' }}>
                    <input
                        type="text"
                        placeholder="Search memes..."
                        value={inputValue}
                        onChange={handleInputChange}
                        aria-label="Search memes"
                    />
                    <button type="submit">Search</button>
                </form>
            </div>

            <div className="navbar-links">
                {isAuthenticated ? (
                    <>
                        <Link to="/my-list">My List</Link>
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