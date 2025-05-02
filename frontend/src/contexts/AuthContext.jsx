import React, { createContext, useState, useContext, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE_URL = 'http://localhost:3001';

const AuthContext = createContext(null);

const axiosInstance = axios.create({
    baseURL: API_BASE_URL,
});

axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('memeflix_token');
        if (token) {
            config.headers['Authorization'] = `Bearer ${token}`;
        }
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
        if (!token) {
            setFavoriteIds(new Set());
            setLoadingFavorites(false); // Ensure loading stops if no token
            return;
        }
        setLoadingFavorites(true);
        try {
            const response = await axiosInstance.get('/api/favorites/ids');
            setFavoriteIds(new Set(response.data.favoriteMemeIds || []));
        } catch (error) {
            console.error("Failed to fetch favorite IDs:", error);
            // Decide error handling: maybe clear favorites or keep stale ones?
            // Keeping stale ones might be less disruptive if it's a temp network error
            // setFavoriteIds(new Set());
        } finally {
            setLoadingFavorites(false);
        }
    }, [token]);

    const handleLogout = useCallback(() => {
        setToken(null);
        // No need to clear user/favorites here, useEffect handles it
    }, []);


    useEffect(() => {
        if (token) {
            localStorage.setItem('memeflix_token', token);
            setLoading(true);
            axiosInstance.get('/api/auth/me')
                .then(response => {
                    setUser(response.data);
                    fetchFavoriteIds(); // Fetch favorites after user is set
                })
                .catch(() => {
                    console.error("Token validation failed or /me endpoint error.");
                    handleLogout() // Use useCallback version
                })
                .finally(() => setLoading(false));
        } else {
            localStorage.removeItem('memeflix_token');
            setUser(null);
            setFavoriteIds(new Set());
            setLoading(false);
        }
    }, [token, fetchFavoriteIds, handleLogout]); // Add handleLogout dependency

    const login = async (username, password) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/api/auth/login`, { username, password });
            if (response.data.accessToken) {
                setToken(response.data.accessToken);
                return { success: true };
            }
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || "Login failed";
            console.error("Login failed:", errorMsg);
            return { success: false, error: errorMsg };
        }
        return { success: false, error: "Login failed. Unknown error." };
    };

    const register = async (username, email, password) => {
        try {
            const response = await axios.post(`${API_BASE_URL}/api/auth/register`, { username, email, password });
            console.log("Registration successful:", response.data);
            return { success: true };
        } catch (error) {
            const errorMsg = error.response?.data?.error || error.message || "Registration failed";
            console.error("Registration failed:", errorMsg);
            return { success: false, error: errorMsg };
        }
    };

    const addFavorite = useCallback(async (memeId) => {
        if (!user) return false;
        const originalFavorites = new Set(favoriteIds);
        setFavoriteIds(prev => new Set(prev).add(memeId));

        try {
            await axiosInstance.post(`/api/favorites/${memeId}`);
            return true;
        } catch (error) {
            console.error("Failed to add favorite:", error);
            setFavoriteIds(originalFavorites);
            // Maybe return error message here?
            return false;
        }
    }, [user, favoriteIds]);

    const removeFavorite = useCallback(async (memeId) => {
        if (!user) return false;
        const originalFavorites = new Set(favoriteIds);
        setFavoriteIds(prev => {
            const newSet = new Set(prev);
            newSet.delete(memeId);
            return newSet;
        });

        try {
            await axiosInstance.delete(`/api/favorites/${memeId}`);
            return true;
        } catch (error) {
            console.error("Failed to remove favorite:", error);
            setFavoriteIds(originalFavorites);
            return false;
        }
    }, [user, favoriteIds]);

    const value = {
        user,
        token,
        loading,
        login,
        register,
        logout: handleLogout,
        isAuthenticated: !!user,
        favoriteIds,
        loadingFavorites,
        addFavorite,
        removeFavorite,
        isFavorite: (memeId) => favoriteIds.has(memeId),
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
export { axiosInstance };