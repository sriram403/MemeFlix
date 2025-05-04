// frontend/src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MemeGrid from '../components/MemeGrid';
import MemeRow from '../components/MemeRow';
import MemeDetailModal from '../components/MemeDetailModal';
import HeroBanner from '../components/HeroBanner';
import PaginationControls from '../components/PaginationControls';
import SearchControls from '../components/SearchControls'; // Import SearchControls
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './HomePage.css';

const API_BASE_URL = 'http://localhost:3001'; // Ensure consistent base URL usage

function HomePage() {
    const [memes, setMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1 });
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [featuredMeme, setFeaturedMeme] = useState(null);
    const [popularTags, setPopularTags] = useState([]); // State for popular tags
    const [tagMemes, setTagMemes] = useState({}); // State for memes keyed by tag { tagName: [memes] }
    const [loadingTags, setLoadingTags] = useState(true); // Loading state for tags
    const [loadingTagMemes, setLoadingTagMemes] = useState({}); // Loading state per tag { tagName: boolean }

    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // --- Search & Filter State ---
    const initialSearchQuery = searchParams.get('search') || '';
    const initialFilterType = searchParams.get('type') || '';
    const initialSortBy = searchParams.get('sort') || 'newest';
    const [isSearchActive, setIsSearchActive] = useState(!!initialSearchQuery || !!initialFilterType); // Track if search/filter is active

    // --- Fetching Logic ---
    const fetchMemes = useCallback(async (page = 1, query = '', type = '', sort = 'newest') => {
        setLoading(true);
        setError(null);
        setIsSearchActive(!!query || !!type); // Update search active state

        // Update URL Search Params
        const currentParams = new URLSearchParams(searchParams);
        if (query) currentParams.set('search', query); else currentParams.delete('search');
        if (type) currentParams.set('type', type); else currentParams.delete('type');
        if (sort && sort !== 'newest') currentParams.set('sort', sort); else currentParams.delete('sort');
        if (page > 1) currentParams.set('page', page); else currentParams.delete('page');
        setSearchParams(currentParams, { replace: true });


        let url = `${API_BASE_URL}/api/memes`;
        const params = { sort }; // Add sort to general fetch too? Or only search? Let's add.

        if (query || type) { // If search query or type filter exists, use the search endpoint
            url = `${API_BASE_URL}/api/memes/search`;
            if (query) params.q = query;
            if (type) params.type = type;
            // Search endpoint currently doesn't support pagination on backend
            // We'll fetch all results and handle display limit on frontend if needed (not ideal)
        } else { // Otherwise, use the paginated endpoint
            params.page = page;
            params.limit = 12; // Or your desired limit
        }


        try {
            const response = await axiosInstance.get(url, { params });
            if (response.data) {
                setMemes(response.data.memes || []);
                // Use pagination from response if available (non-search endpoint)
                if (response.data.pagination) {
                    setPagination(response.data.pagination);
                } else {
                    // Reset pagination for search results (as it's not paginated on backend)
                    setPagination({ currentPage: 1, totalPages: 1, totalMemes: response.data.memes?.length || 0, limit: response.data.memes?.length || 12 });
                }
            } else {
                 setMemes([]);
                 setPagination({ currentPage: 1, totalPages: 1 });
            }
        } catch (err) {
            console.error("Error fetching memes:", err);
            setError(`Failed to load memes. ${err.response?.data?.error || err.message}`);
            setMemes([]);
             setPagination({ currentPage: 1, totalPages: 1 });
        } finally {
            setLoading(false);
        }
    }, [axiosInstance, setSearchParams, searchParams]);


    // Fetch Featured Meme (run once on mount)
    useEffect(() => {
        const fetchFeatured = async () => {
            try {
                // Fetch just one latest meme for the hero banner
                const response = await axiosInstance.get(`${API_BASE_URL}/api/memes`, { params: { page: 1, limit: 1 } });
                if (response.data?.memes?.length > 0) {
                    setFeaturedMeme(response.data.memes[0]);
                }
            } catch (err) {
                console.error("Error fetching featured meme:", err);
                // Don't set main page error for this, just log it.
            }
        };
        fetchFeatured();
    }, [axiosInstance]); // Empty dependency array ensures it runs only once


    // Fetch Popular Tags (run once on mount)
    useEffect(() => {
        const fetchTags = async () => {
            setLoadingTags(true);
            try {
                const response = await axiosInstance.get(`${API_BASE_URL}/api/tags/popular`, { params: { limit: 5 } }); // Fetch top 5 tags
                setPopularTags(response.data?.popularTags || []);
            } catch (err) {
                console.error("Error fetching popular tags:", err);
                setPopularTags([]); // Set empty on error
            } finally {
                setLoadingTags(false);
            }
        };
        fetchTags();
    }, [axiosInstance]);


    // Fetch Memes for each Popular Tag (triggered when popularTags changes)
    useEffect(() => {
        if (popularTags.length === 0) return;

        popularTags.forEach(tagInfo => {
            const tagName = tagInfo.tag;
            if (!tagMemes[tagName] && !loadingTagMemes[tagName]) { // Fetch only if not already fetched or loading
                setLoadingTagMemes(prev => ({ ...prev, [tagName]: true }));
                axiosInstance.get(`${API_BASE_URL}/api/memes/by-tag/${encodeURIComponent(tagName)}`, { params: { limit: 10 } }) // Fetch 10 memes per tag
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
    }, [popularTags, axiosInstance, tagMemes, loadingTagMemes]); // Dependencies ensure this runs when tags load


     // Fetch memes based on search params on initial load or when params change
    useEffect(() => {
        const page = parseInt(searchParams.get('page') || '1', 10);
        const query = searchParams.get('search') || '';
        const type = searchParams.get('type') || '';
        const sort = searchParams.get('sort') || 'newest';
        fetchMemes(page, query, type, sort);
    }, [searchParams, fetchMemes]); // Re-fetch when searchParams change


    // --- Event Handlers ---
    const handlePageChange = (newPage) => {
        const query = searchParams.get('search') || '';
        const type = searchParams.get('type') || '';
        const sort = searchParams.get('sort') || 'newest';
        fetchMemes(newPage, query, type, sort);
        window.scrollTo(0, 0); // Scroll to top on page change
    };

    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) {
            alert("Please log in to vote.");
            return;
        }
        const originalMemes = [...memes];
        let optimisticUpdate = (prevMemes) => prevMemes.map(m => {
            if (m.id === memeId) {
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
        
        setMemes(optimisticUpdate);
        if (selectedMeme?.id === memeId) setSelectedMeme(prev => ({ ...prev, upvotes: voteType === 'upvote' ? prev.upvotes + 1 : prev.upvotes, downvotes: voteType === 'downvote' ? prev.downvotes + 1 : prev.downvotes }));

        try {
            await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`);
            // Optionally re-fetch the single meme data for accuracy, but optimistic is usually fine
        } catch (err) {
            console.error(`Error ${voteType}ing meme:`, err);
            setError(`Failed to record ${voteType}. Please try again.`);
            setMemes(originalMemes); // Revert on error
             if (selectedMeme?.id === memeId) { // Revert modal state too
                const originalMemeInModal = originalMemes.find(m => m.id === memeId);
                if(originalMemeInModal) setSelectedMeme(originalMemeInModal);
             }
        }
    }, [isAuthenticated, memes, selectedMeme, axiosInstance]);


    const handleFavoriteToggle = useCallback(async (memeId) => {
        if (!isAuthenticated || loadingFavorites) return;
        const currentlyFavorite = isFavorite(memeId);
        const action = currentlyFavorite ? removeFavorite : addFavorite;
        await action(memeId);
        // No need to manually update meme state here, AuthContext handles favoriteIds
    }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);


    const openModal = (meme) => {
        setSelectedMeme(meme);
        setIsModalOpen(true);
        recordView(meme.id); // Record view when modal opens
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedMeme(null);
    };

    // --- Search Control Handlers ---
    const handleFilterChange = (newType) => {
        const query = searchParams.get('search') || '';
        const sort = searchParams.get('sort') || 'newest';
        fetchMemes(1, query, newType, sort); // Reset to page 1 on filter change
    };

    const handleSortChange = (newSort) => {
        const query = searchParams.get('search') || '';
        const type = searchParams.get('type') || '';
        fetchMemes(1, query, type, newSort); // Reset to page 1 on sort change
    };


    return (
        <div className="home-page">
            {!isSearchActive && featuredMeme && (
                <HeroBanner
                    featuredMeme={featuredMeme}
                    onPlayClick={openModal}
                    onFavoriteToggle={handleFavoriteToggle}
                />
            )}

            {/* Conditionally render SearchControls only when search is active? Or always? Let's show always */}
            <SearchControls
                currentFilterType={initialFilterType}
                currentSortBy={initialSortBy}
                onFilterChange={handleFilterChange}
                onSortChange={handleSortChange}
            />

            {/* Conditionally render Rows or Grid */}
            {isSearchActive ? (
                 <MemeGrid
                    memes={memes}
                    loading={loading}
                    error={error}
                    onMemeClick={openModal}
                    onVote={handleVote}
                    onFavoriteToggle={handleFavoriteToggle}
                 />
            ) : (
                <>
                    {/* Render rows for popular tags */}
                    {!loadingTags && popularTags.map(tagInfo => (
                        <MemeRow
                            key={tagInfo.tag}
                            title={`Popular in "${tagInfo.tag}"`}
                            memes={tagMemes[tagInfo.tag] || []}
                            isLoading={loadingTagMemes[tagInfo.tag] ?? true} // Show loading until fetched
                            onMemeClick={openModal}
                            // onVote={handleVote} // Voting only in modal? Keep consistent
                            onFavoriteToggle={handleFavoriteToggle}
                        />
                    ))}

                     {/* Optional: Fallback Grid for general memes if no tags or after tags */}
                     {/* You might want a dedicated "Browse All" grid instead of mixing */}
                     <div className="browse-all-section">
                        <h2>Browse All</h2>
                        <MemeGrid
                            memes={memes} // Show the main paginated list here
                            loading={loading} // Use the main loading state
                            error={error}   // Use the main error state
                            onMemeClick={openModal}
                            onVote={handleVote} // Allow voting here too
                            onFavoriteToggle={handleFavoriteToggle}
                        />
                         <PaginationControls
                            currentPage={pagination.currentPage}
                            totalPages={pagination.totalPages}
                            onPageChange={handlePageChange}
                        />
                     </div>
                </>
            )}

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