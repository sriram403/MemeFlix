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
    const [loading, setLoading] = useState(true); // Overall auth loading
    const [favoriteIds, setFavoriteIds] = useState(new Set());
    const [loadingFavorites, setLoadingFavorites] = useState(false);

    // --- NEW: State for Viewed Meme IDs ---
    const [viewedIds, setViewedIds] = useState(new Set());
    const [loadingViewed, setLoadingViewed] = useState(false); // Separate loading state

    const fetchFavoriteIds = useCallback(async () => {
        if (!token) { setFavoriteIds(new Set()); setLoadingFavorites(false); return; }
        setLoadingFavorites(true);
        try {
            const response = await axiosInstance.get('/api/favorites/ids');
            setFavoriteIds(new Set(response.data.favoriteMemeIds || []));
        } catch (error) { console.error("Failed to fetch favorite IDs:", error); setFavoriteIds(new Set());} // Clear on error
        finally { setLoadingFavorites(false); }
    }, [token]); // Depends only on token presence

    // --- NEW: Fetch Viewed IDs ---
    const fetchViewedIds = useCallback(async () => {
        if (!token) { setViewedIds(new Set()); setLoadingViewed(false); return; }
        setLoadingViewed(true);
        try {
            // We fetch the full history and extract IDs.
            // A dedicated `/api/history/ids` endpoint would be more efficient.
            const response = await axiosInstance.get('/api/history', { params: { limit: 1000 } }); // Fetch a large limit
            const ids = (response.data?.memes || []).map(meme => meme.id);
            setViewedIds(new Set(ids));
        } catch (error) {
            console.error("Failed to fetch viewed IDs:", error);
             setViewedIds(new Set()); // Clear on error
        } finally {
             setLoadingViewed(false);
        }
    }, [token]); // Depends only on token presence

    // Logout handler
    const handleLogout = useCallback(() => {
        setToken(null);
        setUser(null);
        setFavoriteIds(new Set());
        setViewedIds(new Set()); // Clear viewed state on logout
        localStorage.removeItem('memeflix_token');
        setLoading(false); // Ensure loading is false after logout
    }, []); // No dependencies needed

    // Effect to fetch user data, favorites, and viewed status when token changes
    useEffect(() => {
        if (token) {
            localStorage.setItem('memeflix_token', token);
            setLoading(true); // Start overall loading
            axiosInstance.get('/api/auth/me')
                .then(response => {
                    setUser(response.data);
                    // Fetch favorites and viewed IDs *after* user is confirmed
                    Promise.all([fetchFavoriteIds(), fetchViewedIds()]).finally(() => {
                        setLoading(false); // Finish overall loading after everything
                    });
                })
                .catch(() => {
                    // If /me fails, logout
                    handleLogout();
                });
        } else {
            // No token, ensure everything is cleared and loading is false
             handleLogout(); // Use handleLogout to clear everything consistently
        }
    }, [token, fetchFavoriteIds, fetchViewedIds, handleLogout]); // Add fetchViewedIds

    const login = async (username, password) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { username, password });
            if (response.data.accessToken) {
                setToken(response.data.accessToken); // This triggers the useEffect above
                return { success: true };
            }
        } catch (error) {
            const msg = error.response?.data?.error || "Login failed";
            console.error("Login failed:", msg);
            return { success: false, error: msg };
        }
        return { success: false, error: "Login failed." };
    };

    const register = async (username, email, password) => {
        try {
            await axios.post(`${API_BASE_URL}/api/auth/register`, { username, email, password });
            return { success: true };
        } catch (error) {
            const msg = error.response?.data?.error || "Register failed";
            console.error("Register failed:", msg);
            return { success: false, error: msg };
        }
    };

    const addFavorite = useCallback(async (memeId) => {
        if (!user || loadingFavorites) return false;
        const originalFavorites = new Set(favoriteIds);
        setFavoriteIds(prev => new Set(prev).add(memeId));
        try { await axiosInstance.post(`/api/favorites/${memeId}`); return true; }
        catch (error) { console.error("Failed to add favorite:", error); setFavoriteIds(originalFavorites); return false; }
    }, [user, favoriteIds, loadingFavorites]);

    const removeFavorite = useCallback(async (memeId) => {
        if (!user || loadingFavorites) return false;
        const originalFavorites = new Set(favoriteIds);
        setFavoriteIds(prev => { const n = new Set(prev); n.delete(memeId); return n; });
        try { await axiosInstance.delete(`/api/favorites/${memeId}`); return true; }
        catch (error) { console.error("Failed to remove favorite:", error); setFavoriteIds(originalFavorites); return false; }
    }, [user, favoriteIds, loadingFavorites]);

    // Record view: Add memeId to viewedIds optimistically
    const recordView = useCallback(async (memeId) => {
        if (!user || !memeId || viewedIds.has(memeId)) return; // Only record if logged in, valid ID, and not already marked viewed

        // Optimistic update
        setViewedIds(prev => new Set(prev).add(memeId));

        try {
            await axiosInstance.post(`/api/history/${memeId}`);
        } catch (error) {
            console.error(`Failed to record view for meme ${memeId}:`, error);
             // Optional: Revert optimistic update on error?
             // setViewedIds(prev => { const n = new Set(prev); n.delete(memeId); return n; });
        }
    }, [user, viewedIds]); // Added viewedIds dependency

    // --- NEW: Function to check if a meme is viewed ---
    // *** CORRECTED: Check 'user' state directly ***
    const isViewed = useCallback((memeId) => {
        return !!user && viewedIds.has(memeId); // Check if user exists and ID is in set
    }, [user, viewedIds]); // Update dependencies

    // --- Define value AFTER all functions are defined ---
    const value = {
        user, token, loading, login, register, logout: handleLogout,
        isAuthenticated: !!user, // Keep this for external use
        // Favorites
        favoriteIds, loadingFavorites, addFavorite, removeFavorite,
        isFavorite: (memeId) => favoriteIds.has(memeId),
        // Viewed Status
        loadingViewed, // Expose loading state for viewed IDs
        isViewed,      // Expose the corrected function
        recordView     // recordView now also updates local state
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export { axiosInstance };