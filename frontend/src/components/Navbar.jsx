// frontend/src/components/Navbar.jsx
// You can copy-paste the whole file content below

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Import Link and useNavigate
import { useAuth } from '../contexts/AuthContext'; // Import useAuth
import './Navbar.css';

// Removed onSearch prop for now, handle locally or via context if needed later
function Navbar({ onSearch /* Remove if search logic changes */ }) {
    const [inputValue, setInputValue] = useState('');
    const { user, logout, isAuthenticated } = useAuth(); // Get auth state and logout function
    const navigate = useNavigate(); // Hook for navigation

    const handleInputChange = (event) => {
        setInputValue(event.target.value);
    };

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        // If onSearch prop exists, call it
        if (onSearch) {
           onSearch(inputValue);
        } else {
            // Basic search redirect (can be improved)
            if (inputValue.trim()) {
                navigate(`/?search=${encodeURIComponent(inputValue)}`); // Example search via query param
            }
        }
    };

    const handleLogoutClick = () => {
        logout();
        navigate('/'); // Redirect to home after logout
    };

    return (
        <form className="navbar" onSubmit={handleSearchSubmit}>
            <div className="navbar-brand">
                <Link to="/">Memeflix</Link> {/* Link brand to home */}
            </div>

            {/* Search remains */}
            <div className="navbar-search">
                <input
                    type="text"
                    placeholder="Search memes..."
                    value={inputValue}
                    onChange={handleInputChange}
                />
                <button type="submit">Search</button>
            </div>

            {/* Conditional Auth Links */}
            <div className="navbar-links">
                {isAuthenticated ? (
                    <>
                        {/* Optional: Link to a user profile page */}
                        {/* <Link to="/profile">{user.username}</Link> */}
                        <span className="navbar-username">Welcome, {user.username}!</span>
                        <button type="button" onClick={handleLogoutClick} className="logout-button">Logout</button>
                    </>
                ) : (
                    <>
                        <Link to="/login">Login</Link>
                        <Link to="/register">Register</Link>
                    </>
                )}
            </div>
        </form>
    );
}

export default Navbar;