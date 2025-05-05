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
    const [userVotes, setUserVotes] = useState({});
    const [sessionViewedIds, setSessionViewedIds] = useState(new Set());

    // Fetch Favorites (Unchanged)
    const fetchFavoriteIds = useCallback(async () => { if (!token) { setFavoriteIds(new Set()); setLoadingFavorites(false); return; } setLoadingFavorites(true); try { const response = await axiosInstance.get('/api/favorites/ids'); setFavoriteIds(new Set(response.data.favoriteMemeIds || [])); } catch (error) { console.error("Failed to fetch favorite IDs:", error); setFavoriteIds(new Set());} finally { setLoadingFavorites(false); } }, [token]);

    // Logout handler (Unchanged)
    const handleLogout = useCallback(() => { setToken(null); setUser(null); setFavoriteIds(new Set()); setSessionViewedIds(new Set()); setUserVotes({}); localStorage.removeItem('memeflix_token'); setLoading(false); }, []);

    // Effect to fetch user data and favorites (Unchanged)
    useEffect(() => { if (token) { localStorage.setItem('memeflix_token', token); setLoading(true); axiosInstance.get('/api/auth/me').then(response => { setUser(response.data); Promise.all([ fetchFavoriteIds() ]).finally(() => { setLoading(false); }); }).catch(() => { handleLogout(); }); } else { handleLogout(); } }, [token, fetchFavoriteIds, handleLogout]);

    // Login/Register/Favorites (Unchanged)
    const login = async (username, password) => { try { const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { username, password }); if (response.data.accessToken) { setToken(response.data.accessToken); return { success: true }; } } catch (error) { const msg = error.response?.data?.error || "Login failed"; console.error("Login failed:", msg); return { success: false, error: msg }; } return { success: false, error: "Login failed." }; };
    const register = async (username, email, password) => { try { await axios.post(`${API_BASE_URL}/api/auth/register`, { username, email, password }); return { success: true }; } catch (error) { const msg = error.response?.data?.error || "Register failed"; console.error("Register failed:", msg); return { success: false, error: msg }; } };
    const addFavorite = useCallback(async (memeId) => { if (!user || loadingFavorites) return false; const originalFavorites = new Set(favoriteIds); setFavoriteIds(prev => new Set(prev).add(memeId)); try { await axiosInstance.post(`/api/favorites/${memeId}`); return true; } catch (error) { console.error("Failed to add favorite:", error); setFavoriteIds(originalFavorites); return false; } }, [user, favoriteIds, loadingFavorites]);
    const removeFavorite = useCallback(async (memeId) => { if (!user || loadingFavorites) return false; const originalFavorites = new Set(favoriteIds); setFavoriteIds(prev => { const n = new Set(prev); n.delete(memeId); return n; }); try { await axiosInstance.delete(`/api/favorites/${memeId}`); return true; } catch (error) { console.error("Failed to remove favorite:", error); setFavoriteIds(originalFavorites); return false; } }, [user, favoriteIds, loadingFavorites]);

    // Record View (Unchanged)
    const recordView = useCallback(async (memeId) => { if (!user || !memeId) return; if (!sessionViewedIds.has(memeId)) { setSessionViewedIds(prev => new Set(prev).add(memeId)); } try { await axiosInstance.post(`/api/history/${memeId}`); } catch (error) { console.error(`Failed to record view for meme ${memeId} on backend:`, error); } }, [user, sessionViewedIds]);

    // Get User Vote Status / Submit Vote (Unchanged)
    const getUserVoteStatus = useCallback((memeId) => { if (!user) return 0; return userVotes[memeId] || 0; }, [user, userVotes]);
    const submitVote = useCallback(async (memeId, voteType) => { if (!user) return { success: false, error: 'User not logged in' }; const voteTypeInt = voteType === 'upvote' ? 1 : -1; const currentVote = userVotes[memeId]; let optimisticVote = voteTypeInt; if (currentVote === voteTypeInt) { optimisticVote = 0; } const originalVotes = {...userVotes}; setUserVotes(prev => { const newVotes = {...prev}; if (optimisticVote === 0) { delete newVotes[memeId]; } else { newVotes[memeId] = optimisticVote; } return newVotes; }); try { const response = await axiosInstance.post(`/api/memes/${memeId}/${voteType}`); return { success: true, message: response.data.message }; } catch (error) { console.error(`Failed to submit ${voteType} for meme ${memeId}:`, error); setUserVotes(originalVotes); return { success: false, error: error.response?.data?.error || `Failed to ${voteType}.` }; } }, [user, userVotes]);

    // Clear History (Unchanged)
    const clearHistory = useCallback(async () => { if (!user) return { success: false, error: 'User not logged in' }; const originalSessionViewed = new Set(sessionViewedIds); try { const response = await axiosInstance.delete('/api/history/clear'); setSessionViewedIds(new Set()); return { success: true, message: response.data.message }; } catch (error) { console.error("Failed to clear history:", error); return { success: false, error: error.response?.data?.error || 'Failed to clear history.' }; } }, [user, sessionViewedIds]);


    // *** CORRECTED isViewed Function ***
    const isViewed = useCallback((memeId, memeData) => {
        // Use 'user' state directly instead of 'isAuthenticated'
        if (!user) return false;
        // Check the flag from the backend API data first
        if (memeData?.is_viewed) {
            return true;
        }
        // Otherwise, check if it was viewed during the current session
        return sessionViewedIds.has(memeId);
    // Update dependency to 'user'
    }, [user, sessionViewedIds]);


    // Define value AFTER all functions are defined
    const value = {
        user, token, loading, login, register, logout: handleLogout,
        isAuthenticated: !!user, // Keep this for external consumption
        // Favorites
        favoriteIds, loadingFavorites, addFavorite, removeFavorite,
        isFavorite: (memeId) => favoriteIds.has(memeId),
        // Viewed Status
        isViewed,      // Expose the corrected function
        recordView,
        // Votes
        getUserVoteStatus,
        submitVote,
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