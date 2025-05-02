// frontend/src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import MemeRow from '../components/MemeRow';
import MemeDetailModal from '../components/MemeDetailModal';
import HeroBanner from '../components/HeroBanner';

const ROW_MEME_LIMIT = 15;

function HomePage() {
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [featuredMeme, setFeaturedMeme] = useState(null);
    const [loadingFeatured, setLoadingFeatured] = useState(true);
    const [popularTags, setPopularTags] = useState([]);
    const [loadingTags, setLoadingTags] = useState(true);
    const [rowError, setRowError] = useState(null);

    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites } = useAuth();

    // Fetch featured meme
    const fetchFeaturedMeme = useCallback(async () => {
        setLoadingFeatured(true);
         try {
            const response = await axiosInstance.get('/api/memes', { params: { page: 1, limit: 1 } });
            setFeaturedMeme(response.data.memes && response.data.memes.length > 0 ? response.data.memes[0] : null);
        } catch (error) { console.error("Error fetching featured meme:", error); setFeaturedMeme(null); }
        finally { setLoadingFeatured(false); }
    }, [axiosInstance]);

    // Fetch Popular Tags
    const fetchPopularTags = useCallback(async () => {
        setLoadingTags(true);
        setRowError(null);
        try {
            const response = await axiosInstance.get('/api/tags/popular', { params: { limit: 8 } });
            setPopularTags(response.data.popularTags || []);
        } catch (error) {
            console.error("Error fetching popular tags:", error);
            setRowError("Could not load categories.");
            setPopularTags([]);
        } finally {
            setLoadingTags(false);
        }
    }, [axiosInstance]);

    useEffect(() => {
        fetchFeaturedMeme();
        fetchPopularTags();
    }, [fetchFeaturedMeme, fetchPopularTags]);

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
                 setSelectedMeme(prev => ({ ...prev, upvotes: voteType === 'upvote' ? (prev.upvotes ?? 0) + 1 : prev.upvotes, downvotes: voteType === 'downvote' ? (prev.downvotes ?? 0) + 1 : prev.downvotes }));
            }
        } catch (error) {
             // *** CORRECTED ERROR HANDLING ***
             console.error(`Error ${voteType}ing meme ${memeId}:`, error);
             alert(`Failed to register ${voteType}.`);
             // *** END CORRECTION ***
        }
    }, [isAuthenticated, selectedMeme, axiosInstance]);

    // Favorite Toggle Handler
     const handleFavoriteToggle = useCallback(async (memeId) => {
         if (!isAuthenticated) { alert("Please log in."); return; }
         if (loadingFavorites) return;
         const currentlyFavorite = isFavorite(memeId);
         if (currentlyFavorite) { await removeFavorite(memeId); } else { await addFavorite(memeId); }
     }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);

     // Format tag name helper
     const formatTagTitle = (tag) => {
         return tag.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
     };

    return (
        <>
             {!loadingFeatured && featuredMeme &&
                <HeroBanner
                    featuredMeme={featuredMeme}
                    onPlayClick={openModal}
                    onFavoriteToggle={handleFavoriteToggle}
                />
             }
             {(loadingFeatured || loadingTags) && <div className="loading-row">Loading Content...</div>}
             {rowError && <div className="error-message">{rowError}</div>}

            {!loadingTags && !rowError && popularTags.length > 0 && (
                <div className="meme-rows-wrapper">
                    {popularTags.map(tagInfo => (
                        <MemeRow
                            key={tagInfo.tag}
                            title={formatTagTitle(tagInfo.tag)}
                            tag={tagInfo.tag}
                            onMemeClick={openModal}
                            onVote={handleVote}
                            onFavoriteToggle={handleFavoriteToggle}
                        />
                    ))}
                    {/* Add back generic row if desired and MemeRow supports fetchUrl */}
                    {/* <MemeRow key="more-memes" title="More Memes" fetchUrl={`/api/memes?page=1&limit=${ROW_MEME_LIMIT}`} {...handlers} /> */}
                </div>
            )}
             {!loadingTags && !rowError && popularTags.length === 0 && (
                 <div className="info-message">Could not find any popular tags to display rows.</div>
             )}

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