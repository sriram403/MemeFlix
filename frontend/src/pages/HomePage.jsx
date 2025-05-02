// frontend/src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import MemeRow from '../components/MemeRow';
import MemeDetailModal from '../components/MemeDetailModal';
import HeroBanner from '../components/HeroBanner';

// Removed API_BASE_URL as axiosInstance is used

function HomePage() {
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [featuredMeme, setFeaturedMeme] = useState(null);
    const [loadingFeatured, setLoadingFeatured] = useState(true);

    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites } = useAuth();

    const fetchFeaturedMeme = useCallback(async () => {
        setLoadingFeatured(true);
         try {
            const response = await axiosInstance.get('/api/memes', { params: { page: 1, limit: 1 } });
            setFeaturedMeme(response.data.memes && response.data.memes.length > 0 ? response.data.memes[0] : null);
        } catch (error) { console.error("Error fetching featured meme:", error); setFeaturedMeme(null); }
        finally { setLoadingFeatured(false); }
    }, [axiosInstance]);

    useEffect(() => { fetchFeaturedMeme(); }, [fetchFeaturedMeme]);

    // *** UPDATED Row Config using tags from your CSV ***
    // Use tags exactly as they appear (case might matter depending on DB collation, but backend query uses lower())
    const memeRowsConfig = [
        { title: 'Humor & Comedy', tag: 'Humor' }, // Fetches memes tagged 'Humor' (or 'Comedy' if you change tag)
        { title: 'Mysteries', tag: 'Mystery' },    // Fetches memes tagged 'Mystery'
        { title: 'Guides', tag: 'Guide' },        // Fetches memes tagged 'Guide'
        { title: 'Life\'s Moments', tag: 'Life' },    // Fetches memes tagged 'Life'
        { title: 'Internet Culture', tag: 'Internet' }, // Fetches memes tagged 'Internet'
        { title: 'Viral Hits', tag: 'Viral' },       // Fetches memes tagged 'Viral'
        // Add more rows based on other tags in your data if desired
    ];

    const openModal = (meme) => { setSelectedMeme(meme); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedMeme(null); };

     const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) { alert("Please log in to vote."); return; }
        try {
            await axiosInstance.post(`/api/memes/${memeId}/${voteType}`);
            if (selectedMeme && selectedMeme.id === memeId) {
                 setSelectedMeme(prev => ({ ...prev, upvotes: voteType === 'upvote' ? (prev.upvotes ?? 0) + 1 : prev.upvotes, downvotes: voteType === 'downvote' ? (prev.downvotes ?? 0) + 1 : prev.downvotes }));
            }
        } catch (error) { console.error(`Error ${voteType}ing meme ${memeId}:`, error); alert(`Failed to register ${voteType}.`); }
    }, [isAuthenticated, selectedMeme, axiosInstance]);

     const handleFavoriteToggle = useCallback(async (memeId) => {
         if (!isAuthenticated) { alert("Please log in."); return; }
         if (loadingFavorites) return;
         const currentlyFavorite = isFavorite(memeId);
         if (currentlyFavorite) { await removeFavorite(memeId); } else { await addFavorite(memeId); }
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
                        key={rowConfig.tag} // Using tag as key
                        title={rowConfig.title}
                        tag={rowConfig.tag} // Pass the correct tag
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