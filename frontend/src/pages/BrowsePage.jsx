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

    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites, recordView, isViewed, loadingViewed } = useAuth();
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();

    // Getting current params
    const getCurrentParams = useCallback(() => {
        return {
            page: parseInt(searchParams.get('page') || '1', 10),
            query: searchParams.get('search') || '',
            type: searchParams.get('type') || '',
            sort: searchParams.get('sort') || 'newest',
            tag: searchParams.get('tag') || ''
        };
    }, [searchParams]);

    // Fetching all tags
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

    // Fetching browse memes
    const fetchBrowseMemes = useCallback(async () => {
        setLoading(true);
        //setError(null); // Keep potential tag fetch error
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
        } else {
            params.page = page;
            params.limit = DEFAULT_PAGE_LIMIT;
        }

        try {
            const response = await axiosInstance.get(url, { params });
            if (response.data) {
                setMemes(response.data.memes || []);
                if (!isSearchEndpoint && response.data.pagination) {
                    setPagination({...response.data.pagination, limit: DEFAULT_PAGE_LIMIT});
                } else {
                    setPagination({ currentPage: 1, totalPages: 1, totalMemes: response.data.memes?.length || 0, limit: DEFAULT_PAGE_LIMIT });
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
    }, [axiosInstance, getCurrentParams]); // Removed pagination.limit

    // Re-fetch memes whenever searchParams change
    useEffect(() => {
        fetchBrowseMemes();
    }, [searchParams, fetchBrowseMemes]);

    // Effect to check for 'openMemeId' after memes load
    useEffect(() => {
        if (!loading && memes.length > 0) {
            const openIdParam = searchParams.get('openMemeId');
            if (openIdParam) {
                const memeIdToOpen = parseInt(openIdParam, 10);
                const memeToOpen = memes.find(m => m.id === memeIdToOpen);

                if (memeToOpen) {
                    console.log(`Found meme ${memeIdToOpen} from URL param, opening modal.`);
                    // Ensure modal isn't already open for this ID to prevent loops
                    if (!isModalOpen || selectedMeme?.id !== memeIdToOpen) {
                        openModal(memeToOpen);
                    }
                    // Remove the param from URL
                    setSearchParams(prev => {
                        prev.delete('openMemeId');
                        return prev;
                    }, { replace: true });
                } else {
                    console.log(`Meme ID ${memeIdToOpen} from URL param not found in current results.`);
                     setSearchParams(prev => {
                        prev.delete('openMemeId');
                        return prev;
                    }, { replace: true });
                }
            }
        }
    // Depend on loading, memes, searchParams, setSearchParams, openModal, isModalOpen, selectedMeme
    }, [loading, memes, searchParams, setSearchParams, isModalOpen, selectedMeme]); // Added modal state dependencies


    // --- Event Handlers ---
    const handlePageChange = (newPage) => {
        setSearchParams(prev => { prev.set('page', newPage.toString()); return prev; }, { replace: true });
        window.scrollTo(0, 0);
    };
    const handleFilterChange = (newType) => {
        setSearchParams(prev => { if (newType) prev.set('type', newType); else prev.delete('type'); prev.delete('page'); return prev; }, { replace: true });
    };
    const handleSortChange = (newSort) => {
        setSearchParams(prev => { if (newSort && newSort !== 'newest') prev.set('sort', newSort); else prev.delete('sort'); prev.delete('page'); return prev; }, { replace: true });
    };
    const handleTagChange = (newTag) => {
        setSearchParams(prev => { if (newTag) prev.set('tag', newTag); else prev.delete('tag'); prev.delete('page'); return prev; }, { replace: true });
    };
    const handleSearchSubmit = (query) => {
        setSearchParams(prev => { if (query) prev.set('search', query); else prev.delete('search'); prev.delete('page'); return prev; }, { replace: true });
    };
    // Added useCallback to stabilize these functions passed as props or used in effects
    const openModal = useCallback((meme) => {
        setSelectedMeme(meme);
        setIsModalOpen(true);
        recordView(meme.id);
    }, [recordView]);
    const closeModal = useCallback(() => {
        setIsModalOpen(false);
        setSelectedMeme(null);
        // Also remove openMemeId param if user closes modal manually
         setSearchParams(prev => {
             prev.delete('openMemeId');
             return prev;
         }, { replace: true });
    }, [setSearchParams]);
    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) { alert("Please log in to vote."); return; }
        const originalMemes = [...memes];
        setMemes(prevMemes => prevMemes.map(m => { if (m.id === memeId) { const cu = m.upvotes ?? 0; const cd = m.downvotes ?? 0; return { ...m, upvotes: voteType === 'upvote' ? cu + 1 : cu, downvotes: voteType === 'downvote' ? cd + 1 : cd }; } return m; }));
        if (selectedMeme?.id === memeId) { setSelectedMeme(prev => ({ ...prev, upvotes: voteType === 'upvote' ? (prev.upvotes ?? 0) + 1 : prev.upvotes, downvotes: voteType === 'downvote' ? (prev.downvotes ?? 0) + 1 : prev.downvotes })); }
        try { await axiosInstance.post(`${API_BASE_URL}/api/memes/${memeId}/${voteType}`); }
        catch (err) { console.error(`Error ${voteType}ing meme:`, err); setError(`Failed to record ${voteType}.`); setMemes(originalMemes); if (selectedMeme?.id === memeId) { const originalMemeInModal = originalMemes.find(m => m.id === memeId); if(originalMemeInModal) setSelectedMeme(originalMemeInModal); } }
    }, [isAuthenticated, memes, selectedMeme, axiosInstance]);
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
                loading={loading || loadingViewed}
                error={null}
                onMemeClick={openModal}
                onVote={handleVote}
                onFavoriteToggle={handleFavoriteToggle}
                isMemeViewed={(memeId) => !loadingViewed && isViewed(memeId)}
            />
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