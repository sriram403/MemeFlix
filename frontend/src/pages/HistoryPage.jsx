// frontend/src/pages/HistoryPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MemeGrid from '../components/MemeGrid';
import MemeDetailModal from '../components/MemeDetailModal';
import { useAuth, axiosInstance } from '../contexts/AuthContext'; // Import useAuth
import './HistoryPage.css';

const API_BASE_URL = 'http://localhost:3001';

function HistoryPage() {
    const [historyMemes, setHistoryMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // *** Get isViewed function and relevant states ***
    // Note: All items on this page are inherently "viewed", but we still get
    // the function and loading state for consistency and passing it down.
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed, loadingViewed } = useAuth();
    const navigate = useNavigate();

    // Fetch viewing history
    const fetchHistory = useCallback(async () => {
        if (!isAuthenticated) {
             setError("Please log in to view your history.");
             setLoading(false);
             return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await axiosInstance.get('/api/history'); // Fetch full history
            setHistoryMemes(response.data.memes || []);
        } catch (err) {
            console.error("Error fetching viewing history:", err);
            setError('Failed to load your viewing history. Please try again.');
            setHistoryMemes([]);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, axiosInstance]);

    useEffect(() => {
        fetchHistory();
        // Viewed IDs are fetched by AuthContext
    }, [fetchHistory]);

    // Modal Handlers
    const openModal = (meme) => {
        setSelectedMeme(meme);
        setIsModalOpen(true);
        // No need to call recordView here, it's already in history
    };
    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedMeme(null);
    };

    // Vote Handler (updates selectedMeme if open)
    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) return;
        const originalMemes = [...historyMemes]; // Keep original for modal revert

        // Optimistic update for modal state if open
        if (selectedMeme?.id === memeId) {
            const originalSelectedMeme = {...selectedMeme};
             setSelectedMeme(prev => ({ ...prev, upvotes: voteType === 'upvote' ? (prev.upvotes ?? 0) + 1 : prev.upvotes, downvotes: voteType === 'downvote' ? (prev.downvotes ?? 0) + 1 : prev.downvotes }));
            try {
                await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`);
                // Also update the item in the history list state for consistency
                setHistoryMemes(prev => prev.map(m => m.id === memeId ? { ...m, upvotes: voteType === 'upvote' ? (m.upvotes ?? 0) + 1 : m.upvotes, downvotes: voteType === 'downvote' ? (m.downvotes ?? 0) + 1 : m.downvotes } : m));
            } catch (err) {
                console.error(`Error ${voteType}ing meme:`, err);
                alert(`Failed to record ${voteType}. Please try again.`);
                setSelectedMeme(originalSelectedMeme); // Revert modal state
                // No need to revert historyMemes state as it wasn't optimistically updated
            }
        } else {
             // If voting happens from somewhere else (shouldn't) just update backend & local list
             try {
                 await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`);
                 // Update the item in the history list state
                 setHistoryMemes(prev => prev.map(m => m.id === memeId ? { ...m, upvotes: voteType === 'upvote' ? (m.upvotes ?? 0) + 1 : m.upvotes, downvotes: voteType === 'downvote' ? (m.downvotes ?? 0) + 1 : m.downvotes } : m));
             } catch (err) {
                 console.error(`Error ${voteType}ing meme:`, err);
                 alert(`Failed to record ${voteType}.`);
             }
        }
    }, [isAuthenticated, selectedMeme, historyMemes, axiosInstance]); // Add historyMemes dependency

    // Favorite Toggle Handler
    const handleFavoriteToggle = useCallback(async (memeId) => {
        if (!isAuthenticated || loadingFavorites) return;
        const currentlyFavorite = isFavorite(memeId);
        const action = currentlyFavorite ? removeFavorite : addFavorite;
        await action(memeId);
        // No local state change needed here, relies on AuthContext
    }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);

    return (
        <div className="history-page">
            <h1>Viewing History</h1>
            <p className="history-subtitle">Memes you've recently watched.</p>

            <MemeGrid
                memes={historyMemes}
                loading={loading || loadingViewed} // Combine loading states
                error={error}
                onMemeClick={openModal}
                onVote={handleVote}
                onFavoriteToggle={handleFavoriteToggle}
                // Pass isViewed check - technically always true here, but pass for consistency
                isMemeViewed={(memeId) => !loadingViewed && isViewed(memeId)}
            />

             {/* Message if history is empty */}
             {!loading && !error && historyMemes.length === 0 && (
                 <div className="empty-history-message">You haven't viewed any memes yet. Go watch some!</div>
             )}


            {isModalOpen && selectedMeme && (
                <MemeDetailModal
                    meme={selectedMeme}
                    onClose={closeModal}
                    onVote={handleVote}
                    onFavoriteToggle={handleFavoriteToggle}
                />
            )}
        </div>
    );
}

export default HistoryPage;