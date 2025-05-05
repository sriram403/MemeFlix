// frontend/src/pages/MyListPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import MemeGrid from '../components/MemeGrid';
import MemeDetailModal from '../components/MemeDetailModal';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './MyListPage.css';

const API_BASE_URL = 'http://localhost:3001';

function MyListPage() {
    const [favoriteMemes, setFavoriteMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed, loadingViewed } = useAuth();

    // Fetch favorite memes
    const fetchFavorites = useCallback(async () => {
        if (!isAuthenticated) { setError("Please log in to view your list."); setLoading(false); return; }
        setLoading(true); setError(null);
        try {
            const response = await axiosInstance.get('/api/favorites');
            setFavoriteMemes(response.data.memes || []);
        } catch (err) {
            console.error("Error fetching favorites:", err); setError('Failed to load your list. Please try again.'); setFavoriteMemes([]);
        } finally { setLoading(false); }
    }, [isAuthenticated]); // Removed axiosInstance dependency, as it's stable

    useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

    // Modal Handlers
    const openModal = useCallback((meme) => { setSelectedMeme(meme); setIsModalOpen(true); recordView(meme.id); }, [recordView]);
    const closeModal = useCallback(() => { setIsModalOpen(false); setSelectedMeme(null); }, []);

    // *** UPDATED handleVote ***
    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) {
            alert("Please log in to vote.");
            return;
        }

        // Store original states
        const originalFavoriteMemes = [...favoriteMemes];
        const originalSelectedMeme = selectedMeme ? {...selectedMeme} : null;

        // --- Optimistic UI Update ---
        // 1. Update the main 'favoriteMemes' list state
        setFavoriteMemes(prevMemes => prevMemes.map(m => {
            if (m.id === memeId) {
                const currentUpvotes = m.upvotes ?? 0;
                const currentDownvotes = m.downvotes ?? 0;
                return {
                    ...m,
                    upvotes: voteType === 'upvote' ? currentUpvotes + 1 : currentUpvotes,
                    downvotes: voteType === 'downvote' ? currentDownvotes + 1 : currentDownvotes,
                };
            }
            return m;
        }));

        // 2. Update the 'selectedMeme' state if the voted meme is open in the modal
        if (selectedMeme?.id === memeId) {
             setSelectedMeme(prev => {
                 if (!prev) return null;
                 const currentUpvotes = prev.upvotes ?? 0;
                 const currentDownvotes = prev.downvotes ?? 0;
                 return {
                    ...prev,
                    upvotes: voteType === 'upvote' ? currentUpvotes + 1 : currentUpvotes,
                    downvotes: voteType === 'downvote' ? currentDownvotes + 1 : currentDownvotes,
                 }
             });
        }
        // --- End Optimistic UI Update ---

        // --- API Call ---
        try {
            await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`);
            // Success: Optimistic update stays
        } catch (err) {
            // --- Revert UI on Error ---
            console.error(`Error ${voteType}ing meme:`, err);
            setError(`Failed to record ${voteType}. Please try again.`);
            setFavoriteMemes(originalFavoriteMemes); // Revert the main list
            if (originalSelectedMeme && selectedMeme?.id === memeId) {
                 setSelectedMeme(originalSelectedMeme); // Revert the modal state
            }
            // --- End Revert UI ---
        }
    // Depend on states needed for update/revert
    }, [isAuthenticated, favoriteMemes, selectedMeme, axiosInstance]); // Add favoriteMemes


    // Favorite Toggle Handler (Removes item from this page's state)
    const handleFavoriteToggle = useCallback(async (memeId) => {
        if (!isAuthenticated || loadingFavorites) return;
        const currentlyFavorite = isFavorite(memeId);
        if (currentlyFavorite) {
            // Optimistic UI update for removal
            const originalMemes = [...favoriteMemes]; // Store original state
            setFavoriteMemes(prevMemes => prevMemes.filter(m => m.id !== memeId));
            if (selectedMeme?.id === memeId) { closeModal(); } // Close modal if removed item is open

            const success = await removeFavorite(memeId); // Call context function
            if (!success) {
                // Revert UI if backend fails
                setFavoriteMemes(originalMemes); // Put back the item
                alert("Failed to remove from list. Please try again.");
            }
        } else {
             console.warn("Attempted to add favorite from My List page?");
        }
    }, [isAuthenticated, loadingFavorites, isFavorite, removeFavorite, favoriteMemes, selectedMeme?.id, closeModal]); // Add favoriteMemes, closeModal


    return (
        <div className="my-list-page">
            <h1>My List</h1>
            <MemeGrid
                memes={favoriteMemes} // Pass updated list
                loading={loading || loadingViewed}
                error={error}
                onMemeClick={openModal}
                onVote={handleVote} // Pass updated handler
                onFavoriteToggle={handleFavoriteToggle}
                isMemeViewed={(memeId) => !loadingViewed && isViewed(memeId)}
            />

            {isModalOpen && selectedMeme && (
                <MemeDetailModal
                    meme={selectedMeme} // Pass updated modal state
                    onClose={closeModal}
                    onVote={handleVote} // Pass updated handler
                    onFavoriteToggle={handleFavoriteToggle}
                />
            )}
        </div>
    );
}

export default MyListPage;