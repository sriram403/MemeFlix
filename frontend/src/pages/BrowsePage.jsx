// frontend/src/pages/BrowsePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MemeGrid from '../components/MemeGrid';
import MemeDetailModal from '../components/MemeDetailModal';
import PaginationControls from '../components/PaginationControls';
import SearchControls from '../components/SearchControls';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './BrowsePage.css'; // Create this CSS file next

const API_BASE_URL = 'http://localhost:3001';

function BrowsePage() {
    const [memes, setMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, limit: 12 }); // Default limit
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView } = useAuth();
    const navigate = useNavigate(); // Keep for potential use
    const [searchParams, setSearchParams] = useSearchParams();

    // --- Get current filters/search/page from URL ---
    const getCurrentParams = useCallback(() => {
        return {
            page: parseInt(searchParams.get('page') || '1', 10),
            query: searchParams.get('search') || '',
            type: searchParams.get('type') || '',
            sort: searchParams.get('sort') || 'newest',
            tag: searchParams.get('tag') || '' // Read tag from params
        };
    }, [searchParams]);

    // --- Fetching Logic ---
    const fetchBrowseMemes = useCallback(async () => {
        setLoading(true);
        setError(null);
        const { page, query, type, sort, tag } = getCurrentParams();

        // Determine API endpoint and parameters
        let url = `${API_BASE_URL}/api/memes`;
        const params = { page: page, limit: pagination.limit, sort: sort }; // Include sort always
        let isSearchEndpoint = false;

        if (query || type || tag) { // Use search endpoint if any filter/query/tag is active
             url = `${API_BASE_URL}/api/memes/search`;
             if (query) params.q = query;
             if (type) params.type = type;
             if (tag) params.tag = tag; // Add tag to search params
             delete params.page; // Search endpoint is not paginated on backend yet
             delete params.limit;
             isSearchEndpoint = true;
        }


        try {
            const response = await axiosInstance.get(url, { params });
            if (response.data) {
                setMemes(response.data.memes || []);
                // Update pagination based on response type
                if (!isSearchEndpoint && response.data.pagination) {
                    setPagination(response.data.pagination);
                } else {
                    // For search results, create fake pagination (1 page)
                    setPagination({ currentPage: 1, totalPages: 1, totalMemes: response.data.memes?.length || 0, limit: response.data.memes?.length || pagination.limit });
                }
            } else {
                 setMemes([]);
                 setPagination({ currentPage: 1, totalPages: 1, limit: pagination.limit });
            }
        } catch (err) {
            console.error("Error fetching browse memes:", err);
            setError(`Failed to load memes. ${err.response?.data?.error || err.message}`);
            setMemes([]);
            setPagination({ currentPage: 1, totalPages: 1, limit: pagination.limit });
        } finally {
            setLoading(false);
        }
    }, [axiosInstance, pagination.limit, getCurrentParams]);


    // Fetch memes whenever searchParams change
    useEffect(() => {
        fetchBrowseMemes();
    }, [searchParams, fetchBrowseMemes]); // fetchBrowseMemes dependency includes getCurrentParams -> searchParams


    // --- Event Handlers ---
    const handlePageChange = (newPage) => {
        const currentParams = getCurrentParams();
        // Update only the page parameter
        setSearchParams(prev => {
            prev.set('page', newPage.toString());
            return prev;
        }, { replace: true });
        window.scrollTo(0, 0);
    };

    const handleFilterChange = (newType) => {
        const currentParams = getCurrentParams();
        setSearchParams(prev => {
            if (newType) prev.set('type', newType); else prev.delete('type');
            prev.delete('page'); // Reset page on filter change
            return prev;
        }, { replace: true });
    };

    const handleSortChange = (newSort) => {
        const currentParams = getCurrentParams();
         setSearchParams(prev => {
            if (newSort && newSort !== 'newest') prev.set('sort', newSort); else prev.delete('sort');
            prev.delete('page'); // Reset page on sort change
            return prev;
        }, { replace: true });
    };

     // Handle Search Submit (e.g., if search input is moved here)
     const handleSearchSubmit = (query) => {
         setSearchParams(prev => {
            if (query) prev.set('search', query); else prev.delete('search');
            prev.delete('page'); // Reset page on new search
            return prev;
        }, { replace: true });
     };

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
        if (!isAuthenticated) {
            alert("Please log in to vote.");
            return;
        }
        const originalMemes = [...memes];
        // Optimistic update for grid state
        setMemes(prevMemes => prevMemes.map(m => {
            if (m.id === memeId) {
                const currentUpvotes = m.upvotes ?? 0;
                const currentDownvotes = m.downvotes ?? 0;
                return { ...m, upvotes: voteType === 'upvote' ? currentUpvotes + 1 : currentUpvotes, downvotes: voteType === 'downvote' ? currentDownvotes + 1 : currentDownvotes };
            }
            return m;
        }));
        // Optimistic update for modal state if open
        if (selectedMeme?.id === memeId) {
             setSelectedMeme(prev => ({ ...prev, upvotes: voteType === 'upvote' ? prev.upvotes + 1 : prev.upvotes, downvotes: voteType === 'downvote' ? prev.downvotes + 1 : prev.downvotes }));
        }

        try {
            await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`);
        } catch (err) {
            console.error(`Error ${voteType}ing meme:`, err);
            setError(`Failed to record ${voteType}. Please try again.`);
            setMemes(originalMemes); // Revert grid on error
             if (selectedMeme?.id === memeId) { // Revert modal state too
                const originalMemeInModal = originalMemes.find(m => m.id === memeId);
                if(originalMemeInModal) setSelectedMeme(originalMemeInModal);
             }
        }
    }, [isAuthenticated, memes, selectedMeme, axiosInstance]);

    // Favorite Handler
    const handleFavoriteToggle = useCallback(async (memeId) => {
        if (!isAuthenticated || loadingFavorites) return;
        const currentlyFavorite = isFavorite(memeId);
        const action = currentlyFavorite ? removeFavorite : addFavorite;
        await action(memeId);
        // No direct UI update needed here, relies on isFavorite check in MemeCard/Modal
    }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);


    const { query, type, sort, tag } = getCurrentParams();
    const pageTitle = tag ? `Memes tagged "${tag}"` : query ? `Search Results for "${query}"` : "Browse All Memes";


    return (
        <div className="browse-page">
            {/* Consider adding Navbar search integration here later */}
            <h1>{pageTitle}</h1>

            <SearchControls
                currentFilterType={type}
                currentSortBy={sort}
                onFilterChange={handleFilterChange}
                onSortChange={handleSortChange}
            />

            <MemeGrid
                memes={memes}
                loading={loading}
                error={error}
                onMemeClick={openModal}
                onVote={handleVote}
                onFavoriteToggle={handleFavoriteToggle}
            />

            {/* Conditionally render pagination only if not a search result (or when search is paginated) */}
            {pagination.totalPages > 1 && (
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