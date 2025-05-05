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
    const [viewedIds, setViewedIds] = useState(new Set());
    const [loadingViewed, setLoadingViewed] = useState(false);

    // --- NEW: State for User Votes ---
    // Stores votes as { memeId: voteTypeInt } e.g., { 13: 1, 25: -1 }
    const [userVotes, setUserVotes] = useState({});
    const [loadingVotes, setLoadingVotes] = useState(false);

    // Fetch Favorites (Unchanged)
    const fetchFavoriteIds = useCallback(async () => { if (!token) { setFavoriteIds(new Set()); setLoadingFavorites(false); return; } setLoadingFavorites(true); try { const response = await axiosInstance.get('/api/favorites/ids'); setFavoriteIds(new Set(response.data.favoriteMemeIds || [])); } catch (error) { console.error("Failed to fetch favorite IDs:", error); setFavoriteIds(new Set());} finally { setLoadingFavorites(false); } }, [token]);
    // Fetch Viewed IDs (Unchanged)
    const fetchViewedIds = useCallback(async () => { if (!token) { setViewedIds(new Set()); setLoadingViewed(false); return; } setLoadingViewed(true); try { const response = await axiosInstance.get('/api/history', { params: { limit: 1000 } }); const ids = (response.data?.memes || []).map(meme => meme.id); setViewedIds(new Set(ids)); } catch (error) { console.error("Failed to fetch viewed IDs:", error); setViewedIds(new Set()); } finally { setLoadingViewed(false); } }, [token]);

    // --- NEW: Fetch User Votes ---
    // Need a new backend endpoint for this ideally: GET /api/votes
    // For now, we can't easily fetch this without modifying meme endpoints.
    // We will *infer* the vote state based on API call results in handleVote.
    // TODO: Implement GET /api/votes endpoint and fetchUserVotes function.
    // const fetchUserVotes = useCallback(async () => {
    //     if (!token) { setUserVotes({}); setLoadingVotes(false); return; }
    //     setLoadingVotes(true);
    //     try {
    //         // const response = await axiosInstance.get('/api/votes'); // Hypothetical endpoint
    //         // setUserVotes(response.data.votes || {}); // Assuming format { memeId: voteType }
    //     } catch (error) {
    //         console.error("Failed to fetch user votes:", error);
    //         setUserVotes({});
    //     } finally {
    //         setLoadingVotes(false);
    //     }
    // }, [token]);

    // Logout handler
    const handleLogout = useCallback(() => {
        setToken(null); setUser(null); setFavoriteIds(new Set());
        setViewedIds(new Set()); setUserVotes({}); // Clear votes on logout
        localStorage.removeItem('memeflix_token'); setLoading(false);
    }, []);

    // Effect to fetch user data and associated states
    useEffect(() => {
        if (token) {
            localStorage.setItem('memeflix_token', token);
            setLoading(true);
            axiosInstance.get('/api/auth/me')
                .then(response => {
                    setUser(response.data);
                    // Fetch favorites, viewed, and votes (when implemented)
                    Promise.all([
                        fetchFavoriteIds(),
                        fetchViewedIds(),
                        // fetchUserVotes() // Call when implemented
                    ]).finally(() => {
                        setLoading(false);
                    });
                })
                .catch(() => { handleLogout(); });
        } else { handleLogout(); }
        // Add fetchUserVotes when implemented
    }, [token, fetchFavoriteIds, fetchViewedIds, handleLogout]);

    // Login/Register (Unchanged)
    const login = async (username, password) => { try { const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { username, password }); if (response.data.accessToken) { setToken(response.data.accessToken); return { success: true }; } } catch (error) { const msg = error.response?.data?.error || "Login failed"; console.error("Login failed:", msg); return { success: false, error: msg }; } return { success: false, error: "Login failed." }; };
    const register = async (username, email, password) => { try { await axios.post(`${API_BASE_URL}/api/auth/register`, { username, email, password }); return { success: true }; } catch (error) { const msg = error.response?.data?.error || "Register failed"; console.error("Register failed:", msg); return { success: false, error: msg }; } };
    // Add/Remove Favorite (Unchanged)
    const addFavorite = useCallback(async (memeId) => { if (!user || loadingFavorites) return false; const originalFavorites = new Set(favoriteIds); setFavoriteIds(prev => new Set(prev).add(memeId)); try { await axiosInstance.post(`/api/favorites/${memeId}`); return true; } catch (error) { console.error("Failed to add favorite:", error); setFavoriteIds(originalFavorites); return false; } }, [user, favoriteIds, loadingFavorites]);
    const removeFavorite = useCallback(async (memeId) => { if (!user || loadingFavorites) return false; const originalFavorites = new Set(favoriteIds); setFavoriteIds(prev => { const n = new Set(prev); n.delete(memeId); return n; }); try { await axiosInstance.delete(`/api/favorites/${memeId}`); return true; } catch (error) { console.error("Failed to remove favorite:", error); setFavoriteIds(originalFavorites); return false; } }, [user, favoriteIds, loadingFavorites]);
    // Record View (Unchanged)
    const recordView = useCallback(async (memeId) => { if (!user || !memeId || viewedIds.has(memeId)) return; setViewedIds(prev => new Set(prev).add(memeId)); try { await axiosInstance.post(`/api/history/${memeId}`); } catch (error) { console.error(`Failed to record view for meme ${memeId}:`, error); } }, [user, viewedIds]);
    // isViewed Check (Unchanged)
    const isViewed = useCallback((memeId) => { return !!user && viewedIds.has(memeId); }, [user, viewedIds]);

    // --- NEW: Get User Vote Status ---
    // Returns 1 for upvote, -1 for downvote, 0 for no vote
    const getUserVoteStatus = useCallback((memeId) => {
        if (!user) return 0;
        return userVotes[memeId] || 0; // Return stored vote or 0
    }, [user, userVotes]);

    // --- NEW: Function to handle voting API call and update local state ---
    // This will replace the direct API call in the page components' handleVote
    const submitVote = useCallback(async (memeId, voteType) => { // voteType is 'upvote' or 'downvote'
        if (!user) return { success: false, error: 'User not logged in' };

        const voteTypeInt = voteType === 'upvote' ? 1 : -1;
        const currentVote = userVotes[memeId]; // Get current vote from state
        let optimisticVote = voteTypeInt;

        // Determine optimistic state: if clicking same vote, new state is 0 (removed)
        if (currentVote === voteTypeInt) {
            optimisticVote = 0;
        }

        // Optimistic UI update for local vote state
        const originalVotes = {...userVotes};
        setUserVotes(prev => {
            const newVotes = {...prev};
            if (optimisticVote === 0) {
                delete newVotes[memeId]; // Remove vote
            } else {
                newVotes[memeId] = optimisticVote; // Set new vote
            }
            return newVotes;
        });

        try {
            // API Call
            const response = await axiosInstance.post(`/api/memes/${memeId}/${voteType}`);
            // Success - optimistic state is correct based on backend logic
             console.log("Vote successful:", response.data.message);
            return { success: true, message: response.data.message };
        } catch (error) {
            console.error(`Failed to submit ${voteType} for meme ${memeId}:`, error);
            // Revert local vote state on error
            setUserVotes(originalVotes);
            return { success: false, error: error.response?.data?.error || `Failed to ${voteType}.` };
        }

    }, [user, userVotes]); // Depends on user and current votes state

    // --- Value provided by context ---
    const value = {
        user, token, loading, login, register, logout: handleLogout,
        isAuthenticated: !!user,
        // Favorites
        favoriteIds, loadingFavorites, addFavorite, removeFavorite,
        isFavorite: (memeId) => favoriteIds.has(memeId),
        // Viewed Status
        loadingViewed, isViewed, recordView,
        // --- NEW: Votes ---
        loadingVotes, // Add when fetchUserVotes is implemented
        getUserVoteStatus,
        submitVote // Expose the new voting function
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export { axiosInstance };