// frontend/src/pages/HistoryPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MemeGrid from '../components/MemeGrid';
import MemeDetailModal from '../components/MemeDetailModal';
import Spinner from '../components/Spinner'; // Import Spinner
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './HistoryPage.css';

const API_BASE_URL = 'http://localhost:3001';

function HistoryPage() {
    const [historyMemes, setHistoryMemes] = useState([]);
    const [loading, setLoading] = useState(true); // Loading state for history list
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Include loadingViewed from context
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed, loadingViewed } = useAuth();
    const navigate = useNavigate();

    // Fetch viewing history (Unchanged)
    const fetchHistory = useCallback(async () => { if (!isAuthenticated) { setError("Please log in to view your history."); setLoading(false); return; } setLoading(true); setError(null); try { const response = await axiosInstance.get('/api/history'); setHistoryMemes(response.data.memes || []); } catch (err) { console.error("Error fetching viewing history:", err); setError('Failed to load your viewing history. Please try again.'); setHistoryMemes([]); } finally { setLoading(false); } }, [isAuthenticated]);
    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // Modal Handlers (Unchanged)
    const openModal = useCallback((meme) => { setSelectedMeme(meme); setIsModalOpen(true); }, []);
    const closeModal = useCallback(() => { setIsModalOpen(false); setSelectedMeme(null); }, []);

    // Vote Handler (Unchanged)
    const handleVote = useCallback(async (memeId, voteType) => { if (!isAuthenticated) { alert("Please log in to vote."); return; } const originalHistoryMemes = [...historyMemes]; const originalSelectedMeme = selectedMeme ? {...selectedMeme} : null; setHistoryMemes(prevMemes => prevMemes.map(m => { if (m.id === memeId) { const cu = m.upvotes ?? 0; const cd = m.downvotes ?? 0; return { ...m, upvotes: voteType === 'upvote' ? cu + 1 : cu, downvotes: voteType === 'downvote' ? cd + 1 : cd }; } return m; })); if (selectedMeme?.id === memeId) { setSelectedMeme(prev => { if (!prev) return null; const cu = prev.upvotes ?? 0; const cd = prev.downvotes ?? 0; return { ...prev, upvotes: voteType === 'upvote' ? cu + 1 : cu, downvotes: voteType === 'downvote' ? cd + 1 : cd } }); } try { await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`); setHistoryMemes(prev => prev.map(m => m.id === memeId ? { ...m, upvotes: voteType === 'upvote' ? (m.upvotes ?? 0) + 1 : m.upvotes, downvotes: voteType === 'downvote' ? (m.downvotes ?? 0) + 1 : m.downvotes } : m)); } catch (err) { console.error(`Error ${voteType}ing meme:`, err); setError(`Failed to record ${voteType}.`); setHistoryMemes(originalHistoryMemes); if (originalSelectedMeme && selectedMeme?.id === memeId) { setSelectedMeme(originalSelectedMeme); } } }, [isAuthenticated, historyMemes, selectedMeme, axiosInstance]);

    // Favorite Toggle Handler (Unchanged)
    const handleFavoriteToggle = useCallback(async (memeId) => { if (!isAuthenticated || loadingFavorites) return; const currentlyFavorite = isFavorite(memeId); const action = currentlyFavorite ? removeFavorite : addFavorite; await action(memeId); }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);

    // Combine loading states for the grid
    const isGridLoading = loading || loadingViewed;

    return (
        <div className="history-page">
            <h1>Viewing History</h1>
            <p className="history-subtitle">Memes you've recently watched.</p>

            {/* Use Spinner or show error */}
            {isGridLoading && <Spinner size="large" message="Loading history..." />}
            {!isGridLoading && error && <div className="error-message" role="alert">{error}</div>}

            {/* Render grid only when not loading and no error */}
            {!isGridLoading && !error && (
                <MemeGrid
                    memes={historyMemes}
                    loading={false} // Loading handled above
                    error={null}    // Error handled above
                    onMemeClick={openModal}
                    onVote={handleVote}
                    onFavoriteToggle={handleFavoriteToggle}
                    isMemeViewed={(memeId) => isViewed(memeId)} // Technically always true, but pass consistently
                />
            )}

             {/* Message if history is empty */}
             {!isGridLoading && !error && historyMemes.length === 0 && (
                 <div className="empty-history-message info-message" role="status">You haven't viewed any memes yet. Go watch some!</div>
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