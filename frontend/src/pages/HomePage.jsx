// frontend/src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback } from 'react'; // Keep this one at the top
import { useSearchParams } from 'react-router-dom';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import MemeRow from '../components/MemeRow';
import MemeDetailModal from '../components/MemeDetailModal';
import HeroBanner from '../components/HeroBanner';
import MemeGrid from '../components/MemeGrid';
import SearchControls from '../components/SearchControls';

const API_BASE_URL = 'http://localhost:3001'; // Needed for search URL build? Maybe not if axiosInstance base is set
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

    const fetchFeaturedMeme = useCallback(async () => {
        setLoadingFeatured(true);
         try {
            const response = await axiosInstance.get('/api/memes', { params: { page: 1, limit: 1 } });
            setFeaturedMeme(response.data.memes && response.data.memes.length > 0 ? response.data.memes[0] : null);
        } catch (error) { console.error("Error fetching featured meme:", error); setFeaturedMeme(null); }
        finally { setLoadingFeatured(false); }
    }, [axiosInstance]);

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

     const fetchSearchResults = useCallback(async () => {
        if (!searchTerm) { setSearchResults([]); setLoadingSearch(false); return; }
        setLoadingSearch(true);
        setSearchError(null);
        try {
            const params = { q: searchTerm };
            if (filterType) params.type = filterType;
            if (sortBy) params.sort = sortBy; // Always send sort? Default is handled backend
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

    useEffect(() => {
        fetchFeaturedMeme();
        if (!searchTerm) fetchPopularTags();
    }, [fetchFeaturedMeme, fetchPopularTags, searchTerm]);

    useEffect(() => { fetchSearchResults(); }, [fetchSearchResults]);

    const handleFilterChange = (newType) => { setFilterType(newType); };
    const handleSortChange = (newSort) => { setSortBy(newSort); };

    const openModal = (meme) => { setSelectedMeme(meme); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedMeme(null); };

    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) { alert("Please log in to vote."); return; }
        const originalSearchResults = [...searchResults]; // Keep copy for rollback
        let updatedMemeData = null;
         // Optimistic update for search results
         setSearchResults(prev => prev.map(m => {
             if (m.id === memeId) {
                 updatedMemeData = { ...m, upvotes: voteType === 'upvote' ? (m.upvotes ?? 0) + 1 : m.upvotes, downvotes: voteType === 'downvote' ? (m.downvotes ?? 0) + 1 : m.downvotes };
                 if (selectedMeme && selectedMeme.id === memeId) setSelectedMeme(updatedMemeData);
                 return updatedMemeData;
             }
             return m;
         }));
        // We might also need to update the `popularTags` state if the vote affects sorting by score? No, keep it simple.
        try {
            await axiosInstance.post(`/api/memes/${memeId}/${voteType}`);
        } catch (error) {
             console.error(`Error ${voteType}ing meme ${memeId}:`, error);
             alert(`Failed to register ${voteType}.`);
             setSearchResults(originalSearchResults); // Rollback search results
             // Also rollback modal state if needed
             if(updatedMemeData && selectedMeme && selectedMeme.id === memeId) {
                const originalMeme = originalSearchResults.find(m => m.id === memeId);
                if (originalMeme) setSelectedMeme(originalMeme);
             }
        }
    }, [isAuthenticated, selectedMeme, searchResults, axiosInstance]); // Added searchResults dependency

    const handleFavoriteToggle = useCallback(async (memeId) => {
         if (!isAuthenticated) { alert("Please log in."); return; }
         if (loadingFavorites) return;
         const currentlyFavorite = isFavorite(memeId);
         if (currentlyFavorite) { await removeFavorite(memeId); } else { await addFavorite(memeId); }
     }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);

     const formatTagTitle = (tag) => tag.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    const showRows = !searchTerm && !loadingTags && !rowError && popularTags.length > 0;
    const showSearchResults = searchTerm;

    return (
        <>
             {!searchTerm && !loadingFeatured && featuredMeme &&
                <HeroBanner featuredMeme={featuredMeme} onPlayClick={openModal} onFavoriteToggle={handleFavoriteToggle}/>
             }
             {(loadingFeatured || (loadingTags && !searchTerm)) && <div className="loading-row">Loading Content...</div>}
             {!searchTerm && rowError && <div className="error-message">{rowError}</div>}

            {searchTerm && (
                <SearchControls
                    currentFilterType={filterType}
                    currentSortBy={sortBy}
                    onFilterChange={handleFilterChange}
                    onSortChange={handleSortChange}
                />
            )}

            {showRows && (
                <div className="meme-rows-wrapper">
                    {popularTags.map(tagInfo => (
                        <MemeRow key={tagInfo.tag} title={formatTagTitle(tagInfo.tag)} tag={tagInfo.tag} onMemeClick={openModal} onVote={handleVote} onFavoriteToggle={handleFavoriteToggle}/>
                    ))}
                    {/* <MemeRow key="more-memes" title="More Memes" fetchUrl={`/api/memes?page=1&limit=15`} onMemeClick={openModal} onVote={handleVote} onFavoriteToggle={handleFavoriteToggle} /> */}
                </div>
            )}

            {showSearchResults && (
                 <div className="search-results-container" style={{ padding: '0 5%' }}>
                    <h3>Search Results for "{searchTerm}"</h3>
                    <MemeGrid memes={searchResults} loading={loadingSearch} error={searchError} onMemeClick={openModal} onVote={handleVote} onFavoriteToggle={handleFavoriteToggle} />
                </div>
            )}

            {!searchTerm && !loadingTags && !rowError && popularTags.length === 0 && (
                 <div className="info-message">Could not find any popular tags.</div>
            )}

            {isModalOpen && ( <MemeDetailModal meme={selectedMeme} onClose={closeModal} onVote={handleVote} onFavoriteToggle={handleFavoriteToggle}/> )}
        </>
    );
}

export default HomePage;
// REMOVED duplicate import from here