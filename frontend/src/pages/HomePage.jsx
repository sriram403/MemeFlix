import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import MemeRow from '../components/MemeRow';
import MemeDetailModal from '../components/MemeDetailModal';
import HeroBanner from '../components/HeroBanner';
import MemeGrid from '../components/MemeGrid'; // Need MemeGrid for search results
import SearchControls from '../components/SearchControls'; // Import SearchControls

const ROW_MEME_LIMIT = 15;

function HomePage() {
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [featuredMeme, setFeaturedMeme] = useState(null);
    const [loadingFeatured, setLoadingFeatured] = useState(true);
    const [popularTags, setPopularTags] = useState([]);
    const [loadingTags, setLoadingTags] = useState(true);
    const [rowError, setRowError] = useState(null);
    const [searchResults, setSearchResults] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [filterType, setFilterType] = useState('');
    const [sortBy, setSortBy] = useState('newest');

    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites } = useAuth();
    const [searchParams] = useSearchParams();
    const searchTerm = searchParams.get('search') || '';

    // Fetch featured meme
    const fetchFeaturedMeme = useCallback(async () => {
        setLoadingFeatured(true);
         try {
            const response = await axiosInstance.get('/api/memes', { params: { page: 1, limit: 1 } });
            setFeaturedMeme(response.data.memes && response.data.memes.length > 0 ? response.data.memes[0] : null);
        } catch (error) {
            console.error("Error fetching featured meme:", error);
            setFeaturedMeme(null);
        } finally {
            setLoadingFeatured(false);
        }
    }, [axiosInstance]);

    // Fetch Popular Tags
    const fetchPopularTags = useCallback(async () => {
        setLoadingTags(true);
        setRowError(null);
        try {
            const response = await axiosInstance.get('/api/tags/popular', { params: { limit: 8 } });
            setPopularTags(response.data.popularTags || []);
        } catch (error) {
            console.error("Error fetching popular tags:", error);
            setRowError("Could not load categories.");
            setPopularTags([]);
        } finally {
            setLoadingTags(false);
        }
    }, [axiosInstance]);

     // Fetch Search Results
     const fetchSearchResults = useCallback(async () => {
        if (!searchTerm) { setSearchResults([]); setLoadingSearch(false); return; }
        setLoadingSearch(true);
        setSearchError(null);
        try {
            const params = { q: searchTerm };
            if (filterType) params.type = filterType;
            if (sortBy) params.sort = sortBy;
            const response = await axiosInstance.get(`/api/memes/search`, { params });
            setSearchResults(response.data.memes || []);
        } catch (error) {
            console.error("Error fetching search results:", error);
            setSearchError(`Failed to search for "${searchTerm}".`);
            setSearchResults([]);
        } finally {
            setLoadingSearch(false);
        }
    }, [searchTerm, filterType, sortBy, axiosInstance]);

    // Combined initial fetch logic & search term change logic
    useEffect(() => {
        fetchFeaturedMeme();
        if (!searchTerm) {
            fetchPopularTags();
            setSearchResults([]); // Clear search results when search term is removed
            setSearchError(null); // Clear search error
        }
    }, [fetchFeaturedMeme, fetchPopularTags, searchTerm]);

    // Fetch search results when relevant state changes
    useEffect(() => {
        if (searchTerm) {
            fetchSearchResults();
        }
    }, [fetchSearchResults]); // fetchSearchResults depends on term, filter, sort

    // --- Handlers for Filter/Sort Changes ---
    const handleFilterChange = (newType) => { setFilterType(newType); };
    const handleSortChange = (newSort) => { setSortBy(newSort); };

    // --- Modal Handlers ---
    const openModal = (meme) => { setSelectedMeme(meme); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedMeme(null); };

    // --- Vote Handler (updates Modal and Search Results optimistically) ---
     const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) { alert("Please log in to vote."); return; }

        const originalSearchResults = [...searchResults];
        const originalSelectedMeme = selectedMeme ? {...selectedMeme} : null;
        let wasInSearchResults = false;
        let updatedMemeData = null;

         setSearchResults(prevResults => prevResults.map(m => {
             if (m.id === memeId) {
                 wasInSearchResults = true;
                 updatedMemeData = { ...m, upvotes: voteType === 'upvote' ? (m.upvotes ?? 0) + 1 : m.upvotes, downvotes: voteType === 'downvote' ? (m.downvotes ?? 0) + 1 : m.downvotes };
                 if (selectedMeme && selectedMeme.id === memeId) setSelectedMeme(updatedMemeData);
                 return updatedMemeData;
             } return m;
         }));

         if (!wasInSearchResults && selectedMeme && selectedMeme.id === memeId) {
            updatedMemeData = { ...selectedMeme, upvotes: voteType === 'upvote' ? (selectedMeme.upvotes ?? 0) + 1 : selectedMeme.upvotes, downvotes: voteType === 'downvote' ? (selectedMeme.downvotes ?? 0) + 1 : selectedMeme.downvotes };
             setSelectedMeme(updatedMemeData);
         }

        try {
            await axiosInstance.post(`/api/memes/${memeId}/${voteType}`);
            console.log(`Vote ${voteType} registered for ${memeId}`);
        } catch (error) {
             console.error(`Error ${voteType}ing meme ${memeId}:`, error);
             alert(`Failed to register ${voteType}. Reverting changes.`);
             if (wasInSearchResults) setSearchResults(originalSearchResults);
             if (originalSelectedMeme && selectedMeme && selectedMeme.id === memeId) setSelectedMeme(originalSelectedMeme);
        }
    }, [isAuthenticated, selectedMeme, searchResults, axiosInstance]); // Dependencies correct

    // --- Favorite Toggle Handler ---
     const handleFavoriteToggle = useCallback(async (memeId) => {
         if (!isAuthenticated) { alert("Please log in."); return; }
         if (loadingFavorites) return;
         const currentlyFavorite = isFavorite(memeId);
         if (currentlyFavorite) { await removeFavorite(memeId); } else { await addFavorite(memeId); }
     }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]); // Dependencies correct

     // --- Format tag name helper ---
     const formatTagTitle = (tag) => tag.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    // --- Render Logic ---
    const showRows = !searchTerm && !loadingTags && !rowError && popularTags.length > 0;
    const showSearchResults = searchTerm;

    return (
        <>
             {/* Render Hero Banner only if NOT searching */}
             {!searchTerm && !loadingFeatured && featuredMeme &&
                <HeroBanner
                    featuredMeme={featuredMeme}
                    onPlayClick={openModal}
                    onFavoriteToggle={handleFavoriteToggle}
                />
             }
             {/* Combined Loading Indicator */}
             {(loadingFeatured || (loadingTags && !searchTerm) || (loadingSearch && searchTerm)) &&
                <div className="loading-row" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Loading Content...</div>
             }
             {/* Specific Error Messages */}
             {!searchTerm && rowError && <div className="error-message" style={{ padding: '50px 5%', textAlign: 'center' }}>{rowError}</div>}
             {searchTerm && searchError && <div className="error-message" style={{ padding: '50px 5%', textAlign: 'center' }}>{searchError}</div>}

            {/* Render Search Controls only when searching */}
            {searchTerm && (
                <SearchControls
                    currentFilterType={filterType}
                    currentSortBy={sortBy}
                    onFilterChange={handleFilterChange}
                    onSortChange={handleSortChange}
                />
            )}

            {/* Render Rows only when NOT searching */}
            {showRows && (
                <div className="meme-rows-wrapper">
                    {popularTags.map(tagInfo => (
                        <MemeRow
                            key={tagInfo.tag}
                            title={formatTagTitle(tagInfo.tag)}
                            tag={tagInfo.tag}
                            onMemeClick={openModal}
                            // onVote prop REMOVED
                            onFavoriteToggle={handleFavoriteToggle}
                        />
                    ))}
                </div>
            )}

            {/* Render Search Results Grid only when searching */}
            {showSearchResults && !loadingSearch && !searchError && (
                 <div className="search-results-container" style={{ padding: '0 5%' }}>
                    <h3>Search Results for "{searchTerm}"</h3>
                    <MemeGrid
                        memes={searchResults}
                        loading={false} // We handle loading above
                        error={null}    // We handle error above
                        onMemeClick={openModal}
                        onVote={handleVote} // Pass vote handler HERE
                        onFavoriteToggle={handleFavoriteToggle}
                     />
                    {/* Message if search yields no results */}
                    {searchResults.length === 0 && <div className="info-message" style={{ padding: '50px 0'}}>No memes found for "{searchTerm}" matching your filters.</div>}
                </div>
            )}

            {/* Message if no tags found AND not searching */}
            {!searchTerm && !loadingTags && !rowError && popularTags.length === 0 && (
                 <div className="info-message" style={{ padding: '50px 0', textAlign: 'center' }}>Could not find any popular tags to display rows.</div>
            )}

            {/* Modal rendering: pass onVote handler */}
            {isModalOpen && (
                <MemeDetailModal
                    meme={selectedMeme}
                    onClose={closeModal}
                    onVote={handleVote}
                    onFavoriteToggle={handleFavoriteToggle}
                />
            )}
        </>
    );
}

export default HomePage;