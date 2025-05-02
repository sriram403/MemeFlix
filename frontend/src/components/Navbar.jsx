// frontend/src/components/Navbar.jsx
// You can copy-paste the whole file content below

import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom'; // Added useSearchParams
import { useAuth } from '../contexts/AuthContext';
import './Navbar.css';

// Receive onAuthPage prop
function Navbar({ onAuthPage }) {
    const [inputValue, setInputValue] = useState('');
    const { user, logout, isAuthenticated } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams(); // Hook to manipulate search params

    const handleInputChange = (event) => {
        setInputValue(event.target.value);
    };

    const handleSearchSubmit = (event) => {
        event.preventDefault();
        // Update URL search parameter instead of relying on prop
        if (inputValue.trim()) {
             setSearchParams({ search: inputValue }); // Set/update search param
        } else {
             setSearchParams({}); // Clear search param if input is empty
        }
        // Clear input field after search? Optional.
        // setInputValue('');
    };

    const handleLogoutClick = () => {
        logout();
        setSearchParams({}); // Clear search on logout
        navigate('/');
    };

    return (
        // Remove form wrapper if not needed or adjust onSubmit logic
        <nav className="navbar"> {/* Changed back to nav from form */}
            <div className="navbar-brand">
                <Link to="/" onClick={() => setSearchParams({})}>Memeflix</Link> {/* Clear search on brand click */}
            </div>

            {/* --- Conditionally Render Search Bar --- */}
            {!onAuthPage && ( // Only show search if NOT on an auth page
                 <form className="navbar-search" onSubmit={handleSearchSubmit}>
                    <input
                        type="text"
                        placeholder="Search memes..."
                        value={inputValue}
                        onChange={handleInputChange}
                        aria-label="Search memes"
                    />
                    <button type="submit">Search</button>
                </form>
            )}
            {/* --- End Conditional Search Bar --- */}


            <div className="navbar-links">
                {isAuthenticated ? (
                    <>
                        <span className="navbar-username">Welcome, {user.username}!</span>
                        <button type="button" onClick={handleLogoutClick} className="logout-button">Logout</button>
                    </>
                ) : (
                    <>
                        {/* Only show auth links if not on an auth page */}
                        {!onAuthPage && <Link to="/login">Login</Link>}
                        {!onAuthPage && <Link to="/register">Register</Link>}
                    </>
                )}
            </div>
        </nav>
    );
}

export default Navbar;