import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import MemeRow from '../components/MemeRow';
import MemeDetailModal from '../components/MemeDetailModal';
import HeroBanner from '../components/HeroBanner';
import MemeGrid from '../components/MemeGrid';
import SearchControls from '../components/SearchControls';

const ROW_MEME_LIMIT = 15;

function HomePage() {
    // Modal and Featured Meme State
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [featuredMeme, setFeaturedMeme] = useState(null);
    const [loadingFeatured, setLoadingFeatured] = useState(true);

    // State for Search
    const [searchResults, setSearchResults] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [filterType, setFilterType] = useState('');
    const [sortBy, setSortBy] = useState('newest');

    // State for Row Data
    const [rowsData, setRowsData] = useState({}); // Format: { tag1: [meme1, meme2], tag2: [...] }
    const [loadingRows, setLoadingRows] = useState(true);
    const [rowsError, setRowsError] = useState(null);

    // Static Row Configuration (using lowercase tags for consistency)
    const memeRowsConfig = [
        { title: 'Humor', tag: 'humor' },
        { title: 'Reactions', tag: 'reaction' },
        { title: 'Mystery', tag: 'mystery' },
        { title: 'Life', tag: 'life' },
        { title: 'Internet', tag: 'internet' },
        { title: 'Viral', tag: 'viral' },
        { title: 'Guide', tag: 'guide' },
        // Add more based on your actual data tags
    ];

    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites } = useAuth();
    const [searchParams] = useSearchParams();
    const searchTerm = searchParams.get('search') || '';

    // Fetch featured meme
    const fetchFeaturedMeme = useCallback(async () => {
        setLoadingFeatured(true);
         try {
            const response = await axiosInstance.get('/api/memes', { params: { page: 1, limit: 1 } });
            setFeaturedMeme(response.data.memes?.[0] || null);
        } catch (error) { console.error("Error fetching featured meme:", error); setFeaturedMeme(null); }
        finally { setLoadingFeatured(false); }
    }, [axiosInstance]);

    // Fetch Data for ALL Configured Rows
    const fetchAllRowData = useCallback(async () => {
        setLoadingRows(true);
        setRowsError(null);
        try {
            const rowPromises = memeRowsConfig.map(config =>
                axiosInstance.get(`/api/memes/tag/${encodeURIComponent(config.tag)}`, { params: { limit: ROW_MEME_LIMIT } })
                    .then(response => ({ tag: config.tag, memes: response.data.memes || [] }))
                    .catch(err => { // Catch individual row errors
                        console.error(`Failed to fetch row for tag "${config.tag}":`, err);
                        return { tag: config.tag, memes: [], error: true }; // Mark error for this tag
                    })
            );

            const results = await Promise.all(rowPromises); // Wait for all fetches (even if some failed)

            const newRowsData = {};
            let encounteredError = false;
            results.forEach(result => {
                if (result && result.tag) { // Ensure result structure is valid
                   newRowsData[result.tag] = result.memes;
                   if (result.error) encounteredError = true;
                }
            });

            setRowsData(newRowsData);
            if (encounteredError) setRowsError("Could not load data for one or more rows.");

        } catch (error) { // Catch errors from Promise.all itself (less likely)
            console.error("Error fetching row data:", error);
            setRowsError("Failed to load category rows."); setRowsData({});
        } finally { setLoadingRows(false); }
    }, [axiosInstance]); // Only depends on axiosInstance

    // Fetch Search Results
     const fetchSearchResults = useCallback(async () => {
        if (!searchTerm) { setSearchResults([]); setLoadingSearch(false); return; }
        setLoadingSearch(true); setSearchError(null);
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
        } finally { setLoadingSearch(false); }
    }, [searchTerm, filterType, sortBy, axiosInstance]);

    // Initial Data Fetching & Search Term Changes
    useEffect(() => {
        fetchFeaturedMeme();
        if (!searchTerm) { fetchAllRowData(); setSearchResults([]); setSearchError(null); }
        else { setRowsData({}); setRowsError(null); /* Clear rows when searching */ }
    }, [fetchFeaturedMeme, fetchAllRowData, searchTerm]);

    // Fetch search results when needed
    useEffect(() => { if (searchTerm) fetchSearchResults(); }, [fetchSearchResults]);

    // Handlers
    const handleFilterChange = (newType) => setFilterType(newType);
    const handleSortChange = (newSort) => setSortBy(newSort);
    const openModal = (meme) => { setSelectedMeme(meme); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedMeme(null); };
    const handleFavoriteToggle = useCallback(async (memeId) => { if (!isAuthenticated) { alert("Please log in."); return; } if (loadingFavorites) return; const c = isFavorite(memeId); if(c) await removeFavorite(memeId); else await addFavorite(memeId); }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);

    // --- Vote Handler - UPDATED to modify rowsData, searchResults, selectedMeme ---
     const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) { alert("Please log in to vote."); return; }

        // Keep copies for rollback
        // Note: Shallow copy might be sufficient if we replace whole meme objects
        const originalRowsData = { ...rowsData };
        const originalSearchResults = [...searchResults];
        const originalSelectedMeme = selectedMeme ? {...selectedMeme} : null;

        let wasInRows = false;
        let wasInSearchResults = false;
        let updatedMemeData = null; // Holds the updated meme data once calculated

        // Function to calculate updated meme data
        const getUpdatedMeme = (meme) => ({
            ...meme,
            upvotes: voteType === 'upvote' ? (meme.upvotes ?? 0) + 1 : (meme.upvotes ?? 0),
            downvotes: voteType === 'downvote' ? (meme.downvotes ?? 0) + 1 : (meme.downvotes ?? 0)
        });

        // --- Optimistic Update Logic ---

        // 1. Update rowsData state
        setRowsData(prevRowsData => {
            const newRowsData = {}; // Create a new object for the state
            let found = false;
            for (const tag in prevRowsData) {
                // Map over each row's meme array
                newRowsData[tag] = prevRowsData[tag].map(meme => {
                    if (meme.id === memeId) {
                        found = true;
                        updatedMemeData = getUpdatedMeme(meme); // Calculate the update
                        return updatedMemeData; // Return the new meme object
                    }
                    return meme; // Return the original meme object
                });
            }
            if (found) wasInRows = true;
            return newRowsData; // Return the new state object
        });

        // 2. Update searchResults state
        setSearchResults(prevResults => {
            let found = false;
            const newResults = prevResults.map(m => {
                 if (m.id === memeId) {
                     found = true;
                     // Use already calculated data if found in rows, otherwise calculate
                     const dataToUse = updatedMemeData || getUpdatedMeme(m);
                     updatedMemeData = dataToUse; // Ensure updatedMemeData is set
                     return dataToUse;
                 }
                 return m;
             });
             if (found) wasInSearchResults = true;
             return newResults; // Return the new array
        });


        // 3. Update selectedMeme state (if modal is open for this meme)
         if (selectedMeme && selectedMeme.id === memeId) {
             // Use already calculated data if available, otherwise calculate
             const dataToUse = updatedMemeData || getUpdatedMeme(selectedMeme);
             setSelectedMeme(dataToUse);
         }

        // --- API Request ---
        try {
            await axiosInstance.post(`/api/memes/${memeId}/${voteType}`);
            console.log(`Vote ${voteType} registered for ${memeId}`);
            // Success! Optimistic update stands.
        } catch (error) {
             // Rollback on API error
             console.error(`Error ${voteType}ing meme ${memeId}:`, error);
             alert(`Failed to register ${voteType}. Reverting changes.`);
             if (wasInRows) setRowsData(originalRowsData);
             if (wasInSearchResults) setSearchResults(originalSearchResults);
             if (originalSelectedMeme && selectedMeme && selectedMeme.id === memeId) setSelectedMeme(originalSelectedMeme);
        }
    // Dependencies updated to include rowsData for rollback/update
    }, [isAuthenticated, selectedMeme, searchResults, rowsData, axiosInstance]);


     // Format tag name helper
     const formatTagTitle = (tag) => tag.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    // Render Logic
    const showRows = !searchTerm && !loadingRows && !rowsError && Object.keys(rowsData).length > 0;
    const showSearchResults = searchTerm;

    return (
        <>
             {!searchTerm && !loadingFeatured && featuredMeme &&
                <HeroBanner featuredMeme={featuredMeme} onPlayClick={openModal} onFavoriteToggle={handleFavoriteToggle}/>
             }
             {(loadingFeatured || (loadingRows && !searchTerm) || (loadingSearch && searchTerm)) &&
                <div className="loading-row" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Loading Content...</div>
             }
             {!searchTerm && rowsError && <div className="error-message" style={{ padding: '50px 5%', textAlign: 'center' }}>{rowsError}</div>}
             {searchTerm && searchError && <div className="error-message" style={{ padding: '50px 5%', textAlign: 'center' }}>{searchError}</div>}

            {searchTerm && ( <SearchControls currentFilterType={filterType} currentSortBy={sortBy} onFilterChange={handleFilterChange} onSortChange={handleSortChange}/> )}

            {showRows && (
                <div className="meme-rows-wrapper">
                    {/* Map over config to ensure order, get data from state */}
                    {memeRowsConfig.map(config => {
                        const rowMemes = rowsData[config.tag] || [];
                        // Optionally hide row if it ended up empty after fetch/error
                        if (rowMemes.length === 0) return null;

                        return (
                            <MemeRow
                                key={config.tag}
                                title={formatTagTitle(config.tag)}
                                memes={rowMemes} // Pass data from central state
                                isLoading={false} // Loading handled above this map
                                onMemeClick={openModal}
                                onVote={handleVote} // Pass vote handler
                                onFavoriteToggle={handleFavoriteToggle}
                            />
                        );
                    })}
                </div>
            )}


            {showSearchResults && !loadingSearch && !searchError && (
                 <div className="search-results-container" style={{ padding: '0 5%' }}>
                    <h3>Search Results for "{searchTerm}"</h3>
                    <MemeGrid
                        memes={searchResults} loading={false} error={null}
                        onMemeClick={openModal} onVote={handleVote} onFavoriteToggle={handleFavoriteToggle}
                     />
                    {searchResults.length === 0 && <div className="info-message" style={{ padding: '50px 0'}}>No memes found for "{searchTerm}" matching filters.</div>}
                </div>
            )}

            {!searchTerm && !loadingRows && !rowsError && Object.keys(rowsData).length === 0 && popularTags.length === 0 && (
                 <div className="info-message" style={{ padding: '50px 0', textAlign: 'center' }}>Could not find any tags or memes.</div>
            )}

            {isModalOpen && ( <MemeDetailModal meme={selectedMeme} onClose={closeModal} onVote={handleVote} onFavoriteToggle={handleFavoriteToggle}/> )}
        </>
    );
}

export default HomePage;