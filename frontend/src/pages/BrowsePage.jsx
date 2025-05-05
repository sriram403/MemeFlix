// frontend/src/pages/BrowsePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import MemeGrid from '../components/MemeGrid';
import MemeDetailModal from '../components/MemeDetailModal';
import PaginationControls from '../components/PaginationControls';
import SearchControls from '../components/SearchControls';
import Spinner from '../components/Spinner';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import './BrowsePage.css';

const API_BASE_URL = 'http://localhost:3001';
const DEFAULT_PAGE_LIMIT = 12;

function BrowsePage() {
    const [memes, setMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [pagination, setPagination] = useState({ currentPage: 1, totalPages: 1, limit: DEFAULT_PAGE_LIMIT });
    const [availableTags, setAvailableTags] = useState([]);
    const [loadingAllTags, setLoadingAllTags] = useState(true);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    // *** REMOVE submitVote, getUserVoteStatus from context destructuring ***
    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Getting current params (Unchanged)
    const getCurrentParams = useCallback(() => { return { page: parseInt(searchParams.get('page') || '1', 10), query: searchParams.get('search') || '', type: searchParams.get('type') || '', sort: searchParams.get('sort') || 'newest', tag: searchParams.get('tag') || '' }; }, [searchParams]);
    // Fetching all tags (Unchanged)
    useEffect(() => { const fetchAllTags = async () => { setLoadingAllTags(true); try { const response = await axiosInstance.get(`${API_BASE_URL}/api/tags/all`); setAvailableTags(response.data?.tags || []); } catch (err) { console.error("Error fetching all tags:", err); setError(prev => prev || "Could not load tag filters."); setAvailableTags([]); } finally { setLoadingAllTags(false); } }; fetchAllTags(); }, [axiosInstance]);
    // Fetching browse memes (Unchanged)
    const fetchBrowseMemes = useCallback(async () => { setLoading(true); setError(null); const { page, query, type, sort, tag } = getCurrentParams(); let url; const params = { page: page, limit: DEFAULT_PAGE_LIMIT, sort: sort }; let isSearchActive = false; if (query || type || tag) { url = `${API_BASE_URL}/api/memes/search`; if (query) params.q = query; if (type) params.type = type; if (tag) params.tag = tag; isSearchActive = true; } else { url = `${API_BASE_URL}/api/memes`; } try { const response = await axiosInstance.get(url, { params }); if (response.data) { setMemes(response.data.memes || []); if (response.data.pagination) { setPagination({...response.data.pagination, limit: DEFAULT_PAGE_LIMIT}); } else { console.warn("Pagination data missing from API response:", url); setPagination({ currentPage: 1, totalPages: 1, totalMemes: response.data.memes?.length || 0, limit: DEFAULT_PAGE_LIMIT }); } } else { setMemes([]); setPagination({ currentPage: 1, totalPages: 1, limit: DEFAULT_PAGE_LIMIT }); } } catch (err) { console.error("Error fetching browse memes:", err); setError(`Failed to load memes. ${err.response?.data?.error || err.message}`); setMemes([]); setPagination({ currentPage: 1, totalPages: 1, limit: DEFAULT_PAGE_LIMIT }); } finally { setLoading(false); } }, [axiosInstance, getCurrentParams]);
    // Re-fetch memes whenever searchParams change (Unchanged)
    useEffect(() => { fetchBrowseMemes(); }, [searchParams, fetchBrowseMemes]);
    // Define Modal Handlers BEFORE the effect that uses them (Unchanged)
    const openModal = useCallback((meme) => { setSelectedMeme(meme); setIsModalOpen(true); recordView(meme.id); }, [recordView]);
    const closeModal = useCallback(() => { setIsModalOpen(false); setSelectedMeme(null); setSearchParams(prev => { prev.delete('openMemeId'); return prev; }, { replace: true }); }, [setSearchParams]);
    // Effect to check for 'openMemeId' after memes load (Unchanged)
    useEffect(() => { if (!loading && memes.length > 0) { const openIdParam = searchParams.get('openMemeId'); if (openIdParam) { const memeIdToOpen = parseInt(openIdParam, 10); const memeToOpen = memes.find(m => m.id === memeIdToOpen); if (memeToOpen) { if (!isModalOpen || selectedMeme?.id !== memeIdToOpen) { openModal(memeToOpen); } setSearchParams(prev => { prev.delete('openMemeId'); return prev; }, { replace: true }); } else { setSearchParams(prev => { prev.delete('openMemeId'); return prev; }, { replace: true }); } } } }, [loading, memes, searchParams, setSearchParams, openModal, isModalOpen, selectedMeme?.id]);

    // --- Other Event Handlers ---
    const handlePageChange = (newPage) => { setSearchParams(prev => { prev.set('page', newPage.toString()); return prev; }, { replace: true }); window.scrollTo(0, 0); };
    const handleFilterChange = (newType) => { setSearchParams(prev => { if (newType) prev.set('type', newType); else prev.delete('type'); prev.set('page', '1'); return prev; }, { replace: true }); };
    const handleSortChange = (newSort) => { setSearchParams(prev => { if (newSort && newSort !== 'newest') prev.set('sort', newSort); else prev.delete('sort'); prev.set('page', '1'); return prev; }, { replace: true }); };
    const handleTagChange = (newTag) => { setSearchParams(prev => { if (newTag) prev.set('tag', newTag); else prev.delete('tag'); prev.set('page', '1'); return prev; }, { replace: true }); };
    const handleSearchSubmit = (query) => { setSearchParams(prev => { if (query) prev.set('search', query); else prev.delete('search'); prev.set('page', '1'); return prev; }, { replace: true }); };

    // *** UPDATED handleVote to call API directly ***
    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) {
            alert("Please log in to vote.");
            return;
        }
        setError(null);

        // Store original states
        const originalMemes = [...memes];
        const originalSelectedMeme = selectedMeme ? {...selectedMeme} : null;

        // --- Optimistic UI Update for Counts ---
        const memeToUpdate = originalMemes.find(m => m.id === memeId);
        const currentVoteStatus = memeToUpdate?.user_vote_status || selectedMeme?.user_vote_status || 0; // Use data from list or modal
        const voteChange = voteType === 'upvote' ? 1 : -1;
        let upvoteIncrement = 0;
        let downvoteIncrement = 0;
        let nextVoteStatus = 0; // Calculate next status for optimistic update

        if (currentVoteStatus === voteChange) { // Removing vote
            if(voteType === 'upvote') upvoteIncrement = -1; else downvoteIncrement = -1;
            nextVoteStatus = 0;
        } else if (currentVoteStatus === -voteChange) { // Changing vote
             if(voteType === 'upvote') { upvoteIncrement = 1; downvoteIncrement = -1; }
             else { upvoteIncrement = -1; downvoteIncrement = 1; }
             nextVoteStatus = voteChange;
        } else { // Adding new vote
             if(voteType === 'upvote') upvoteIncrement = 1; else downvoteIncrement = 1;
             nextVoteStatus = voteChange;
        }

        // 1. Update the main 'memes' list state
        setMemes(prevMemes => prevMemes.map(m => {
            if (m.id === memeId) {
                return { ...m, upvotes: (m.upvotes ?? 0) + upvoteIncrement, downvotes: (m.downvotes ?? 0) + downvoteIncrement, user_vote_status: nextVoteStatus };
            } return m;
        }));

        // 2. Update the 'selectedMeme' state if the voted meme is open in the modal
        if (selectedMeme?.id === memeId) {
             setSelectedMeme(prev => {
                 if (!prev) return null;
                 return { ...prev, upvotes: (prev.upvotes ?? 0) + upvoteIncrement, downvotes: (prev.downvotes ?? 0) + downvoteIncrement, user_vote_status: nextVoteStatus };
             });
        }
        // --- End Optimistic UI Update ---

        // --- Direct API Call ---
        try {
            await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`);
            // Success
        } catch (err) {
            console.error(`Error ${voteType}ing meme:`, err);
            setError(err.response?.data?.error || `Failed to record ${voteType}.`);
            // Revert UI
            setMemes(originalMemes);
            if (originalSelectedMeme && selectedMeme?.id === memeId) {
                 setSelectedMeme(originalSelectedMeme);
            }
        }
    }, [isAuthenticated, memes, selectedMeme]); // Removed context vote functions

    const handleFavoriteToggle = useCallback(async (memeId) => { if (!isAuthenticated || loadingFavorites) return; const currentlyFavorite = isFavorite(memeId); const action = currentlyFavorite ? removeFavorite : addFavorite; await action(memeId); }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);

    // Render Logic
    const { query: currentQuery, type: currentType, sort: currentSort, tag: currentTag } = getCurrentParams();
    const pageTitle = currentTag ? `Memes tagged "${currentTag}"` : currentQuery ? `Search Results for "${currentQuery}"` : "Browse All Memes";
    const isGridLoading = loading || loadingAllTags;

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
                tagDropdownDisabled={loadingAllTags}
            />
             {isGridLoading && <Spinner size="large" message="Loading..." />}
             {!isGridLoading && error && <div className="error-message" role="alert">{error}</div>}
             {!isGridLoading && (
                 <MemeGrid
                    loading={false}
                    memes={memes}
                    error={null}
                    onMemeClick={openModal}
                    onVote={handleVote} // Pass updated handler
                    onFavoriteToggle={handleFavoriteToggle}
                    // Pass the meme data itself for the check
                    isMemeViewedCheck={(memeData) => isViewed(memeData.id, memeData)}
                />
             )}
            {pagination.totalPages > 1 && !isGridLoading && (
                 <PaginationControls
                     currentPage={pagination.currentPage}
                     totalPages={pagination.totalPages}
                     onPageChange={handlePageChange}
                 />
             )}
            {isModalOpen && selectedMeme && (
                <MemeDetailModal
                    meme={selectedMeme} // Pass updated modal meme state
                    onClose={closeModal}
                    onVote={handleVote} // Pass updated handler
                    onFavoriteToggle={handleFavoriteToggle}
                    // No need to pass getUserVoteStatus
                />
            )}
        </div>
    );
}

export default BrowsePage;