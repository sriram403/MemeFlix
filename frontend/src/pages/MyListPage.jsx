// frontend/src/pages/MyListPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import MemeGrid from '../components/MemeGrid';
import MemeDetailModal from '../components/MemeDetailModal';
import Spinner from '../components/Spinner';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './MyListPage.css';

const API_BASE_URL = 'http://localhost:3001';

function MyListPage() {
    const [favoriteMemes, setFavoriteMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // *** REMOVE submitVote, getUserVoteStatus from context destructuring ***
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed } = useAuth();

    // Fetch favorite memes (Unchanged)
    const fetchFavorites = useCallback(async () => { if (!isAuthenticated) { setError("Please log in to view your list."); setLoading(false); return; } setLoading(true); setError(null); try { const response = await axiosInstance.get('/api/favorites'); setFavoriteMemes(response.data.memes || []); } catch (err) { console.error("Error fetching favorites:", err); setError('Failed to load your list. Please try again.'); setFavoriteMemes([]); } finally { setLoading(false); } }, [isAuthenticated]);
    useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

    // Modal Handlers (Unchanged)
    const openModal = useCallback((meme) => { setSelectedMeme(meme); setIsModalOpen(true); recordView(meme.id); }, [recordView]);
    const closeModal = useCallback(() => { setIsModalOpen(false); setSelectedMeme(null); }, []);

    // *** UPDATED handleVote to call API directly ***
    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) {
            alert("Please log in to vote.");
            return;
        }
        setError(null);

        // Store original states
        const originalFavoriteMemes = [...favoriteMemes];
        const originalSelectedMeme = selectedMeme ? {...selectedMeme} : null;

        // --- Optimistic UI Update for Counts ---
        const memeToUpdate = originalFavoriteMemes.find(m => m.id === memeId);
        // Use API flag if available, otherwise assume 0 (should be available from /api/favorites)
        const currentVoteStatus = memeToUpdate?.user_vote_status || selectedMeme?.user_vote_status || 0;
        const voteChange = voteType === 'upvote' ? 1 : -1;
        let upvoteIncrement = 0;
        let downvoteIncrement = 0;
        let nextVoteStatus = 0;

        if (currentVoteStatus === voteChange) { // Removing vote
            if(voteType === 'upvote') upvoteIncrement = -1; else downvoteIncrement = -1;
            nextVoteStatus = 0;
        } else if (currentVoteStatus === -voteChange) { // Changing vote
             if(voteType === 'upvote') { upvoteIncrement = 1; downvoteIncrement = -1; }
             else { upvoteIncrement = -1; downvoteIncrement = 1; }
             nextVoteStatus = voteChange;
        } else { // Adding new vote
             if(voteType === 'upvote') upvoteIncrement = 1; else downvoteIncrement = 1;
             nextVoteStatus = voteChange;
        }

        // 1. Update the main 'favoriteMemes' list state
        setFavoriteMemes(prevMemes => prevMemes.map(m => {
            if (m.id === memeId) {
                return { ...m, upvotes: (m.upvotes ?? 0) + upvoteIncrement, downvotes: (m.downvotes ?? 0) + downvoteIncrement, user_vote_status: nextVoteStatus };
            } return m;
        }));

        // 2. Update the 'selectedMeme' state
        if (selectedMeme?.id === memeId) {
             setSelectedMeme(prev => {
                 if (!prev) return null;
                 return { ...prev, upvotes: (prev.upvotes ?? 0) + upvoteIncrement, downvotes: (prev.downvotes ?? 0) + downvoteIncrement, user_vote_status: nextVoteStatus };
             });
        }
        // --- End Optimistic UI Update ---

        // --- Direct API Call ---
        try {
            await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`);
            // Success
        } catch (err) {
            console.error(`Error ${voteType}ing meme:`, err);
            setError(err.response?.data?.error || `Failed to record ${voteType}.`);
            // Revert UI
            setFavoriteMemes(originalFavoriteMemes);
            if (originalSelectedMeme && selectedMeme?.id === memeId) {
                 setSelectedMeme(originalSelectedMeme);
            }
        }
    // Depend on states needed for update/revert
    }, [isAuthenticated, favoriteMemes, selectedMeme]); // Removed context vote functions

    // Favorite Toggle Handler (Unchanged)
    const handleFavoriteToggle = useCallback(async (memeId) => { if (!isAuthenticated || loadingFavorites) return; const currentlyFavorite = isFavorite(memeId); if (currentlyFavorite) { const originalMemes = [...favoriteMemes]; setFavoriteMemes(prevMemes => prevMemes.filter(m => m.id !== memeId)); if (selectedMeme?.id === memeId) { closeModal(); } const success = await removeFavorite(memeId); if (!success) { setFavoriteMemes(originalMemes); alert("Failed to remove from list. Please try again."); } } else { console.warn("Attempted to add favorite from My List page?"); } }, [isAuthenticated, loadingFavorites, isFavorite, removeFavorite, favoriteMemes, selectedMeme?.id, closeModal]);

    const isGridLoading = loading;

    return (
        <div className="my-list-page">
            <h1>My List</h1>

            {isGridLoading && <Spinner size="large" message="Loading your list..." />}
            {!isGridLoading && error && <div className="error-message" role="alert">{error}</div>}

            {!isGridLoading && !error && (
                <MemeGrid
                    memes={favoriteMemes}
                    loading={false}
                    error={null}
                    onMemeClick={openModal}
                    onVote={handleVote} // Pass updated handler
                    onFavoriteToggle={handleFavoriteToggle}
                    // Pass the meme data itself for the check
                    isMemeViewedCheck={(memeData) => isViewed(memeData.id, memeData)}
                />
            )}

             {!isGridLoading && !error && favoriteMemes.length === 0 && ( <div className="info-message" role="status">Your list is empty. Add some memes!</div> )}

            {isModalOpen && selectedMeme && (
                <MemeDetailModal
                    meme={selectedMeme} // Pass updated modal meme state
                    onClose={closeModal}
                    onVote={handleVote} // Pass updated handler
                    onFavoriteToggle={handleFavoriteToggle}
                    // No need to pass getUserVoteStatus
                />
            )}
        </div>
    );
}

export default MyListPage;