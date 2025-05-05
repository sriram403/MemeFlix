// frontend/src/pages/HistoryPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MemeGrid from '../components/MemeGrid';
import MemeDetailModal from '../components/MemeDetailModal';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './HistoryPage.css';

const API_BASE_URL = 'http://localhost:3001';

function HistoryPage() {
    const [historyMemes, setHistoryMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed, loadingViewed } = useAuth();
    const navigate = useNavigate();

    // Fetch viewing history (Unchanged)
    const fetchHistory = useCallback(async () => { if (!isAuthenticated) { setError("Please log in to view your history."); setLoading(false); return; } setLoading(true); setError(null); try { const response = await axiosInstance.get('/api/history'); setHistoryMemes(response.data.memes || []); } catch (err) { console.error("Error fetching viewing history:", err); setError('Failed to load your viewing history. Please try again.'); setHistoryMemes([]); } finally { setLoading(false); } }, [isAuthenticated]); // Removed axiosInstance dep
    useEffect(() => { fetchHistory(); }, [fetchHistory]);

    // Modal Handlers (Unchanged)
    const openModal = useCallback((meme) => { setSelectedMeme(meme); setIsModalOpen(true); /* No recordView needed */ }, []);
    const closeModal = useCallback(() => { setIsModalOpen(false); setSelectedMeme(null); }, []);

    // *** UPDATED handleVote ***
    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) {
            alert("Please log in to vote.");
            return;
        }

        // Store original states
        const originalHistoryMemes = [...historyMemes];
        const originalSelectedMeme = selectedMeme ? {...selectedMeme} : null;

        // --- Optimistic UI Update ---
        // 1. Update the main 'historyMemes' list state
        setHistoryMemes(prevMemes => prevMemes.map(m => {
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
            setHistoryMemes(originalHistoryMemes); // Revert the main list
            if (originalSelectedMeme && selectedMeme?.id === memeId) {
                 setSelectedMeme(originalSelectedMeme); // Revert the modal state
            }
            // --- End Revert UI ---
        }
    // Depend on states needed for update/revert
    }, [isAuthenticated, historyMemes, selectedMeme, axiosInstance]); // Add historyMemes

    // Favorite Toggle Handler (Unchanged)
    const handleFavoriteToggle = useCallback(async (memeId) => { if (!isAuthenticated || loadingFavorites) return; const currentlyFavorite = isFavorite(memeId); const action = currentlyFavorite ? removeFavorite : addFavorite; await action(memeId); }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);

    return (
        <div className="history-page">
            <h1>Viewing History</h1>
            <p className="history-subtitle">Memes you've recently watched.</p>

            <MemeGrid
                memes={historyMemes} // Pass updated list
                loading={loading || loadingViewed}
                error={error}
                onMemeClick={openModal}
                onVote={handleVote} // Pass updated handler
                onFavoriteToggle={handleFavoriteToggle}
                isMemeViewed={(memeId) => !loadingViewed && isViewed(memeId)} // Pass view check
            />

             {!loading && !error && historyMemes.length === 0 && ( <div className="empty-history-message">You haven't viewed any memes yet. Go watch some!</div> )}

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

export default HistoryPage;