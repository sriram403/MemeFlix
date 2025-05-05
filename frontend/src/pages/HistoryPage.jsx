// frontend/src/pages/HistoryPage.jsx
import React, { useState, useEffect, useCallback, useRef } from 'react'; // Add useRef
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import MemeGrid from '../components/MemeGrid';
import MemeDetailModal from '../components/MemeDetailModal';
import Spinner from '../components/Spinner';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './HistoryPage.css'; // Ensure CSS file is imported

const API_BASE_URL = 'http://localhost:3001';

function HistoryPage() {
    const [historyMemes, setHistoryMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // --- State for Clear Button Confirmation ---
    const [confirmingClear, setConfirmingClear] = useState(false);
    const confirmTimeoutRef = useRef(null); // Ref to store timeout ID

    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed, submitVote, getUserVoteStatus, clearHistory } = useAuth();
    const navigate = useNavigate();

    // Fetch history / Modal / Vote / Favorite handlers (Unchanged)
    const fetchHistory = useCallback(async () => { if (!isAuthenticated) { setError("Please log in to view your history."); setLoading(false); return; } setLoading(true); setError(null); try { const response = await axiosInstance.get('/api/history'); setHistoryMemes(response.data.memes || []); } catch (err) { console.error("Error fetching viewing history:", err); setError('Failed to load your viewing history. Please try again.'); setHistoryMemes([]); } finally { setLoading(false); } }, [isAuthenticated]);
    useEffect(() => { fetchHistory(); }, [fetchHistory]);
    const openModal = useCallback((meme) => { setSelectedMeme(meme); setIsModalOpen(true); }, []);
    const closeModal = useCallback(() => { setIsModalOpen(false); setSelectedMeme(null); }, []);
    const handleVote = useCallback(async (memeId, voteType) => { if (!isAuthenticated) { alert("Please log in to vote."); return; } setError(null); const originalHistoryMemes = [...historyMemes]; const originalSelectedMeme = selectedMeme ? {...selectedMeme} : null; const voteChange = voteType === 'upvote' ? 1 : -1; const currentVoteStatus = getUserVoteStatus(memeId); let upvoteIncrement = 0; let downvoteIncrement = 0; if (currentVoteStatus === voteChange) { if(voteType === 'upvote') upvoteIncrement = -1; else downvoteIncrement = -1; } else if (currentVoteStatus === -voteChange) { if(voteType === 'upvote') { upvoteIncrement = 1; downvoteIncrement = -1; } else { upvoteIncrement = -1; downvoteIncrement = 1; } } else { if(voteType === 'upvote') upvoteIncrement = 1; else downvoteIncrement = 1; } setHistoryMemes(prevMemes => prevMemes.map(m => { if (m.id === memeId) { return { ...m, upvotes: (m.upvotes ?? 0) + upvoteIncrement, downvotes: (m.downvotes ?? 0) + downvoteIncrement }; } return m; })); if (selectedMeme?.id === memeId) { setSelectedMeme(prev => { if (!prev) return null; return { ...prev, upvotes: (prev.upvotes ?? 0) + upvoteIncrement, downvotes: (prev.downvotes ?? 0) + downvoteIncrement }; }); } const result = await submitVote(memeId, voteType); if (!result.success) { setError(result.error || `Failed to record ${voteType}.`); setHistoryMemes(originalHistoryMemes); if (originalSelectedMeme && selectedMeme?.id === memeId) { setSelectedMeme(originalSelectedMeme); } } }, [isAuthenticated, historyMemes, selectedMeme, submitVote, getUserVoteStatus]);
    const handleFavoriteToggle = useCallback(async (memeId) => { if (!isAuthenticated || loadingFavorites) return; const currentlyFavorite = isFavorite(memeId); const action = currentlyFavorite ? removeFavorite : addFavorite; await action(memeId); }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);


    // *** UPDATED Clear History Handler ***
    const handleClearHistoryClick = async () => {
        // If already confirming, proceed with clearing
        if (confirmingClear) {
            // Clear the timeout just in case
            if (confirmTimeoutRef.current) {
                clearTimeout(confirmTimeoutRef.current);
                confirmTimeoutRef.current = null;
            }
            setError(null);
            // setLoading(true); // Optional: visual loading state on button?

            const result = await clearHistory();

            // setLoading(false);
            setConfirmingClear(false); // Reset button state regardless of outcome

            if (result.success) {
                setHistoryMemes([]);
                toast.success("Sins cleared successfully! 🤫", { theme: "dark" });
            } else {
                const errorMsg = result.error || "Failed to clear history.";
                setError(errorMsg);
                toast.error(errorMsg, { theme: "dark" });
            }
        } else {
            // First click: enter confirmation state
            setConfirmingClear(true);
            // Set a timeout to revert the button if not clicked again quickly
            confirmTimeoutRef.current = setTimeout(() => {
                setConfirmingClear(false);
                confirmTimeoutRef.current = null;
                console.log("Clear history confirmation timed out.");
            }, 5000); // Revert after 5 seconds
        }
    };

    // Cleanup timeout on component unmount
    useEffect(() => {
        return () => {
            if (confirmTimeoutRef.current) {
                clearTimeout(confirmTimeoutRef.current);
            }
        };
    }, []);


    const isGridLoading = loading;

    return (
        <div className="history-page">
            <div className="history-header">
                 <h1>Viewing History</h1>
                 {!isGridLoading && historyMemes.length > 0 && (
                    <button
                        onClick={handleClearHistoryClick} // Use the new handler
                        className={`clear-history-button ${confirmingClear ? 'confirming' : ''}`}
                        // disabled={loading} // Optional: disable while loading
                    >
                        {confirmingClear ? 'Confirm Clear?' : 'Clear My Sins'}
                    </button>
                 )}
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