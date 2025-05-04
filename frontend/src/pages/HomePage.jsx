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
    // State for data specific to HomePage (Hero, Tags, Tag Memes)
    const [featuredMeme, setFeaturedMeme] = useState(null);
    const [loadingFeatured, setLoadingFeatured] = useState(true); // Loading state for hero
    const [popularTags, setPopularTags] = useState([]);
    const [tagMemes, setTagMemes] = useState({});
    const [loadingTags, setLoadingTags] = useState(true);
    const [loadingTagMemes, setLoadingTagMemes] = useState({});
    const [error, setError] = useState(null);

    // State for Modal
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Hooks
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView } = useAuth();
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();

    const initialFilterType = searchParams.get('type') || '';
    const initialSortBy = searchParams.get('sort') || 'newest';

    // --- Fetching Logic ---

    // Fetch Featured Meme (now fetches random) - runs on mount and potentially on navigation
    const fetchFeatured = useCallback(async () => {
        setLoadingFeatured(true);
        // setError(null); // Clear previous specific error? Maybe not if tags failed.
        try {
            // *** Use the new random endpoint ***
            const response = await axiosInstance.get(`${API_BASE_URL}/api/memes/random`);
            if (response.data?.meme) {
                setFeaturedMeme(response.data.meme);
            } else {
                // Handle case where API returns success but no meme (e.g., empty DB)
                 setFeaturedMeme(null);
                 // Optionally set a specific error for this case if desired
                 // setError("Could not find a meme to feature.");
            }
        } catch (err) {
            console.error("Error fetching featured meme:", err);
            setError(prev => prev || "Could not load featured content."); // Keep existing error
            setFeaturedMeme(null);
        } finally {
             setLoadingFeatured(false);
        }
    }, [axiosInstance]); // Dependency only on axiosInstance

    useEffect(() => {
        fetchFeatured();
    }, [fetchFeatured]); // Run on mount

    // Add another useEffect to refetch when navigating back to this page?
    // This depends on how React Router re-mounts components.
    // A simpler way might be to just fetch on initial mount. If you
    // navigate away and back, it *should* remount and fetch again.
    // Let's stick with the mount-only fetch for now unless problems arise.


    // Fetch Popular Tags (run once on mount)
    useEffect(() => {
        const fetchTags = async () => {
            setLoadingTags(true);
            try {
                const response = await axiosInstance.get(`${API_BASE_URL}/api/tags/popular`, { params: { limit: 7 } });
                setPopularTags(response.data?.popularTags || []);
            } catch (err) {
                console.error("Error fetching popular tags:", err);
                setError(prev => prev || "Could not load tag categories.");
                setPopularTags([]);
            } finally {
                setLoadingTags(false);
            }
        };
        fetchTags();
    }, [axiosInstance]);

    // Fetch Memes for each Popular Tag (logic unchanged)
    useEffect(() => {
        if (popularTags.length === 0) return;
        popularTags.forEach(tagInfo => {
            const tagName = tagInfo.tag;
            if (!tagMemes[tagName] && !loadingTagMemes[tagName]) {
                setLoadingTagMemes(prev => ({ ...prev, [tagName]: true }));
                axiosInstance.get(`${API_BASE_URL}/api/memes/by-tag/${encodeURIComponent(tagName)}`, { params: { limit: 10 } })
                    .then(response => {
                        setTagMemes(prev => ({ ...prev, [tagName]: response.data?.memes || [] }));
                    })
                    .catch(err => {
                        console.error(`Error fetching memes for tag "${tagName}":`, err);
                        setTagMemes(prev => ({ ...prev, [tagName]: [] }));
                    })
                    .finally(() => {
                        setLoadingTagMemes(prev => ({ ...prev, [tagName]: false }));
                    });
            }
        });
    }, [popularTags, axiosInstance, tagMemes, loadingTagMemes]);

    // --- Event Handlers (Unchanged) ---

    // Modal Handlers
    const openModal = (meme) => {
        setSelectedMeme(meme);
        setIsModalOpen(true);
        recordView(meme.id);
    };
    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedMeme(null);
    };

    // Voting Handler
     const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) { alert("Please log in to vote."); return; }
        if (selectedMeme?.id === memeId) {
             const originalSelectedMeme = {...selectedMeme};
             setSelectedMeme(prev => ({ ...prev, upvotes: voteType === 'upvote' ? (prev.upvotes ?? 0) + 1 : prev.upvotes, downvotes: voteType === 'downvote' ? (prev.downvotes ?? 0) + 1 : prev.downvotes, }));
             try { await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`); }
             catch (err) { console.error(`Error ${voteType}ing meme:`, err); alert(`Failed to record ${voteType}.`); setSelectedMeme(originalSelectedMeme); }
        } else {
             try { await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`); }
             catch (err) { console.error(`Error ${voteType}ing meme:`, err); alert(`Failed to record ${voteType}.`); }
        }
    }, [isAuthenticated, selectedMeme, axiosInstance]);

    // Favorite Handler
    const handleFavoriteToggle = useCallback(async (memeId) => {
        if (!isAuthenticated || loadingFavorites) return;
        const currentlyFavorite = isFavorite(memeId);
        const action = currentlyFavorite ? removeFavorite : addFavorite;
        await action(memeId);
        // If the featured meme is the one being toggled, force a state update to reflect in HeroBanner button
        if (featuredMeme?.id === memeId) {
             setFeaturedMeme(prev => ({...prev})); // Trigger re-render of HeroBanner
        }
    }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite, featuredMeme?.id]);

    // Search Control Handlers (Unchanged)
    const handleSearchRedirect = (params) => {
        const searchParams = new URLSearchParams(params);
        navigate(`/browse?${searchParams.toString()}`);
    };
    const handleFilterChange = (newType) => { handleSearchRedirect({ type: newType, sort: initialSortBy }); };
    const handleSortChange = (newSort) => { handleSearchRedirect({ type: initialFilterType, sort: newSort }); };

    // --- Render Logic ---

    if (error && !featuredMeme && popularTags.length === 0 && !loadingTags && !loadingFeatured) {
        return <div className="error-page">{error}</div>;
    }
    if (loadingFeatured || (loadingTags && popularTags.length === 0)) {
         return <div className="loading-page">Loading Memeflix...</div>;
    }

    return (
        <div className="home-page">
            {/* Render HeroBanner only if featuredMeme is successfully loaded */}
            {featuredMeme ? (
                <HeroBanner
                    featuredMeme={featuredMeme}
                    onPlayClick={openModal}
                    onFavoriteToggle={handleFavoriteToggle}
                />
            ) : (
                // Optional: Placeholder or message if random meme couldn't load but page continues
                 !loadingFeatured && <div className="info-message">Could not load featured meme.</div>
            )}

            <SearchControls
                currentFilterType={initialFilterType}
                currentSortBy={initialSortBy}
                onFilterChange={handleFilterChange}
                onSortChange={handleSortChange}
                showTagFilter={false}
            />

            {/* Show loading indicator for tags specifically if needed */}
            {loadingTags && <div className="loading-page">Loading categories...</div>}

            {/* Render rows for popular tags */}
            {!loadingTags && popularTags.map(tagInfo => (
                <MemeRow
                    key={tagInfo.tag}
                    title={`Popular in "${tagInfo.tag}"`}
                    memes={tagMemes[tagInfo.tag] || []}
                    isLoading={loadingTagMemes[tagInfo.tag] ?? true}
                    onMemeClick={openModal}
                    onFavoriteToggle={handleFavoriteToggle}
                />
            ))}

            {/* Show general error if tag loading failed but hero might have loaded */}
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