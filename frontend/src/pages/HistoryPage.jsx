// frontend/src/pages/HistoryPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MemeGrid from '../components/MemeGrid';
import MemeDetailModal from '../components/MemeDetailModal';
import Spinner from '../components/Spinner';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './HistoryPage.css';

const API_BASE_URL = 'http://localhost:3001';

function HistoryPage() {
    const [historyMemes, setHistoryMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // *** Get the updated isViewed function and clearHistory ***
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed, submitVote, getUserVoteStatus, clearHistory } = useAuth();
    const navigate = useNavigate();

    // Fetch viewing history (Unchanged)
    const fetchHistory = useCallback(async () => { if (!isAuthenticated) { setError("Please log in to view your history."); setLoading(false); return; } setLoading(true); setError(null); try { const response = await axiosInstance.get('/api/history'); setHistoryMemes(response.data.memes || []); } catch (err) { console.error("Error fetching viewing history:", err); setError('Failed to load your viewing history. Please try again.'); setHistoryMemes([]); } finally { setLoading(false); } }, [isAuthenticated]);
    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // Modal Handlers (Unchanged)
    const openModal = useCallback((meme) => { setSelectedMeme(meme); setIsModalOpen(true); }, []);
    const closeModal = useCallback(() => { setIsModalOpen(false); setSelectedMeme(null); }, []);

    // Vote Handler (Unchanged)
    const handleVote = useCallback(async (memeId, voteType) => { if (!isAuthenticated) { alert("Please log in to vote."); return; } setError(null); const originalHistoryMemes = [...historyMemes]; const originalSelectedMeme = selectedMeme ? {...selectedMeme} : null; const voteChange = voteType === 'upvote' ? 1 : -1; const currentVoteStatus = getUserVoteStatus(memeId); let upvoteIncrement = 0; let downvoteIncrement = 0; if (currentVoteStatus === voteChange) { if(voteType === 'upvote') upvoteIncrement = -1; else downvoteIncrement = -1; } else if (currentVoteStatus === -voteChange) { if(voteType === 'upvote') { upvoteIncrement = 1; downvoteIncrement = -1; } else { upvoteIncrement = -1; downvoteIncrement = 1; } } else { if(voteType === 'upvote') upvoteIncrement = 1; else downvoteIncrement = 1; } setHistoryMemes(prevMemes => prevMemes.map(m => { if (m.id === memeId) { return { ...m, upvotes: (m.upvotes ?? 0) + upvoteIncrement, downvotes: (m.downvotes ?? 0) + downvoteIncrement }; } return m; })); if (selectedMeme?.id === memeId) { setSelectedMeme(prev => { if (!prev) return null; return { ...prev, upvotes: (prev.upvotes ?? 0) + upvoteIncrement, downvotes: (prev.downvotes ?? 0) + downvoteIncrement }; }); } const result = await submitVote(memeId, voteType); if (!result.success) { setError(result.error || `Failed to record ${voteType}.`); setHistoryMemes(originalHistoryMemes); if (originalSelectedMeme && selectedMeme?.id === memeId) { setSelectedMeme(originalSelectedMeme); } } }, [isAuthenticated, historyMemes, selectedMeme, submitVote, getUserVoteStatus]);

    // Favorite Toggle Handler (Unchanged)
    const handleFavoriteToggle = useCallback(async (memeId) => { if (!isAuthenticated || loadingFavorites) return; const currentlyFavorite = isFavorite(memeId); const action = currentlyFavorite ? removeFavorite : addFavorite; await action(memeId); }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);

    // Clear History Handler (Unchanged)
    const handleClearHistory = async () => { if (!window.confirm("Are you sure you want to clear your entire viewing history? This cannot be undone.")) { return; } setError(null); setLoading(true); const result = await clearHistory(); setLoading(false); if (result.success) { setHistoryMemes([]); alert(result.message || "History cleared."); } else { setError(result.error || "Failed to clear history."); alert(result.error || "Failed to clear history."); } };

    // Grid loading (no separate viewed loading anymore)
    const isGridLoading = loading;

    return (
        <div className="history-page">
            <div className="history-header">
                 <h1>Viewing History</h1>
                 {!isGridLoading && historyMemes.length > 0 && ( <button onClick={handleClearHistory} className="clear-history-button"> Clear My Sins </button> )}
             </div>
            <p className="history-subtitle">Memes you've recently watched.</p>

            {isGridLoading && <Spinner size="large" message="Loading history..." />}
            {!isGridLoading && error && <div className="error-message" role="alert">{error}</div>}

            {!isGridLoading && !error && historyMemes.length > 0 && (
                <MemeGrid
                    memes={historyMemes}
                    loading={false}
                    error={null}
                    onMemeClick={openModal}
                    onVote={handleVote}
                    onFavoriteToggle={handleFavoriteToggle}
                    // *** Pass isViewed function that accepts meme object ***
                    isMemeViewedCheck={(memeData) => isViewed(memeData.id, memeData)}
                />
            )}

             {!isGridLoading && !error && historyMemes.length === 0 && ( <div className="empty-history-message info-message" role="status">You haven't viewed any memes yet. Go watch some!</div> )}

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