// frontend/src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MemeRow from '../components/MemeRow';
import MemeDetailModal from '../components/MemeDetailModal';
import HeroBanner from '../components/HeroBanner';
// import MemeGrid from '../components/MemeGrid'; // No longer needed here
// import PaginationControls from '../components/PaginationControls'; // No longer needed here
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
    const initialSearchQuery = searchParams.get('search') || '';
    const initialFilterType = searchParams.get('type') || '';
    const initialSortBy = searchParams.get('sort') || 'newest';
    // No need for isSearchActive state here anymore

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
            setError(null); // Clear previous errors
            try {
                const response = await axiosInstance.get(`${API_BASE_URL}/api/tags/popular`, { params: { limit: 7 } }); // Fetch top 7 tags
                setPopularTags(response.data?.popularTags || []);
            } catch (err) {
                console.error("Error fetching popular tags:", err);
                setError("Could not load tag categories.");
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
                        setTagMemes(prev => ({ ...prev, [tagName]: [] }));
                    })
                    .finally(() => {
                        setLoadingTagMemes(prev => ({ ...prev, [tagName]: false }));
                    });
            }
        });
    }, [popularTags, axiosInstance, tagMemes, loadingTagMemes]);

    // --- Event Handlers ---

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

    // Voting Handler (now only relevant for the modal)
     const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) {
            alert("Please log in to vote.");
            return;
        }
        // Optimistic update only for the modal state
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
                 setSelectedMeme(originalSelectedMeme); // Revert modal state on error
             }
        } else {
            // If vote comes from somewhere else (it shouldn't now), just send API call
             try {
                 await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`);
             } catch (err) {
                 console.error(`Error ${voteType}ing meme:`, err);
                 alert(`Failed to record ${voteType}. Please try again.`);
             }
        }
    }, [isAuthenticated, selectedMeme, axiosInstance]); // Only depends on modal state now


    // Favorite Handler (relevant for Hero Banner and Modal)
    const handleFavoriteToggle = useCallback(async (memeId) => {
        if (!isAuthenticated || loadingFavorites) return;
        const currentlyFavorite = isFavorite(memeId);
        const action = currentlyFavorite ? removeFavorite : addFavorite;
        const success = await action(memeId);
        // Update selectedMeme state if the favorited item is in the modal
        if (success && selectedMeme?.id === memeId) {
             // No direct state update needed, rely on isFavorite re-check
             // Force re-render slightly if needed? Usually context updates handle it.
        }
    }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite, selectedMeme?.id]);

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

    // --- Render Logic ---

    // Display general loading/error for tags
    if (loadingTags) {
        return <div className="loading-page">Loading categories...</div>; // Add a specific class if needed
    }
    if (error) {
        return <div className="error-page">{error}</div>; // Add a specific class if needed
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

            {/* Keep SearchControls, but handlers redirect */}
            <SearchControls
                currentFilterType={initialFilterType}
                currentSortBy={initialSortBy}
                onFilterChange={handleFilterChange}
                onSortChange={handleSortChange}
            />

            {/* Render rows for popular tags */}
            {popularTags.map(tagInfo => (
                <MemeRow
                    key={tagInfo.tag}
                    title={`Popular in "${tagInfo.tag}"`}
                    memes={tagMemes[tagInfo.tag] || []}
                    isLoading={loadingTagMemes[tagInfo.tag] ?? true}
                    onMemeClick={openModal}
                    onFavoriteToggle={handleFavoriteToggle}
                    // Voting is handled only within the modal now
                />
            ))}

            {/* No Browse All Grid or Pagination Here Anymore */}

            {isModalOpen && selectedMeme && (
                <MemeDetailModal
                    meme={selectedMeme}
                    onClose={closeModal}
                    onVote={handleVote} // Pass vote handler to modal
                    onFavoriteToggle={handleFavoriteToggle} // Pass fav handler to modal
                />
            )}
        </div>
    );
}

export default HomePage;