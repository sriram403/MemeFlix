// frontend/src/pages/HistoryPage.jsx (New File)
import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MemeGrid from '../components/MemeGrid'; // Reuse MemeGrid for display
import MemeDetailModal from '../components/MemeDetailModal';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './HistoryPage.css'; // Specific styles for this page

function HistoryPage() {
    const [historyMemes, setHistoryMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    // Import necessary auth functions for voting/favoriting FROM history page
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView } = useAuth();
    const navigate = useNavigate(); // Keep for potential redirects

    // Fetch viewing history
    const fetchHistory = useCallback(async () => {
        // No need to check isAuthenticated here, ProtectedRoute should handle access
        setLoading(true);
        setError(null);
        try {
            // Call the new backend endpoint
            const response = await axiosInstance.get('/api/history');
            setHistoryMemes(response.data.memes || []);
        } catch (err) {
            console.error("Error fetching viewing history:", err);
            setError('Failed to load your viewing history. Please try again.');
            setHistoryMemes([]);
        } finally {
            setLoading(false);
        }
    }, [axiosInstance]); // Dependency is just the axios instance

    useEffect(() => {
        fetchHistory();
    }, [fetchHistory]);

    // Modal Handlers (same as other pages)
    const openModal = (meme) => {
        setSelectedMeme(meme);
        setIsModalOpen(true);
        // Optionally re-record view here? Or rely on initial recordView in modal?
        // recordView(meme.id);
    };
    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedMeme(null);
    };

    // Vote Handler (Same logic as HomePage/MyListPage, but updates historyMemes state)
    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) return; // Should be protected, but check anyway
        const originalMemes = [...historyMemes];
        let updatedMemeData = null;

        setHistoryMemes(prevMemes => prevMemes.map(meme => {
            if (meme.id === memeId) {
                updatedMemeData = { ...meme, upvotes: voteType === 'upvote' ? meme.upvotes + 1 : meme.upvotes, downvotes: voteType === 'downvote' ? meme.downvotes + 1 : meme.downvotes };
                if (selectedMeme && selectedMeme.id === memeId) setSelectedMeme(updatedMemeData);
                return updatedMemeData;
            }
            return meme;
        }));

        try {
            await axiosInstance.post(`/api/memes/${memeId}/${voteType}`);
        } catch (error) {
            console.error(`Error ${voteType}ing meme ${memeId}:`, error);
            alert(`Failed to register ${voteType}.`);
            setHistoryMemes(originalMemes); // Rollback local state
            if (selectedMeme && selectedMeme.id === memeId) {
                 const originalMemeInList = originalMemes.find(m => m.id === memeId);
                 if(originalMemeInList) setSelectedMeme(originalMemeInList);
            }
        }
    }, [historyMemes, selectedMeme, isAuthenticated, axiosInstance]);


    // Favorite Toggle Handler (Updates context, no local state change needed here)
     const handleFavoriteToggle = useCallback(async (memeId) => {
         if (!isAuthenticated) return;
         if (loadingFavorites) return;
         const currentlyFavorite = isFavorite(memeId);
         if (currentlyFavorite) { await removeFavorite(memeId); }
         else { await addFavorite(memeId); }
     }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);


    return (
        <div className="history-page">
            <h1>Viewing History</h1>
            <p className="history-subtitle">Memes you've recently viewed (most recent first).</p>
            {/* Reuse MemeGrid, passing history data and handlers */}
            <MemeGrid
                memes={historyMemes}
                loading={loading}
                error={error}
                onMemeClick={openModal}
                onVote={handleVote}
                onFavoriteToggle={handleFavoriteToggle}
            />
             {/* Display message if history is empty */}
             {!loading && !error && historyMemes.length === 0 && (
                <div className="info-message empty-history-message">
                    You haven't viewed any memes yet. Go explore!
                </div>
             )}

             {/* Modal remains the same */}
             {isModalOpen && (
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