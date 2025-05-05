// frontend/src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MemeRow from '../components/MemeRow';
import MemeDetailModal from '../components/MemeDetailModal';
import HeroBanner from '../components/HeroBanner';
import SearchControls from '../components/SearchControls';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './HomePage.css';

const API_BASE_URL = 'http://localhost:3001';

function HomePage() {
    const [featuredMeme, setFeaturedMeme] = useState(null);
    const [loadingFeatured, setLoadingFeatured] = useState(true);
    const [popularTags, setPopularTags] = useState([]);
    const [tagMemes, setTagMemes] = useState({}); // Stores { tagName: [memes] }
    const [loadingTags, setLoadingTags] = useState(true);
    const [loadingTagMemes, setLoadingTagMemes] = useState({});
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed, loadingViewed } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const initialFilterType = searchParams.get('type') || '';
    const initialSortBy = searchParams.get('sort') || 'newest';

    // Fetching Logic (Unchanged)
    const fetchFeatured = useCallback(async () => { setLoadingFeatured(true); try { const response = await axiosInstance.get(`${API_BASE_URL}/api/memes/random`); if (response.data?.meme) { setFeaturedMeme(response.data.meme); } else { setFeaturedMeme(null); } } catch (err) { console.error("Error fetching featured meme:", err); setError(prev => prev || "Could not load featured content."); setFeaturedMeme(null); } finally { setLoadingFeatured(false); } }, [axiosInstance]);
    useEffect(() => { fetchFeatured(); }, [fetchFeatured]);
    useEffect(() => { const fetchTags = async () => { setLoadingTags(true); try { const response = await axiosInstance.get(`${API_BASE_URL}/api/tags/popular`, { params: { limit: 7 } }); setPopularTags(response.data?.popularTags || []); } catch (err) { console.error("Error fetching popular tags:", err); setError(prev => prev || "Could not load tag categories."); setPopularTags([]); } finally { setLoadingTags(false); } }; fetchTags(); }, [axiosInstance]);
    useEffect(() => { if (popularTags.length === 0) return; popularTags.forEach(tagInfo => { const tagName = tagInfo.tag; if (!tagMemes[tagName] && !loadingTagMemes[tagName]) { setLoadingTagMemes(prev => ({ ...prev, [tagName]: true })); axiosInstance.get(`${API_BASE_URL}/api/memes/by-tag/${encodeURIComponent(tagName)}`, { params: { limit: 10 } }).then(response => { setTagMemes(prev => ({ ...prev, [tagName]: response.data?.memes || [] })); }).catch(err => { console.error(`Error fetching memes for tag "${tagName}":`, err); setTagMemes(prev => ({ ...prev, [tagName]: [] })); }).finally(() => { setLoadingTagMemes(prev => ({ ...prev, [tagName]: false })); }); } }); }, [popularTags, axiosInstance, tagMemes, loadingTagMemes]);

    // Event Handlers
    const openModal = (meme) => { setSelectedMeme(meme); setIsModalOpen(true); recordView(meme.id); };
    const closeModal = () => { setIsModalOpen(false); setSelectedMeme(null); };

    // *** UPDATED handleVote ***
    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) {
            alert("Please log in to vote.");
            return;
        }

        // Store original states for potential revert
        const originalTagMemes = {...tagMemes}; // Shallow copy is fine here
        const originalSelectedMeme = selectedMeme ? {...selectedMeme} : null;

        // --- Optimistic UI Update ---
        // 1. Update the specific tag row state in 'tagMemes'
        let updated = false;
        const newTagMemes = { ...tagMemes };
        for (const tagName in newTagMemes) {
            const updatedList = newTagMemes[tagName].map(m => {
                if (m.id === memeId) {
                    updated = true; // Mark that we found and updated the meme
                    const currentUpvotes = m.upvotes ?? 0;
                    const currentDownvotes = m.downvotes ?? 0;
                    return {
                        ...m,
                        upvotes: voteType === 'upvote' ? currentUpvotes + 1 : currentUpvotes,
                        downvotes: voteType === 'downvote' ? currentDownvotes + 1 : currentDownvotes,
                    };
                }
                return m;
            });
            newTagMemes[tagName] = updatedList;
        }
        if (updated) {
            setTagMemes(newTagMemes); // Update state only if meme was found in rows
        }


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
            setError(`Failed to record ${voteType}. Please try again.`); // Show error message
            setTagMemes(originalTagMemes); // Revert the tag rows state
            if (originalSelectedMeme && selectedMeme?.id === memeId) {
                 setSelectedMeme(originalSelectedMeme); // Revert the modal state
            }
            // --- End Revert UI ---
        }
    // Depend on states needed for update/revert
    }, [isAuthenticated, tagMemes, selectedMeme, axiosInstance]); // Add tagMemes

    const handleFavoriteToggle = useCallback(async (memeId) => { if (!isAuthenticated || loadingFavorites) return; const currentlyFavorite = isFavorite(memeId); const action = currentlyFavorite ? removeFavorite : addFavorite; const success = await action(memeId); if (success && featuredMeme?.id === memeId) { setFeaturedMeme(prev => ({...prev})); } }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite, featuredMeme?.id]);
    const handleSearchRedirect = (params) => { const searchParams = new URLSearchParams(params); navigate(`/browse?${searchParams.toString()}`); };
    const handleFilterChange = (newType) => { handleSearchRedirect({ type: newType, sort: initialSortBy }); };
    const handleSortChange = (newSort) => { handleSearchRedirect({ type: initialFilterType, sort: newSort }); };

    // Render Logic (Unchanged)
    if (error && !featuredMeme && popularTags.length === 0 && !loadingTags && !loadingFeatured) { return <div className="error-page">{error}</div>; }
    if (loadingFeatured || (loadingTags && popularTags.length === 0)) { return <div className="loading-page">Loading Memeflix...</div>; }

    return (
        <div className="home-page">
            {featuredMeme ? ( <HeroBanner featuredMeme={featuredMeme} onPlayClick={openModal} onFavoriteToggle={handleFavoriteToggle} /> ) : ( !loadingFeatured && <div className="info-message">Could not load featured meme.</div> )}
            <SearchControls currentFilterType={initialFilterType} currentSortBy={initialSortBy} onFilterChange={handleFilterChange} onSortChange={handleSortChange} showTagFilter={false} />
            {loadingTags && <div className="loading-page">Loading categories...</div>}
            {!loadingTags && popularTags.map(tagInfo => (
                <MemeRow
                    key={tagInfo.tag}
                    title={`Popular in "${tagInfo.tag}"`}
                    memes={tagMemes[tagInfo.tag] || []}
                    isLoading={loadingTagMemes[tagInfo.tag] ?? true}
                    onMemeClick={openModal}
                    onFavoriteToggle={handleFavoriteToggle}
                    isMemeViewed={(memeId) => !loadingViewed && isViewed(memeId)}
                />
            ))}
             {!loadingTags && error && <div className="error-message">{error}</div>}
            {isModalOpen && selectedMeme && (
                <MemeDetailModal
                    meme={selectedMeme}
                    onClose={closeModal}
                    onVote={handleVote} // Pass the updated handler
                    onFavoriteToggle={handleFavoriteToggle}
                />
            )}
        </div>
    );
}

export default HomePage;