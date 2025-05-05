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
    const [sessionViewedIds, setSessionViewedIds] = useState(new Set());

    // --- REMOVED User Votes State & Logic ---
    // const [userVotes, setUserVotes] = useState({}); // REMOVED
    // const [loadingVotes, setLoadingVotes] = useState(false); // REMOVED
    // const fetchUserVotes = useCallback(async () => { ... }); // REMOVED

    // Fetch Favorites (Unchanged)
    const fetchFavoriteIds = useCallback(async () => { if (!token) { setFavoriteIds(new Set()); setLoadingFavorites(false); return; } setLoadingFavorites(true); try { const response = await axiosInstance.get('/api/favorites/ids'); setFavoriteIds(new Set(response.data.favoriteMemeIds || [])); } catch (error) { console.error("Failed to fetch favorite IDs:", error); setFavoriteIds(new Set());} finally { setLoadingFavorites(false); } }, [token]);

    // Logout handler - REMOVE userVotes clearing
    const handleLogout = useCallback(() => {
        setToken(null); setUser(null); setFavoriteIds(new Set());
        setSessionViewedIds(new Set());
        // setUserVotes({}); // REMOVED
        localStorage.removeItem('memeflix_token'); setLoading(false);
    }, []);

    // Effect to fetch user data and favorites
    useEffect(() => {
        if (token) {
            localStorage.setItem('memeflix_token', token);
            setLoading(true);
            axiosInstance.get('/api/auth/me')
                .then(response => {
                    setUser(response.data);
                    // Only fetch favorites now
                    Promise.all([ fetchFavoriteIds() ]).finally(() => { setLoading(false); });
                })
                .catch(() => { handleLogout(); });
        } else { handleLogout(); }
    // REMOVED fetchUserVotes from dependencies
    }, [token, fetchFavoriteIds, handleLogout]);

    // Login/Register/Favorites (Unchanged)
    const login = async (username, password) => { try { const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { username, password }); if (response.data.accessToken) { setToken(response.data.accessToken); return { success: true }; } } catch (error) { const msg = error.response?.data?.error || "Login failed"; console.error("Login failed:", msg); return { success: false, error: msg }; } return { success: false, error: "Login failed." }; };
    const register = async (username, email, password) => { try { await axios.post(`${API_BASE_URL}/api/auth/register`, { username, email, password }); return { success: true }; } catch (error) { const msg = error.response?.data?.error || "Register failed"; console.error("Register failed:", msg); return { success: false, error: msg }; } };
    const addFavorite = useCallback(async (memeId) => { if (!user || loadingFavorites) return false; const originalFavorites = new Set(favoriteIds); setFavoriteIds(prev => new Set(prev).add(memeId)); try { await axiosInstance.post(`/api/favorites/${memeId}`); return true; } catch (error) { console.error("Failed to add favorite:", error); setFavoriteIds(originalFavorites); return false; } }, [user, favoriteIds, loadingFavorites]);
    const removeFavorite = useCallback(async (memeId) => { if (!user || loadingFavorites) return false; const originalFavorites = new Set(favoriteIds); setFavoriteIds(prev => { const n = new Set(prev); n.delete(memeId); return n; }); try { await axiosInstance.delete(`/api/favorites/${memeId}`); return true; } catch (error) { console.error("Failed to remove favorite:", error); setFavoriteIds(originalFavorites); return false; } }, [user, favoriteIds, loadingFavorites]);

    // Record View (Unchanged)
    const recordView = useCallback(async (memeId) => { if (!user || !memeId) return; if (!sessionViewedIds.has(memeId)) { setSessionViewedIds(prev => new Set(prev).add(memeId)); } try { await axiosInstance.post(`/api/history/${memeId}`); } catch (error) { console.error(`Failed to record view for meme ${memeId} on backend:`, error); } }, [user, sessionViewedIds]);

    // isViewed Check (Unchanged - still uses session + API flag if passed)
    const isViewed = useCallback((memeId, memeData) => { if (!user) return false; if (memeData?.is_viewed) { return true; } return sessionViewedIds.has(memeId); }, [user, sessionViewedIds]);

    // --- REMOVED Get User Vote Status & Submit Vote ---
    // const getUserVoteStatus = useCallback((memeId) => { ... }); // REMOVED
    // const submitVote = useCallback(async (memeId, voteType) => { ... }); // REMOVED

    // Clear History (Unchanged)
    const clearHistory = useCallback(async () => { if (!user) return { success: false, error: 'User not logged in' }; const originalSessionViewed = new Set(sessionViewedIds); try { const response = await axiosInstance.delete('/api/history/clear'); setSessionViewedIds(new Set()); return { success: true, message: response.data.message }; } catch (error) { console.error("Failed to clear history:", error); return { success: false, error: error.response?.data?.error || 'Failed to clear history.' }; } }, [user, sessionViewedIds]);


    // Define value provided by context
    const value = {
        user, token, loading, login, register, logout: handleLogout,
        isAuthenticated: !!user,
        // Favorites
        favoriteIds, loadingFavorites, addFavorite, removeFavorite,
        isFavorite: (memeId) => favoriteIds.has(memeId),
        // Viewed Status
        isViewed,
        recordView,
        // Votes (REMOVED context functions)
        // History
        clearHistory
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export { axiosInstance };