import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import MemeGrid from '../components/MemeGrid';
import MemeDetailModal from '../components/MemeDetailModal';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './MyListPage.css';

function MyListPage() {
    const [favoriteMemes, setFavoriteMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites } = useAuth();
    const navigate = useNavigate(); // Keep navigate for potential redirects

    const fetchFavorites = useCallback(async () => {
        // No need to check isAuthenticated here, ProtectedRoute does it
        setLoading(true);
        setError(null);
        try {
            const response = await axiosInstance.get('/api/favorites');
            setFavoriteMemes(response.data.memes || []);
        } catch (err) {
            console.error("Error fetching favorites:", err);
            setError('Failed to load your list. Please try again.');
            setFavoriteMemes([]); // Clear memes on error
        } finally {
            setLoading(false);
        }
    // No need for isAuthenticated/navigate dependency if ProtectedRoute handles it
    }, [axiosInstance]); // Dependency is only the instance now

    useEffect(() => {
        fetchFavorites();
    }, [fetchFavorites]);

    const openModal = (meme) => { setSelectedMeme(meme); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedMeme(null); };

    const handleVote = useCallback(async (memeId, voteType) => {
        // Voting doesn't require auth check here as it's passed down
        const originalMemes = [...favoriteMemes];
        let updatedMemeData = null;

        setFavoriteMemes(prevMemes => prevMemes.map(meme => {
            if (meme.id === memeId) {
                updatedMemeData = { ...meme, upvotes: voteType === 'upvote' ? meme.upvotes + 1 : meme.upvotes, downvotes: voteType === 'downvote' ? meme.downvotes + 1 : meme.downvotes };
                if (selectedMeme && selectedMeme.id === memeId) setSelectedMeme(updatedMemeData);
                return updatedMemeData;
            }
            return meme;
        }));

        try {
            const voteUrl = `/api/memes/${memeId}/${voteType}`;
            await axiosInstance.post(voteUrl);
        } catch (error) {
            console.error(`Error ${voteType}ing meme ${memeId}:`, error);
            alert(`Failed to register ${voteType}.`);
            setFavoriteMemes(originalMemes);
             if (selectedMeme && selectedMeme.id === memeId) {
                 const originalMemeInList = originalMemes.find(m => m.id === memeId);
                 if(originalMemeInList) setSelectedMeme(originalMemeInList);
             }
        }
    }, [favoriteMemes, selectedMeme, axiosInstance]); // Removed isAuthenticated

    // Handle removing from list using the context function and updating local state
     const handleFavoriteToggle = useCallback(async (memeId) => {
         // Auth check is implicit as this page is protected
         if (loadingFavorites) return;
         const currentlyFavorite = isFavorite(memeId); // Check current status

         if (currentlyFavorite) {
            const success = await removeFavorite(memeId); // Use context action
            if (success) {
                // Update local state ONLY if successful
                setFavoriteMemes(prevMemes => prevMemes.filter(meme => meme.id !== memeId));
                if (selectedMeme && selectedMeme.id === memeId) closeModal();
            } else {
                alert("Failed to remove from My List.");
            }
         } else {
             // This case shouldn't happen often on the My List page, but handle adding just in case
             const success = await addFavorite(memeId);
             if (success) {
                 // Need to fetch the added meme details if we want to add it here
                 // For simplicity, maybe just refetch the whole list? Or rely on next navigation
                 // fetchFavorites(); // Re-fetch to include the newly added item
                 alert("Meme added back to list (refresh might be needed).");
             } else {
                 alert("Failed to add to My List.");
             }
         }
     }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite, selectedMeme, fetchFavorites, closeModal]); // Added dependencies


    return (
        <div className="my-list-page">
            <h1>My List</h1>
            <MemeGrid
                memes={favoriteMemes}
                loading={loading || loadingFavorites} // Show loading if fetching list OR initial favorites
                error={error}
                onMemeClick={openModal}
                onVote={handleVote}
                onFavoriteToggle={handleFavoriteToggle} // Pass toggle handler
                // Add a prop to indicate this is the favorites view if needed for card styling/behavior
                // isFavoritesView={true}
            />
             {!loading && !error && favoriteMemes.length === 0 && (
                <div className="info-message empty-list-message">
                    Your list is empty. Add some memes from the home page!
                </div>
             )}

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

export default MyListPage;