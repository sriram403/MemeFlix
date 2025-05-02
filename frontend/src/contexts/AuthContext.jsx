// frontend/src/contexts/AuthContext.jsx
// You can copy-paste the whole file content below

import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001'; // Your backend URL

// Create the context
const AuthContext = createContext(null);

// Create an Axios instance for API calls that might need auth
const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
});

// Interceptor to add token to requests
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('memeflix_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);


// Create the provider component
export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null); // Holds logged-in user info { id, username }
    const [token, setToken] = useState(localStorage.getItem('memeflix_token')); // Get token from storage
    const [loading, setLoading] = useState(true); // Loading state for initial auth check

    // Effect to set token in axios instance and local storage
    useEffect(() => {
        if (token) {
            localStorage.setItem('memeflix_token', token);
            // Verify token and fetch user info on initial load or token change
            axiosInstance.get('/api/auth/me')
                .then(response => {
                    setUser(response.data); // Set user info from /me endpoint
                })
                .catch(() => {
                    // Token invalid or expired
                    handleLogout(); // Clear invalid token and user state
                })
                .finally(() => {
                    setLoading(false);
                });

        } else {
            localStorage.removeItem('memeflix_token');
            setUser(null);
            setLoading(false); // No token, not loading
        }
    }, [token]);

    // Login function
    const login = async (username, password) => {
        try {
            const response = await axiosInstance.post('/api/auth/login', { username, password });
            if (response.data.accessToken) {
                setToken(response.data.accessToken); // Trigger useEffect to save token and fetch user
                // setUser(response.data.user); // User state will be set by useEffect after /me call
                return true; // Indicate success
            }
        } catch (error) {
            console.error("Login failed:", error.response?.data?.error || error.message);
            // Handle specific errors (e.g., invalid credentials) if needed
        }
        return false; // Indicate failure
    };

    // Registration function
    const register = async (username, email, password) => {
        try {
            const response = await axiosInstance.post('/api/auth/register', { username, email, password });
            // Maybe automatically log in after registration? Or just show success.
            console.log("Registration successful:", response.data);
            return true; // Indicate success
        } catch (error) {
            console.error("Registration failed:", error.response?.data?.error || error.message);
            // Handle specific errors (e.g., user exists)
        }
         return false; // Indicate failure
    };

    // Logout function
    const handleLogout = () => {
        setToken(null); // This will trigger useEffect to clear localStorage and user
    };

    // Value provided by the context
    const value = {
        user,
        token,
        loading, // Provide loading state for initial auth check
        login,
        register,
        logout: handleLogout,
        isAuthenticated: !!user, // Boolean flag for convenience
    };

    return (
        <AuthContext.Provider value={value}>
            {/* Don't render children until initial auth check is done */}
            {!loading && children}
        </AuthContext.Provider>
    );
};

// Custom hook to use the auth context
export const useAuth = () => {
    return useContext(AuthContext);
};

// Export the Axios instance if other parts of the app need it
export { axiosInstance };