// frontend/src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MemeRow from '../components/MemeRow';
import MemeDetailModal from '../components/MemeDetailModal';
import HeroBanner from '../components/HeroBanner';
import SearchControls from '../components/SearchControls';
import { useAuth, axiosInstance } from '../contexts/AuthContext'; // Import useAuth
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

    // *** Get isViewed function from context ***
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed, loadingViewed } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const initialFilterType = searchParams.get('type') || '';
    const initialSortBy = searchParams.get('sort') || 'newest';

    // Fetching Logic (useEffect hooks for featured, popular tags, tag memes - unchanged)
    const fetchFeatured = useCallback(async () => { setLoadingFeatured(true); try { const response = await axiosInstance.get(`${API_BASE_URL}/api/memes/random`); if (response.data?.meme) { setFeaturedMeme(response.data.meme); } else { setFeaturedMeme(null); } } catch (err) { console.error("Error fetching featured meme:", err); setError(prev => prev || "Could not load featured content."); setFeaturedMeme(null); } finally { setLoadingFeatured(false); } }, [axiosInstance]);
    useEffect(() => { fetchFeatured(); }, [fetchFeatured]);
    useEffect(() => { const fetchTags = async () => { setLoadingTags(true); try { const response = await axiosInstance.get(`${API_BASE_URL}/api/tags/popular`, { params: { limit: 7 } }); setPopularTags(response.data?.popularTags || []); } catch (err) { console.error("Error fetching popular tags:", err); setError(prev => prev || "Could not load tag categories."); setPopularTags([]); } finally { setLoadingTags(false); } }; fetchTags(); }, [axiosInstance]);
    useEffect(() => { if (popularTags.length === 0) return; popularTags.forEach(tagInfo => { const tagName = tagInfo.tag; if (!tagMemes[tagName] && !loadingTagMemes[tagName]) { setLoadingTagMemes(prev => ({ ...prev, [tagName]: true })); axiosInstance.get(`${API_BASE_URL}/api/memes/by-tag/${encodeURIComponent(tagName)}`, { params: { limit: 10 } }).then(response => { setTagMemes(prev => ({ ...prev, [tagName]: response.data?.memes || [] })); }).catch(err => { console.error(`Error fetching memes for tag "${tagName}":`, err); setTagMemes(prev => ({ ...prev, [tagName]: [] })); }).finally(() => { setLoadingTagMemes(prev => ({ ...prev, [tagName]: false })); }); } }); }, [popularTags, axiosInstance, tagMemes, loadingTagMemes]);

    // Event Handlers (Modal, Vote, Favorite, Search Redirect - unchanged)
    const openModal = (meme) => { setSelectedMeme(meme); setIsModalOpen(true); recordView(meme.id); };
    const closeModal = () => { setIsModalOpen(false); setSelectedMeme(null); };
    const handleVote = useCallback(async (memeId, voteType) => { if (!isAuthenticated) { alert("Please log in to vote."); return; } if (selectedMeme?.id === memeId) { const originalSelectedMeme = {...selectedMeme}; setSelectedMeme(prev => ({ ...prev, upvotes: voteType === 'upvote' ? (prev.upvotes ?? 0) + 1 : prev.upvotes, downvotes: voteType === 'downvote' ? (prev.downvotes ?? 0) + 1 : prev.downvotes, })); try { await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`); } catch (err) { console.error(`Error ${voteType}ing meme:`, err); alert(`Failed to record ${voteType}.`); setSelectedMeme(originalSelectedMeme); } } else { try { await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`); } catch (err) { console.error(`Error ${voteType}ing meme:`, err); alert(`Failed to record ${voteType}.`); } } }, [isAuthenticated, selectedMeme, axiosInstance, recordView]);
    const handleFavoriteToggle = useCallback(async (memeId) => { if (!isAuthenticated || loadingFavorites) return; const currentlyFavorite = isFavorite(memeId); const action = currentlyFavorite ? removeFavorite : addFavorite; const success = await action(memeId); if (success && featuredMeme?.id === memeId) { setFeaturedMeme(prev => ({...prev})); } }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite, featuredMeme?.id]);
    const handleSearchRedirect = (params) => { const searchParams = new URLSearchParams(params); navigate(`/browse?${searchParams.toString()}`); };
    const handleFilterChange = (newType) => { handleSearchRedirect({ type: newType, sort: initialSortBy }); };
    const handleSortChange = (newSort) => { handleSearchRedirect({ type: initialFilterType, sort: newSort }); };


    // Render Logic
    if (error && !featuredMeme && popularTags.length === 0 && !loadingTags && !loadingFeatured) { return <div className="error-page">{error}</div>; }
    if (loadingFeatured || (loadingTags && popularTags.length === 0)) { return <div className="loading-page">Loading Memeflix...</div>; }

    return (
        <div className="home-page">
            {featuredMeme ? (
                <HeroBanner
                    featuredMeme={featuredMeme}
                    onPlayClick={openModal}
                    onFavoriteToggle={handleFavoriteToggle}
                    // isViewed={isViewed(featuredMeme.id)} // Pass viewed status if needed for Hero
                />
            ) : ( !loadingFeatured && <div className="info-message">Could not load featured meme.</div> )}

            <SearchControls
                currentFilterType={initialFilterType}
                currentSortBy={initialSortBy}
                onFilterChange={handleFilterChange}
                onSortChange={handleSortChange}
                showTagFilter={false}
            />

            {loadingTags && <div className="loading-page">Loading categories...</div>}

            {!loadingTags && popularTags.map(tagInfo => (
                <MemeRow
                    key={tagInfo.tag}
                    title={`Popular in "${tagInfo.tag}"`}
                    memes={tagMemes[tagInfo.tag] || []}
                    isLoading={loadingTagMemes[tagInfo.tag] ?? true}
                    onMemeClick={openModal}
                    onFavoriteToggle={handleFavoriteToggle}
                    // *** Pass isViewed function down ***
                    isMemeViewed={(memeId) => !loadingViewed && isViewed(memeId)} // Check loading state
                />
            ))}

             {!loadingTags && error && <div className="error-message">{error}</div>}

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

export default HomePage;