import React, { useState, useEffect } from 'react'; // Import useEffect
import { useAuth } from '../contexts/AuthContext';
import { useNavigate, Link, useLocation } from 'react-router-dom'; // Import useLocation
import { toast } from 'react-toastify';
import './AuthForm.css';

function LoginPage() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, isAuthenticated, loading: authLoading } = useAuth(); // Get isAuthenticated and authLoading
    const navigate = useNavigate();
    const location = useLocation(); // Get location to potentially redirect back

    // --- NEW: Effect to redirect if already logged in ---
    useEffect(() => {
        // Don't redirect while initial auth check is loading
        if (!authLoading && isAuthenticated) {
            // Get redirect path from location state or default to home
            const from = location.state?.from?.pathname || "/";
            console.log("Already authenticated, navigating to:", from); // Debug log
            navigate(from, { replace: true }); // Redirect to intended page or home
        }
    }, [isAuthenticated, authLoading, navigate, location.state]); // Dependencies

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        const success = await login(username, password);
        // No immediate navigate here - let the useEffect handle it when isAuthenticated changes
        setLoading(false);
        if (success) {
            toast.success('Login Successful!');
            // Navigation will happen via the useEffect hook above
        } else {
            toast.error('Login failed. Please check credentials.');
        }
    };

    // Optional: Show loading indicator if auth state is still loading initially
    if (authLoading) {
        return <div className="loading-fullscreen">Checking authentication...</div>;
    }

    return (
        <div className="auth-page">
            <form className="auth-form" onSubmit={handleSubmit}>
                <h2>Login to Memeflix</h2>
                {/* {error && <p className="error-message">{error}</p>} */}
                <div className="form-group">
                    <label htmlFor="username">Username</label>
                    <input
                        type="text"
                        id="username"
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        required
                        autoComplete="username"
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="password">Password</label>
                    <input
                        type="password"
                        id="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        autoComplete="current-password"
                    />
                </div>
                <button type="submit" disabled={loading || authLoading}> {/* Also disable if auth is loading */}
                    {loading ? 'Logging in...' : 'Login'}
                </button>
                <p className="auth-switch">
                    Don't have an account? <Link to="/register">Register here</Link>
                </p>
            </form>
        </div>
    );
}

export default LoginPage;