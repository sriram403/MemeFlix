// frontend/src/pages/MyListPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import MemeGrid from '../components/MemeGrid';
import MemeDetailModal from '../components/MemeDetailModal';
import { useAuth, axiosInstance } from '../contexts/AuthContext'; // Import useAuth
import './MyListPage.css';

const API_BASE_URL = 'http://localhost:3001';

function MyListPage() {
    const [favoriteMemes, setFavoriteMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // *** Get isViewed function and relevant states ***
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed, loadingViewed } = useAuth();

    // Fetch favorite memes
    const fetchFavorites = useCallback(async () => {
        // Protected route handles auth check, but check here too
        if (!isAuthenticated) {
             setError("Please log in to view your list.");
             setLoading(false);
             return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await axiosInstance.get('/api/favorites');
            setFavoriteMemes(response.data.memes || []);
        } catch (err) {
            console.error("Error fetching favorites:", err);
            setError('Failed to load your list. Please try again.');
            setFavoriteMemes([]);
        } finally {
            setLoading(false);
        }
    }, [isAuthenticated, axiosInstance]); // Depend on isAuthenticated

    useEffect(() => {
        fetchFavorites();
        // Note: We don't need to fetch viewed IDs here, AuthContext does it
    }, [fetchFavorites]);

    // Modal Handlers
    const openModal = (meme) => {
        setSelectedMeme(meme);
        setIsModalOpen(true);
        recordView(meme.id); // Record view when opened from My List too
    };
    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedMeme(null);
    };

    // Vote Handler (same logic as other pages, updates selectedMeme if open)
    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) return;
        // No grid update needed here, only modal if open
        if (selectedMeme?.id === memeId) {
            const originalSelectedMeme = {...selectedMeme};
            setSelectedMeme(prev => ({ ...prev, upvotes: voteType === 'upvote' ? (prev.upvotes ?? 0) + 1 : prev.upvotes, downvotes: voteType === 'downvote' ? (prev.downvotes ?? 0) + 1 : prev.downvotes }));
            try {
                await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`);
            } catch (err) {
                console.error(`Error ${voteType}ing meme:`, err);
                alert(`Failed to record ${voteType}. Please try again.`); // Simple alert for now
                setSelectedMeme(originalSelectedMeme); // Revert modal state on error
            }
        } else {
             // If voting from somewhere else (shouldn't happen here)
             try { await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`); } catch (err) { console.error(`Error ${voteType}ing meme:`, err); alert(`Failed to record ${voteType}.`); }
        }
    }, [isAuthenticated, selectedMeme, axiosInstance]);

    // Favorite Toggle Handler (Removes item from this page's state)
    const handleFavoriteToggle = useCallback(async (memeId) => {
        if (!isAuthenticated || loadingFavorites) return;
        const currentlyFavorite = isFavorite(memeId); // Check current status via context
        if (currentlyFavorite) { // Only handle removal on this page
            // Optimistic UI update
            setFavoriteMemes(prevMemes => prevMemes.filter(m => m.id !== memeId));
            const success = await removeFavorite(memeId); // Call context function
            if (!success) {
                // Revert UI if backend fails
                fetchFavorites(); // Re-fetch to be sure
                alert("Failed to remove from list. Please try again.");
            }
            // Close modal if the removed item was open
            if (selectedMeme?.id === memeId) {
                closeModal();
            }
        } else {
            // Adding is handled elsewhere, shouldn't happen from My List page directly
            console.warn("Attempted to add favorite from My List page?");
        }
    }, [isAuthenticated, loadingFavorites, isFavorite, removeFavorite, fetchFavorites, selectedMeme?.id]);

    return (
        <div className="my-list-page">
            <h1>My List</h1>
            <MemeGrid
                memes={favoriteMemes}
                loading={loading || loadingViewed} // Combine loading states
                error={error}
                onMemeClick={openModal}
                onVote={handleVote} // Pass vote handler to grid -> card -> modal
                onFavoriteToggle={handleFavoriteToggle} // Pass specific remove handler
                isMemeViewed={(memeId) => !loadingViewed && isViewed(memeId)} // Pass view check
            />

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

export default MyListPage;