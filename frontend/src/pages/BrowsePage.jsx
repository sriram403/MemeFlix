// frontend/src/pages/BrowsePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MemeGrid from '../components/MemeGrid';
import MemeDetailModal from '../components/MemeDetailModal';
import PaginationControls from '../components/PaginationControls';
import SearchControls from '../components/SearchControls';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './BrowsePage.css';

const API_BASE_URL = 'http://localhost:3001';
const DEFAULT_PAGE_LIMIT = 12; // Define a constant for the default limit

function BrowsePage() {
    // Meme & Page State
    const [memes, setMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    // Initialize pagination with the default limit
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, limit: DEFAULT_PAGE_LIMIT });

    // Tag State
    const [availableTags, setAvailableTags] = useState([]);
    const [loadingAllTags, setLoadingAllTags] = useState(true);

    // Modal State
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // Hooks & Context
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // --- Get current filters/search/page from URL ---
    const getCurrentParams = useCallback(() => {
        return {
            page: parseInt(searchParams.get('page') || '1', 10),
            query: searchParams.get('search') || '',
            type: searchParams.get('type') || '',
            sort: searchParams.get('sort') || 'newest',
            tag: searchParams.get('tag') || ''
        };
    }, [searchParams]);

    // --- Fetching Logic ---

    // Fetch All Tags (useEffect remains the same)
    useEffect(() => {
        const fetchAllTags = async () => {
            setLoadingAllTags(true);
            try {
                const response = await axiosInstance.get(`${API_BASE_URL}/api/tags/all`);
                setAvailableTags(response.data?.tags || []);
            } catch (err) {
                console.error("Error fetching all tags:", err);
                setError(prev => prev || "Could not load tag filters.");
                setAvailableTags([]);
            } finally {
                setLoadingAllTags(false);
            }
        };
        fetchAllTags();
    }, [axiosInstance]);

    // Fetch Memes based on current params
    const fetchBrowseMemes = useCallback(async () => {
        setLoading(true);
        setError(null); // Clear fetch-specific error
        const { page, query, type, sort, tag } = getCurrentParams();

        let url = `${API_BASE_URL}/api/memes`;
        const params = { sort: sort };
        let isSearchEndpoint = false;

        if (query || type || tag) {
             url = `${API_BASE_URL}/api/memes/search`;
             if (query) params.q = query;
             if (type) params.type = type;
             if (tag) params.tag = tag;
             isSearchEndpoint = true;
             // No page/limit for search yet
        } else {
            // Use paginated endpoint
            params.page = page;
            params.limit = DEFAULT_PAGE_LIMIT; // *** USE THE CONSTANT LIMIT HERE ***
        }

        try {
            const response = await axiosInstance.get(url, { params });
            if (response.data) {
                setMemes(response.data.memes || []);
                if (!isSearchEndpoint && response.data.pagination) {
                    // Ensure pagination from API uses the correct limit
                    setPagination({...response.data.pagination, limit: DEFAULT_PAGE_LIMIT});
                } else {
                    // For search results, use default limit in fake pagination
                    setPagination({
                        currentPage: 1,
                        totalPages: 1,
                        totalMemes: response.data.memes?.length || 0,
                        limit: DEFAULT_PAGE_LIMIT // *** USE CONSTANT HERE TOO ***
                    });
                }
            } else {
                 setMemes([]);
                 setPagination({ currentPage: 1, totalPages: 1, limit: DEFAULT_PAGE_LIMIT });
            }
        } catch (err) {
            console.error("Error fetching browse memes:", err);
            setError(`Failed to load memes. ${err.response?.data?.error || err.message}`);
            setMemes([]);
            setPagination({ currentPage: 1, totalPages: 1, limit: DEFAULT_PAGE_LIMIT });
        } finally {
            setLoading(false);
        }
    // *** REMOVE pagination.limit from dependency array ***
    }, [axiosInstance, getCurrentParams]);


    // Re-fetch memes whenever searchParams change
    useEffect(() => {
        fetchBrowseMemes();
    }, [searchParams, fetchBrowseMemes]);


    // --- Event Handlers (remain the same) ---
    const handlePageChange = (newPage) => {
        setSearchParams(prev => {
            prev.set('page', newPage.toString());
            return prev;
        }, { replace: true });
        window.scrollTo(0, 0);
    };

    const handleFilterChange = (newType) => {
        setSearchParams(prev => {
            if (newType) prev.set('type', newType); else prev.delete('type');
            prev.delete('page');
            return prev;
        }, { replace: true });
    };

    const handleSortChange = (newSort) => {
         setSearchParams(prev => {
            if (newSort && newSort !== 'newest') prev.set('sort', newSort); else prev.delete('sort');
            prev.delete('page');
            return prev;
        }, { replace: true });
    };

     const handleTagChange = (newTag) => {
         setSearchParams(prev => {
            if (newTag) prev.set('tag', newTag); else prev.delete('tag');
            prev.delete('page');
            return prev;
        }, { replace: true });
     };

     const handleSearchSubmit = (query) => {
         setSearchParams(prev => {
            if (query) prev.set('search', query); else prev.delete('search');
            prev.delete('page');
            return prev;
        }, { replace: true });
     };

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

    // Voting Handler (Unchanged)
    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) {
            alert("Please log in to vote.");
            return;
        }
        const originalMemes = [...memes];
        setMemes(prevMemes => prevMemes.map(m => {
            if (m.id === memeId) {
                const currentUpvotes = m.upvotes ?? 0;
                const currentDownvotes = m.downvotes ?? 0;
                return { ...m, upvotes: voteType === 'upvote' ? currentUpvotes + 1 : currentUpvotes, downvotes: voteType === 'downvote' ? currentDownvotes + 1 : currentDownvotes };
            }
            return m;
        }));
        if (selectedMeme?.id === memeId) {
             setSelectedMeme(prev => ({ ...prev, upvotes: voteType === 'upvote' ? (prev.upvotes ?? 0) + 1 : prev.upvotes, downvotes: voteType === 'downvote' ? (prev.downvotes ?? 0) + 1 : prev.downvotes }));
        }
        try {
            await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`);
        } catch (err) {
            console.error(`Error ${voteType}ing meme:`, err);
            setError(`Failed to record ${voteType}. Please try again.`);
            setMemes(originalMemes);
             if (selectedMeme?.id === memeId) {
                const originalMemeInModal = originalMemes.find(m => m.id === memeId);
                if(originalMemeInModal) setSelectedMeme(originalMemeInModal);
             }
        }
    }, [isAuthenticated, memes, selectedMeme, axiosInstance]);

    // Favorite Handler (Unchanged)
    const handleFavoriteToggle = useCallback(async (memeId) => {
        if (!isAuthenticated || loadingFavorites) return;
        const currentlyFavorite = isFavorite(memeId);
        const action = currentlyFavorite ? removeFavorite : addFavorite;
        await action(memeId);
    }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);


    // --- Render Logic ---
    const { query: currentQuery, type: currentType, sort: currentSort, tag: currentTag } = getCurrentParams();
    const pageTitle = currentTag ? `Memes tagged "${currentTag}"` : currentQuery ? `Search Results for "${currentQuery}"` : "Browse All Memes";


    return (
        <div className="browse-page">
            <h1>{pageTitle}</h1>

            <SearchControls
                currentFilterType={currentType}
                currentSortBy={currentSort}
                currentTag={currentTag}
                availableTags={availableTags}
                onFilterChange={handleFilterChange}
                onSortChange={handleSortChange}
                onTagChange={handleTagChange}
            />

            {error && !loading && <div className="error-message">{error}</div>}

            <MemeGrid
                memes={memes}
                loading={loading}
                error={null}
                onMemeClick={openModal}
                onVote={handleVote}
                onFavoriteToggle={handleFavoriteToggle}
            />

            {/* Conditionally render pagination */}
            {!(currentQuery || currentType || currentTag) && pagination.totalPages > 1 && (
                 <PaginationControls
                     currentPage={pagination.currentPage}
                     totalPages={pagination.totalPages}
                     onPageChange={handlePageChange}
                 />
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

export default BrowsePage;