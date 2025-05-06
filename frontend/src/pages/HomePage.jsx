// frontend/src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MemeRow from '../components/MemeRow';
import MemeDetailModal from '../components/MemeDetailModal';
import HeroBanner from '../components/HeroBanner';
import SearchControls from '../components/SearchControls';
import Spinner from '../components/Spinner';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './HomePage.css';

const API_BASE_URL = 'http://localhost:3001';

function HomePage() {
    const [featuredMeme, setFeaturedMeme] = useState(null);
    const [loadingFeatured, setLoadingFeatured] = useState(true);
    const [popularTags, setPopularTags] = useState([]);
    const [tagMemes, setTagMemes] = useState({});
    const [loadingTags, setLoadingTags] = useState(true);
    const [loadingTagMemes, setLoadingTagMemes] = useState({});
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // *** REMOVE submitVote, getUserVoteStatus from context destructuring ***
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed } = useAuth();
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
    const openModal = useCallback((meme) => { setSelectedMeme(meme); setIsModalOpen(true); recordView(meme.id); }, [recordView]);
    const closeModal = useCallback(() => { setIsModalOpen(false); setSelectedMeme(null); }, []);

    // *** UPDATED handleVote to call API directly ***
    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) {
            alert("Please log in to vote.");
            return;
        }
        setError(null);

        // Store original states for revert
        const originalTagMemes = { ...tagMemes };
        const originalSelectedMeme = selectedMeme ? { ...selectedMeme } : null;

        // --- Optimistic UI Update for Counts ---
        // Find which tag list (if any) contains the meme and its current vote
        let targetTagName = null;
        let currentVoteStatus = 0; // Default to 0
        for (const tagName in tagMemes) {
             const memeInList = tagMemes[tagName].find(m => m.id === memeId);
             if (memeInList) {
                 targetTagName = tagName;
                 currentVoteStatus = memeInList.user_vote_status || 0; // Use API flag
                 break;
             }
        }
         // Also check selectedMeme's vote status if modal is open
         if (selectedMeme?.id === memeId) {
             currentVoteStatus = selectedMeme.user_vote_status || 0;
         }


        const voteChange = voteType === 'upvote' ? 1 : -1;
        let upvoteIncrement = 0;
        let downvoteIncrement = 0;

        if (currentVoteStatus === voteChange) {
            if (voteType === 'upvote') upvoteIncrement = -1; else downvoteIncrement = -1;
        } else if (currentVoteStatus === -voteChange) {
            if (voteType === 'upvote') { upvoteIncrement = 1; downvoteIncrement = -1; }
            else { upvoteIncrement = -1; downvoteIncrement = 1; }
        } else {
            if (voteType === 'upvote') upvoteIncrement = 1; else downvoteIncrement = 1;
        }

        // Update the specific tag row state
        if (targetTagName) {
            setTagMemes(prev => ({
                ...prev,
                [targetTagName]: prev[targetTagName].map(m =>
                    m.id === memeId
                        ? { ...m, upvotes: (m.upvotes ?? 0) + upvoteIncrement, downvotes: (m.downvotes ?? 0) + downvoteIncrement, user_vote_status: voteChange === currentVoteStatus ? 0 : voteChange } // Update vote status too
                        : m
                )
            }));
        }

        // Update the selectedMeme state
        if (selectedMeme?.id === memeId) {
            setSelectedMeme(prev => ({
                ...prev,
                upvotes: (prev.upvotes ?? 0) + upvoteIncrement,
                downvotes: (prev.downvotes ?? 0) + downvoteIncrement,
                user_vote_status: voteChange === currentVoteStatus ? 0 : voteChange // Update vote status too
            }));
        }
        // --- End Optimistic Update ---

        // --- Direct API Call ---
        try {
            await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`);
            // If successful, optimistic update stays. Might re-fetch for absolute certainty later.
        } catch (err) {
            console.error(`Error ${voteType}ing meme:`, err);
            setError(err.response?.data?.error || `Failed to record ${voteType}.`);
            // Revert UI
            setTagMemes(originalTagMemes);
            if (originalSelectedMeme && selectedMeme?.id === memeId) {
                setSelectedMeme(originalSelectedMeme);
            }
        }
    }, [isAuthenticated, tagMemes, selectedMeme]); // Removed context vote functions

    const handleFavoriteToggle = useCallback(async (memeId) => { if (!isAuthenticated || loadingFavorites) return; const currentlyFavorite = isFavorite(memeId); const action = currentlyFavorite ? removeFavorite : addFavorite; const success = await action(memeId); if (success && featuredMeme?.id === memeId) { setFeaturedMeme(prev => ({...prev})); } }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite, featuredMeme?.id]);
    const handleSearchRedirect = (params) => { const searchParams = new URLSearchParams(params); navigate(`/browse?${searchParams.toString()}`); };
    const handleFilterChange = (newType) => { handleSearchRedirect({ type: newType, sort: initialSortBy }); };
    const handleSortChange = (newSort) => { handleSearchRedirect({ type: initialFilterType, sort: newSort }); };

    // Render Logic (Unchanged)
    if (loadingFeatured || (loadingTags && popularTags.length === 0)) { return ( <div className="loading-page-container" role="status" aria-live="polite"> <Spinner size="large" message="Loading Memeflix..." /> </div> ); }
    if (error && !featuredMeme && popularTags.length === 0) { return <div className="error-page" role="alert">{error}</div>; }

    return (
        <div className="home-page">
            {featuredMeme ? ( <HeroBanner featuredMeme={featuredMeme} onPlayClick={openModal} onFavoriteToggle={handleFavoriteToggle}/> ) : ( loadingFeatured ? <Spinner size="medium" message="Loading featured meme..." /> : !error && <div className="info-message" role="status">Could not load featured meme.</div> )}
            <SearchControls currentFilterType={initialFilterType} currentSortBy={initialSortBy} onFilterChange={handleFilterChange} onSortChange={handleSortChange} showTagFilter={false} />
            {loadingTags && !loadingFeatured && <Spinner size="medium" message="Loading categories..." />}
            {!loadingTags && error && <div className="error-message" role="alert">{error}</div>}
            {!loadingTags && popularTags.map(tagInfo => (
                <MemeRow
                    key={tagInfo.tag}
                    title={`Popular in "${tagInfo.tag}"`}
                    memes={tagMemes[tagInfo.tag] || []}
                    isLoading={loadingTagMemes[tagInfo.tag] ?? true}
                    onMemeClick={openModal}
                    onFavoriteToggle={handleFavoriteToggle}
                    // Pass the meme data itself for the check
                    isMemeViewedCheck={(memeData) => isViewed(memeData.id, memeData)}
                />
            ))}
            {isModalOpen && selectedMeme && (
                 <MemeDetailModal
                    meme={selectedMeme} // Pass the updated selectedMeme
                    onClose={closeModal}
                    onVote={handleVote} // Pass the updated handler
                    onFavoriteToggle={handleFavoriteToggle}
                    // No need to pass getUserVoteStatus, modal reads from meme prop
                 />
             )}
        </div>
    );
}

export default HomePage;