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

    // *** Get the updated isViewed function ***
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed, submitVote, getUserVoteStatus } = useAuth();

    // Fetch favorite memes (Unchanged)
    const fetchFavorites = useCallback(async () => { if (!isAuthenticated) { setError("Please log in to view your list."); setLoading(false); return; } setLoading(true); setError(null); try { const response = await axiosInstance.get('/api/favorites'); setFavoriteMemes(response.data.memes || []); } catch (err) { console.error("Error fetching favorites:", err); setError('Failed to load your list. Please try again.'); setFavoriteMemes([]); } finally { setLoading(false); } }, [isAuthenticated]);
    useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

    // Modal Handlers (Unchanged)
    const openModal = useCallback((meme) => { setSelectedMeme(meme); setIsModalOpen(true); recordView(meme.id); }, [recordView]);
    const closeModal = useCallback(() => { setIsModalOpen(false); setSelectedMeme(null); }, []);

    // Vote Handler (Unchanged)
    const handleVote = useCallback(async (memeId, voteType) => { if (!isAuthenticated) { alert("Please log in to vote."); return; } setError(null); const originalFavoriteMemes = [...favoriteMemes]; const originalSelectedMeme = selectedMeme ? {...selectedMeme} : null; const voteChange = voteType === 'upvote' ? 1 : -1; const currentVoteStatus = getUserVoteStatus(memeId); let upvoteIncrement = 0; let downvoteIncrement = 0; if (currentVoteStatus === voteChange) { if(voteType === 'upvote') upvoteIncrement = -1; else downvoteIncrement = -1; } else if (currentVoteStatus === -voteChange) { if(voteType === 'upvote') { upvoteIncrement = 1; downvoteIncrement = -1; } else { upvoteIncrement = -1; downvoteIncrement = 1; } } else { if(voteType === 'upvote') upvoteIncrement = 1; else downvoteIncrement = 1; } setFavoriteMemes(prevMemes => prevMemes.map(m => { if (m.id === memeId) { return { ...m, upvotes: (m.upvotes ?? 0) + upvoteIncrement, downvotes: (m.downvotes ?? 0) + downvoteIncrement }; } return m; })); if (selectedMeme?.id === memeId) { setSelectedMeme(prev => { if (!prev) return null; return { ...prev, upvotes: (prev.upvotes ?? 0) + upvoteIncrement, downvotes: (prev.downvotes ?? 0) + downvoteIncrement }; }); } const result = await submitVote(memeId, voteType); if (!result.success) { setError(result.error || `Failed to record ${voteType}.`); setFavoriteMemes(originalFavoriteMemes); if (originalSelectedMeme && selectedMeme?.id === memeId) { setSelectedMeme(originalSelectedMeme); } } }, [isAuthenticated, favoriteMemes, selectedMeme, submitVote, getUserVoteStatus]);

    // Favorite Toggle Handler (Unchanged)
    const handleFavoriteToggle = useCallback(async (memeId) => { if (!isAuthenticated || loadingFavorites) return; const currentlyFavorite = isFavorite(memeId); if (currentlyFavorite) { const originalMemes = [...favoriteMemes]; setFavoriteMemes(prevMemes => prevMemes.filter(m => m.id !== memeId)); if (selectedMeme?.id === memeId) { closeModal(); } const success = await removeFavorite(memeId); if (!success) { setFavoriteMemes(originalMemes); alert("Failed to remove from list. Please try again."); } } else { console.warn("Attempted to add favorite from My List page?"); } }, [isAuthenticated, loadingFavorites, isFavorite, removeFavorite, favoriteMemes, selectedMeme?.id, closeModal]);

    // Grid loading (no separate viewed loading anymore)
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
                    onVote={handleVote}
                    onFavoriteToggle={handleFavoriteToggle}
                    // *** Pass isViewed function that accepts meme object ***
                    isMemeViewedCheck={(memeData) => isViewed(memeData.id, memeData)}
                />
            )}

             {!isGridLoading && !error && favoriteMemes.length === 0 && ( <div className="info-message" role="status">Your list is empty. Add some memes!</div> )}

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