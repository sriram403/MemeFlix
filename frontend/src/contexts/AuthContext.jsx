// frontend/src/contexts/AuthContext.jsx
import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001';

const AuthContext = createContext(null);

const axiosInstance = axios.create({ baseURL: API_BASE_URL });

axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('memeflix_token');
        if (token) config.headers['Authorization'] = `Bearer ${token}`;
        return config;
    },
    (error) => Promise.reject(error)
);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(localStorage.getItem('memeflix_token'));
    const [loading, setLoading] = useState(true);
    const [favoriteIds, setFavoriteIds] = useState(new Set());
    const [loadingFavorites, setLoadingFavorites] = useState(false);

    const fetchFavoriteIds = useCallback(async () => {
        if (!token) { setFavoriteIds(new Set()); setLoadingFavorites(false); return; }
        setLoadingFavorites(true);
        try {
            const response = await axiosInstance.get('/api/favorites/ids');
            setFavoriteIds(new Set(response.data.favoriteMemeIds || []));
        } catch (error) { console.error("Failed to fetch favorite IDs:", error); }
        finally { setLoadingFavorites(false); }
    }, [token]);

    const handleLogout = useCallback(() => { setToken(null); }, []);

    useEffect(() => {
        if (token) {
            localStorage.setItem('memeflix_token', token);
            setLoading(true);
            axiosInstance.get('/api/auth/me')
                .then(response => { setUser(response.data); fetchFavoriteIds(); })
                .catch(() => handleLogout())
                .finally(() => setLoading(false));
        } else {
            localStorage.removeItem('memeflix_token');
            setUser(null); setFavoriteIds(new Set()); setLoading(false);
        }
    }, [token, fetchFavoriteIds, handleLogout]);

    const login = async (username, password) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { username, password });
            if (response.data.accessToken) { setToken(response.data.accessToken); return { success: true }; }
        } catch (error) { const msg = error.response?.data?.error || "Login failed"; console.error("Login failed:", msg); return { success: false, error: msg }; }
        return { success: false, error: "Login failed." };
    };

    const register = async (username, email, password) => {
        try {
            await axios.post(`${API_BASE_URL}/api/auth/register`, { username, email, password });
            return { success: true };
        } catch (error) { const msg = error.response?.data?.error || "Register failed"; console.error("Register failed:", msg); return { success: false, error: msg }; }
    };

    const addFavorite = useCallback(async (memeId) => { /* ... same as before ... */
        if (!user) return false;
        const originalFavorites = new Set(favoriteIds);
        setFavoriteIds(prev => new Set(prev).add(memeId));
        try { await axiosInstance.post(`/api/favorites/${memeId}`); return true; }
        catch (error) { console.error("Failed to add favorite:", error); setFavoriteIds(originalFavorites); return false; }
    }, [user, favoriteIds]);

    const removeFavorite = useCallback(async (memeId) => { /* ... same as before ... */
        if (!user) return false;
        const originalFavorites = new Set(favoriteIds);
        setFavoriteIds(prev => { const n = new Set(prev); n.delete(memeId); return n; });
        try { await axiosInstance.delete(`/api/favorites/${memeId}`); return true; }
        catch (error) { console.error("Failed to remove favorite:", error); setFavoriteIds(originalFavorites); return false; }
    }, [user, favoriteIds]);

    // --- NEW: Function to record view history ---
    const recordView = useCallback(async (memeId) => {
        if (!user || !memeId) return; // Only record if logged in and memeId is valid
        try {
            // Fire-and-forget: send request but don't necessarily wait or handle response complexly
            axiosInstance.post(`/api/history/${memeId}`);
            // console.log(`Recorded view for meme ${memeId}`);
        } catch (error) {
            // Log error but don't block UI
            console.error(`Failed to record view for meme ${memeId}:`, error);
        }
    }, [user]); // Depends only on user object existence


    const value = {
        user, token, loading, login, register, logout: handleLogout,
        isAuthenticated: !!user, favoriteIds, loadingFavorites, addFavorite,
        removeFavorite, isFavorite: (memeId) => favoriteIds.has(memeId),
        recordView // <-- Expose the recordView function
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export { axiosInstance };