// frontend/src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MemeRow from '../components/MemeRow';
import MemeDetailModal from '../components/MemeDetailModal';
import HeroBanner from '../components/HeroBanner';
import SearchControls from '../components/SearchControls';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './HomePage.css'; // Keep general HomePage styles

const API_BASE_URL = 'http://localhost:3001';

function HomePage() {
    // State for data specific to HomePage (Hero, Tags, Tag Memes)
    const [featuredMeme, setFeaturedMeme] = useState(null);
    const [popularTags, setPopularTags] = useState([]);
    const [tagMemes, setTagMemes] = useState({});
    const [loadingTags, setLoadingTags] = useState(true);
    const [loadingTagMemes, setLoadingTagMemes] = useState({});
    const [error, setError] = useState(null); // Keep general error state for fetch issues

    // State for Modal
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Hooks
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView } = useAuth();
    const navigate = useNavigate(); // Use navigate for search redirection
    const [searchParams] = useSearchParams(); // Use searchParams only for reading initial query

    // --- Search & Filter State (Only used for SearchControls rendering) ---
    // Read initial params just to display them consistently if user lands here with params
    const initialFilterType = searchParams.get('type') || '';
    const initialSortBy = searchParams.get('sort') || 'newest';

    // --- Fetching Logic ---

    // Fetch Featured Meme (run once on mount)
    useEffect(() => {
        const fetchFeatured = async () => {
            try {
                const response = await axiosInstance.get(`${API_BASE_URL}/api/memes`, { params: { page: 1, limit: 1 } });
                if (response.data?.memes?.length > 0) {
                    setFeaturedMeme(response.data.memes[0]);
                }
            } catch (err) {
                console.error("Error fetching featured meme:", err);
                setError("Could not load featured content."); // Set general error if needed
            }
        };
        fetchFeatured();
    }, [axiosInstance]);

    // Fetch Popular Tags (run once on mount)
    useEffect(() => {
        const fetchTags = async () => {
            setLoadingTags(true);
            // setError(null); // Don't clear error from featured fetch if it happened
            try {
                const response = await axiosInstance.get(`${API_BASE_URL}/api/tags/popular`, { params: { limit: 7 } }); // Fetch top 7 tags
                setPopularTags(response.data?.popularTags || []);
            } catch (err) {
                console.error("Error fetching popular tags:", err);
                setError(prev => prev || "Could not load tag categories."); // Keep existing error if any
                setPopularTags([]);
            } finally {
                setLoadingTags(false);
            }
        };
        fetchTags();
    }, [axiosInstance]);

    // Fetch Memes for each Popular Tag
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
                        setTagMemes(prev => ({ ...prev, [tagName]: [] })); // Set empty on error for this tag
                    })
                    .finally(() => {
                        setLoadingTagMemes(prev => ({ ...prev, [tagName]: false }));
                    });
            }
        });
    }, [popularTags, axiosInstance, tagMemes, loadingTagMemes]);

    // --- Event Handlers ---

    // Modal Handlers (Unchanged)
    const openModal = (meme) => {
        setSelectedMeme(meme);
        setIsModalOpen(true);
        recordView(meme.id);
    };
    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedMeme(null);
    };

    // Voting Handler (Unchanged - only for modal)
     const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) {
            alert("Please log in to vote.");
            return;
        }
        if (selectedMeme?.id === memeId) {
             const originalSelectedMeme = {...selectedMeme};
             setSelectedMeme(prev => ({
                 ...prev,
                 upvotes: voteType === 'upvote' ? (prev.upvotes ?? 0) + 1 : prev.upvotes,
                 downvotes: voteType === 'downvote' ? (prev.downvotes ?? 0) + 1 : prev.downvotes,
             }));
             try {
                 await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`);
             } catch (err) {
                 console.error(`Error ${voteType}ing meme:`, err);
                 alert(`Failed to record ${voteType}. Please try again.`);
                 setSelectedMeme(originalSelectedMeme);
             }
        } else {
             try {
                 await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`);
             } catch (err) {
                 console.error(`Error ${voteType}ing meme:`, err);
                 alert(`Failed to record ${voteType}. Please try again.`);
             }
        }
    }, [isAuthenticated, selectedMeme, axiosInstance]);


    // Favorite Handler (Unchanged - for Hero and Modal)
    const handleFavoriteToggle = useCallback(async (memeId) => {
        if (!isAuthenticated || loadingFavorites) return;
        const currentlyFavorite = isFavorite(memeId);
        const action = currentlyFavorite ? removeFavorite : addFavorite;
        await action(memeId);
    }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);

    // --- Search Control Handlers (Redirect to Browse Page) ---
    const handleSearchRedirect = (params) => {
        const searchParams = new URLSearchParams(params);
        navigate(`/browse?${searchParams.toString()}`);
    };

    const handleFilterChange = (newType) => {
        handleSearchRedirect({ type: newType, sort: initialSortBy });
    };

    const handleSortChange = (newSort) => {
        handleSearchRedirect({ type: initialFilterType, sort: newSort });
    };
    // No handleTagChange needed for HomePage

    // --- Render Logic ---

    // Show error only if nothing could be loaded at all
    if (error && !featuredMeme && popularTags.length === 0 && !loadingTags) {
        return <div className="error-page">{error}</div>;
    }
    // Show initial loading only if nothing is ready yet
    if (!featuredMeme && loadingTags) {
         return <div className="loading-page">Loading Memeflix...</div>;
    }


    return (
        <div className="home-page">
            {featuredMeme && (
                <HeroBanner
                    featuredMeme={featuredMeme}
                    onPlayClick={openModal}
                    onFavoriteToggle={handleFavoriteToggle}
                />
            )}

            {/* Pass showTagFilter={false} */}
            <SearchControls
                currentFilterType={initialFilterType}
                currentSortBy={initialSortBy}
                onFilterChange={handleFilterChange}
                onSortChange={handleSortChange}
                showTagFilter={false} // <-- Hide tag filter on homepage
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

            {/* Show specific error if tag loading failed but hero might have loaded */}
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