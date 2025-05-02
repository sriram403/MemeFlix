import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

const API_BASE_URL = 'http://localhost:3001';

const AuthContext = createContext(null);

const axiosInstance = axios.create({ baseURL: API_BASE_URL });

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
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(() => localStorage.getItem('memeflix_token')); // Use function initializer
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (token) {
            localStorage.setItem('memeflix_token', token);
            setLoading(true); // Set loading true while verifying token
            axiosInstance.get('/api/auth/me')
                .then(response => { setUser(response.data); })
                .catch(() => { handleLogout(false); }) // Pass false to prevent redundant toast
                .finally(() => { setLoading(false); });
        } else {
            localStorage.removeItem('memeflix_token');
            setUser(null);
            setLoading(false);
        }
        // Don't depend on handleLogout here
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
    // Updated logout to accept flag and show toast
    const handleLogout = (showToast = true) => {
        setToken(null); // Triggers useEffect to clear storage and user
        if (showToast) {
            toast.success("You have been logged out.");
        }
    };

    // Value provided by the context
    const value = {
        user,
        token,
        loading,
        login,
        register,
        logout: handleLogout, // Provide the updated handler
        isAuthenticated: !!user,
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => { return useContext(AuthContext); };
export { axiosInstance };