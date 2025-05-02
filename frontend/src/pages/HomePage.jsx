// frontend/src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
// Removed useSearchParams if search handled only in Navbar
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import MemeRow from '../components/MemeRow'; // Import MemeRow
import MemeDetailModal from '../components/MemeDetailModal';
import HeroBanner from '../components/HeroBanner';
// Removed MemeGrid and PaginationControls imports from this page

const API_BASE_URL = 'http://localhost:3001';
const ROW_MEME_LIMIT = 15; // How many memes to fetch per row

function HomePage() {
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [featuredMeme, setFeaturedMeme] = useState(null);
    const [loadingFeatured, setLoadingFeatured] = useState(true); // Loading state for banner

    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites } = useAuth();

    // Fetch data specifically for the hero banner (e.g., most recent or truly featured)
    const fetchFeaturedMeme = useCallback(async () => {
        setLoadingFeatured(true);
         try {
            const response = await axiosInstance.get('/api/memes', { params: { page: 1, limit: 1 } });
            if (response.data.memes && response.data.memes.length > 0) {
                setFeaturedMeme(response.data.memes[0]);
            } else {
                setFeaturedMeme(null); // Handle case where no memes exist
            }
        } catch (error) {
            console.error("Error fetching featured meme:", error);
            setFeaturedMeme(null);
        } finally {
            setLoadingFeatured(false);
        }
    }, [axiosInstance]);

    useEffect(() => {
        fetchFeaturedMeme();
    }, [fetchFeaturedMeme]);


    // Define the rows with different API URLs (fetching different 'pages' as rows)
    const memeRowsConfig = [
        { title: 'Fresh Memes', fetchUrl: `/api/memes?page=1&limit=${ROW_MEME_LIMIT}` },
        { title: 'More Memes', fetchUrl: `/api/memes?page=2&limit=${ROW_MEME_LIMIT}` },
        { title: 'Keep Scrolling', fetchUrl: `/api/memes?page=3&limit=${ROW_MEME_LIMIT}` },
        { title: 'You Might Like These', fetchUrl: `/api/memes?page=4&limit=${ROW_MEME_LIMIT}` },
        // { title: 'Funny Memes', fetchUrl: `/api/memes/tag/funny?limit=${ROW_MEME_LIMIT}` },
    ];

    // Modal Handlers
    const openModal = (meme) => { setSelectedMeme(meme); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedMeme(null); };

    // Vote Handler
     const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) { alert("Please log in to vote."); return; }

        try {
            await axiosInstance.post(`/api/memes/${memeId}/${voteType}`);
            console.log(`Vote ${voteType} registered for ${memeId}`);
            if (selectedMeme && selectedMeme.id === memeId) {
                 setSelectedMeme(prev => ({
                    ...prev,
                    upvotes: voteType === 'upvote' ? (prev.upvotes ?? 0) + 1 : prev.upvotes,
                    downvotes: voteType === 'downvote' ? (prev.downvotes ?? 0) + 1 : prev.downvotes,
                 }));
            }
            // Note: No optimistic UI update for rows here
        } catch (error) {
             // *** CORRECTED ERROR HANDLING ***
             console.error(`Error ${voteType}ing meme ${memeId}:`, error);
             alert(`Failed to register ${voteType}.`);
             // *** END CORRECTION ***
        }
    }, [isAuthenticated, selectedMeme, axiosInstance]); // Removed row state dependencies

    // Favorite Toggle Handler
     const handleFavoriteToggle = useCallback(async (memeId) => {
         if (!isAuthenticated) { alert("Please log in."); return; }
         if (loadingFavorites) return;
         const currentlyFavorite = isFavorite(memeId);
         if (currentlyFavorite) { await removeFavorite(memeId); }
         else { await addFavorite(memeId); }
     }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);


    return (
        <>
             {!loadingFeatured && featuredMeme &&
                <HeroBanner
                    featuredMeme={featuredMeme}
                    onPlayClick={openModal}
                    onFavoriteToggle={handleFavoriteToggle}
                />
             }
             {loadingFeatured && <div className="loading-row">Loading Banner...</div>}

            <div className="meme-rows-wrapper">
                {memeRowsConfig.map(rowConfig => (
                    <MemeRow
                        key={rowConfig.title}
                        title={rowConfig.title}
                        fetchUrl={rowConfig.fetchUrl}
                        onMemeClick={openModal}
                        onVote={handleVote}
                        onFavoriteToggle={handleFavoriteToggle}
                    />
                ))}
            </div>

            {isModalOpen && (
                <MemeDetailModal
                    meme={selectedMeme}
                    onClose={closeModal}
                    onVote={handleVote}
                    onFavoriteToggle={handleFavoriteToggle}
                />
            )}
        </>
    );
}

export default HomePage;