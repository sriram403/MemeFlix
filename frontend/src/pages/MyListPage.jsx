// frontend/src/pages/MyListPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import MemeGrid from '../components/MemeGrid';
import MemeDetailModal from '../components/MemeDetailModal';
import Spinner from '../components/Spinner'; // Import Spinner
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './MyListPage.css';

const API_BASE_URL = 'http://localhost:3001';

function MyListPage() {
    const [favoriteMemes, setFavoriteMemes] = useState([]);
    const [loading, setLoading] = useState(true); // Loading state for favorites list
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Include loadingViewed from context
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed, loadingViewed } = useAuth();

    // Fetch favorite memes (Unchanged)
    const fetchFavorites = useCallback(async () => { if (!isAuthenticated) { setError("Please log in to view your list."); setLoading(false); return; } setLoading(true); setError(null); try { const response = await axiosInstance.get('/api/favorites'); setFavoriteMemes(response.data.memes || []); } catch (err) { console.error("Error fetching favorites:", err); setError('Failed to load your list. Please try again.'); setFavoriteMemes([]); } finally { setLoading(false); } }, [isAuthenticated]);
    useEffect(() => { fetchFavorites(); }, [fetchFavorites]);

    // Modal Handlers (Unchanged)
    const openModal = useCallback((meme) => { setSelectedMeme(meme); setIsModalOpen(true); recordView(meme.id); }, [recordView]);
    const closeModal = useCallback(() => { setIsModalOpen(false); setSelectedMeme(null); }, []);

    // Vote Handler (Unchanged)
    const handleVote = useCallback(async (memeId, voteType) => { if (!isAuthenticated) { alert("Please log in to vote."); return; } const originalFavoriteMemes = [...favoriteMemes]; const originalSelectedMeme = selectedMeme ? {...selectedMeme} : null; setFavoriteMemes(prevMemes => prevMemes.map(m => { if (m.id === memeId) { const cu = m.upvotes ?? 0; const cd = m.downvotes ?? 0; return { ...m, upvotes: voteType === 'upvote' ? cu + 1 : cu, downvotes: voteType === 'downvote' ? cd + 1 : cd }; } return m; })); if (selectedMeme?.id === memeId) { setSelectedMeme(prev => { if (!prev) return null; const cu = prev.upvotes ?? 0; const cd = prev.downvotes ?? 0; return { ...prev, upvotes: voteType === 'upvote' ? cu + 1 : cu, downvotes: voteType === 'downvote' ? cd + 1 : cd } }); } try { await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`); } catch (err) { console.error(`Error ${voteType}ing meme:`, err); setError(`Failed to record ${voteType}.`); setFavoriteMemes(originalFavoriteMemes); if (originalSelectedMeme && selectedMeme?.id === memeId) { setSelectedMeme(originalSelectedMeme); } } }, [isAuthenticated, favoriteMemes, selectedMeme, axiosInstance]);

    // Favorite Toggle Handler (Unchanged)
    const handleFavoriteToggle = useCallback(async (memeId) => { if (!isAuthenticated || loadingFavorites) return; const currentlyFavorite = isFavorite(memeId); if (currentlyFavorite) { const originalMemes = [...favoriteMemes]; setFavoriteMemes(prevMemes => prevMemes.filter(m => m.id !== memeId)); if (selectedMeme?.id === memeId) { closeModal(); } const success = await removeFavorite(memeId); if (!success) { setFavoriteMemes(originalMemes); alert("Failed to remove from list. Please try again."); } } else { console.warn("Attempted to add favorite from My List page?"); } }, [isAuthenticated, loadingFavorites, isFavorite, removeFavorite, favoriteMemes, selectedMeme?.id, closeModal]);

    // Combine loading states for the grid
    const isGridLoading = loading || loadingViewed;

    return (
        <div className="my-list-page">
            <h1>My List</h1>

            {/* Use Spinner or show error */}
            {isGridLoading && <Spinner size="large" message="Loading your list..." />}
            {!isGridLoading && error && <div className="error-message" role="alert">{error}</div>}

            {/* Render grid only when not loading and no error */}
            {!isGridLoading && !error && (
                <MemeGrid
                    memes={favoriteMemes}
                    loading={false} // Loading handled above
                    error={null}    // Error handled above
                    onMemeClick={openModal}
                    onVote={handleVote}
                    onFavoriteToggle={handleFavoriteToggle}
                    isMemeViewed={(memeId) => isViewed(memeId)} // No need to check loadingViewed here
                />
            )}

            {/* Message if list is empty */}
             {!isGridLoading && !error && favoriteMemes.length === 0 && (
                 <div className="info-message" role="status">Your list is empty. Add some memes!</div>
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

export default MyListPage;