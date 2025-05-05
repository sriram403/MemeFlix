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

    // *** Use submitVote and getUserVoteStatus from context ***
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed, loadingViewed, submitVote, getUserVoteStatus } = useAuth();
    const navigate = useNavigate();

    // Fetch viewing history (Unchanged)
    const fetchHistory = useCallback(async () => { if (!isAuthenticated) { setError("Please log in to view your history."); setLoading(false); return; } setLoading(true); setError(null); try { const response = await axiosInstance.get('/api/history'); setHistoryMemes(response.data.memes || []); } catch (err) { console.error("Error fetching viewing history:", err); setError('Failed to load your viewing history. Please try again.'); setHistoryMemes([]); } finally { setLoading(false); } }, [isAuthenticated]);
    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // Modal Handlers (Unchanged)
    const openModal = useCallback((meme) => { setSelectedMeme(meme); setIsModalOpen(true); }, []);
    const closeModal = useCallback(() => { setIsModalOpen(false); setSelectedMeme(null); }, []);

    // *** UPDATED handleVote to use context function ***
    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) {
            alert("Please log in to vote.");
            return;
        }
        setError(null);

        // Store original states
        const originalHistoryMemes = [...historyMemes];
        const originalSelectedMeme = selectedMeme ? {...selectedMeme} : null;

        // --- Optimistic UI Update for COUNTS ---
        const voteChange = voteType === 'upvote' ? 1 : -1;
        const currentVoteStatus = getUserVoteStatus(memeId);
        let upvoteIncrement = 0;
        let downvoteIncrement = 0;

        if (currentVoteStatus === voteChange) { // Removing vote
            if(voteType === 'upvote') upvoteIncrement = -1; else downvoteIncrement = -1;
        } else if (currentVoteStatus === -voteChange) { // Changing vote
             if(voteType === 'upvote') { upvoteIncrement = 1; downvoteIncrement = -1; }
             else { upvoteIncrement = -1; downvoteIncrement = 1; }
        } else { // Adding new vote
             if(voteType === 'upvote') upvoteIncrement = 1; else downvoteIncrement = 1;
        }

        // 1. Update the main 'historyMemes' list state
        setHistoryMemes(prevMemes => prevMemes.map(m => {
            if (m.id === memeId) {
                return { ...m, upvotes: (m.upvotes ?? 0) + upvoteIncrement, downvotes: (m.downvotes ?? 0) + downvoteIncrement };
            } return m;
        }));

        // 2. Update the 'selectedMeme' state if the voted meme is open in the modal
        if (selectedMeme?.id === memeId) {
             setSelectedMeme(prev => {
                 if (!prev) return null;
                 return { ...prev, upvotes: (prev.upvotes ?? 0) + upvoteIncrement, downvotes: (prev.downvotes ?? 0) + downvoteIncrement };
             });
        }
        // --- End Optimistic UI Update ---

        // --- Call Context Function for API and State ---
        const result = await submitVote(memeId, voteType);

        if (!result.success) {
            setError(result.error || `Failed to record ${voteType}.`);
            // Revert optimistic count updates
            setHistoryMemes(originalHistoryMemes);
            if (originalSelectedMeme && selectedMeme?.id === memeId) {
                 setSelectedMeme(originalSelectedMeme);
            }
        }
    // Depend on context function and states needed for update/revert
    }, [isAuthenticated, historyMemes, selectedMeme, submitVote, getUserVoteStatus]); // Add submitVote, getUserVoteStatus


    // Favorite Toggle Handler (Unchanged)
    const handleFavoriteToggle = useCallback(async (memeId) => { if (!isAuthenticated || loadingFavorites) return; const currentlyFavorite = isFavorite(memeId); const action = currentlyFavorite ? removeFavorite : addFavorite; await action(memeId); }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);

    const isGridLoading = loading || loadingViewed;

    return (
        <div className="history-page">
            <h1>Viewing History</h1>
            <p className="history-subtitle">Memes you've recently watched.</p>

            {isGridLoading && <Spinner size="large" message="Loading history..." />}
            {!isGridLoading && error && <div className="error-message" role="alert">{error}</div>}

            {!isGridLoading && !error && (
                <MemeGrid
                    memes={historyMemes}
                    loading={false}
                    error={null}
                    onMemeClick={openModal}
                    onVote={handleVote} // Pass updated handler
                    onFavoriteToggle={handleFavoriteToggle}
                    // Pass down getUserVoteStatus if needed for visual indicators
                    // getUserVoteStatus={getUserVoteStatus}
                    isMemeViewed={(memeId) => !loadingViewed && isViewed(memeId)} // Already viewed by definition
                />
            )}

             {!isGridLoading && !error && historyMemes.length === 0 && ( <div className="empty-history-message info-message" role="status">You haven't viewed any memes yet. Go watch some!</div> )}

            {isModalOpen && selectedMeme && (
                <MemeDetailModal
                    meme={selectedMeme}
                    onClose={closeModal}
                    onVote={handleVote} // Pass updated handler
                    onFavoriteToggle={handleFavoriteToggle}
                    // Pass down getUserVoteStatus if needed
                    // getUserVoteStatus={getUserVoteStatus}
                />
            )}
        </div>
    );
}

export default HistoryPage;