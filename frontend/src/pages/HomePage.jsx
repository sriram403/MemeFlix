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
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [featuredMeme, setFeaturedMeme] = useState(null);
    const [loadingFeatured, setLoadingFeatured] = useState(true);
    const [loadingRows, setLoadingRows] = useState(true);
    const [rowsError, setRowsError] = useState(null);
    const [rowsData, setRowsData] = useState({});
    const [searchResults, setSearchResults] = useState([]);
    const [loadingSearch, setLoadingSearch] = useState(false);
    const [searchError, setSearchError] = useState(null);
    const [filterType, setFilterType] = useState('');
    const [sortBy, setSortBy] = useState('newest');

    const memeRowsConfig = [
        { title: 'Humor', tag: 'humor' }, { title: 'Reactions', tag: 'reaction' },
        { title: 'Mystery', tag: 'mystery' }, { title: 'Life', tag: 'life' },
        { title: 'Internet', tag: 'internet' }, { title: 'Viral', tag: 'viral' },
        { title: 'Guide', tag: 'guide' },
    ];

    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites } = useAuth();
    const [searchParams] = useSearchParams();
    const searchTerm = searchParams.get('search') || '';

    const fetchFeaturedMeme = useCallback(async () => {
        setLoadingFeatured(true);
         try {
            const response = await axiosInstance.get('/api/memes', { params: { page: 1, limit: 1 } });
            setFeaturedMeme(response.data.memes?.[0] || null);
        } catch (error) { console.error("Error fetching featured meme:", error); setFeaturedMeme(null); }
        finally { setLoadingFeatured(false); }
    }, [axiosInstance]);

    const fetchAllRowData = useCallback(async () => {
        setLoadingRows(true);
        setRowsError(null);
        try {
            const rowPromises = memeRowsConfig.map(config =>
                axiosInstance.get(`/api/memes/tag/${encodeURIComponent(config.tag)}`, { params: { limit: ROW_MEME_LIMIT } })
                    .then(response => ({ tag: config.tag, memes: response.data.memes || [] }))
                    .catch(err => {
                        // *** CORRECTED CATCH BLOCK ***
                        console.error(`Failed to fetch row for tag "${config.tag}":`, err.message || err);
                        return { tag: config.tag, memes: [], error: true }; // Mark error
                        // *** END CORRECTION ***
                    })
            );
            const results = await Promise.all(rowPromises);
            const newRowsData = {};
            let encounteredError = false;
            results.forEach((result, index) => {
                const currentTag = memeRowsConfig[index]?.tag || 'unknown'; // Get tag even if result is malformed
                if (result && result.tag) {
                   newRowsData[result.tag] = result.memes;
                   if (result.error) encounteredError = true;
                } else { // Handle case where promise might have rejected entirely before .then/.catch
                    encounteredError = true;
                    newRowsData[currentTag] = []; // Ensure tag key exists with empty array
                    console.error(`Malformed result or promise rejection for tag index ${index} (${currentTag})`);
                }
            });
            setRowsData(newRowsData);
            if (encounteredError) setRowsError("Could not load data for one or more rows.");

        } catch (error) {
            console.error("Error fetching row data:", error);
            setRowsError("Failed to load category rows."); setRowsData({});
        } finally { setLoadingRows(false); }
    }, [axiosInstance]); // Removed memeRowsConfig dependency

     const fetchSearchResults = useCallback(async () => {
        if (!searchTerm) { setSearchResults([]); setLoadingSearch(false); return; }
        setLoadingSearch(true); setSearchError(null);
        try {
            const params = { q: searchTerm };
            if (filterType) params.type = filterType;
            if (sortBy) params.sort = sortBy;
            const response = await axiosInstance.get(`/api/memes/search`, { params });
            setSearchResults(response.data.memes || []);
        } catch (error) { console.error("Error fetching search results:", error); setSearchError(`Failed to search.`); setSearchResults([]); }
        finally { setLoadingSearch(false); }
    }, [searchTerm, filterType, sortBy, axiosInstance]);

    useEffect(() => {
        fetchFeaturedMeme();
        if (!searchTerm) { fetchAllRowData(); setSearchResults([]); setSearchError(null); }
        else { setRowsData({}); setRowsError(null); }
    }, [fetchFeaturedMeme, fetchAllRowData, searchTerm]);

    useEffect(() => { if (searchTerm) fetchSearchResults(); }, [fetchSearchResults]);

    const handleFilterChange = (newType) => setFilterType(newType);
    const handleSortChange = (newSort) => setSortBy(newSort);
    const openModal = (meme) => { setSelectedMeme(meme); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedMeme(null); };
    const handleFavoriteToggle = useCallback(async (memeId) => { if (!isAuthenticated) { alert("Please log in."); return; } if (loadingFavorites) return; const c = isFavorite(memeId); if(c) await removeFavorite(memeId); else await addFavorite(memeId); }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);
    const handleVote = useCallback(async (memeId, voteType) => {
        if (!isAuthenticated) { alert("Please log in to vote."); return; }
        const originalRowsData = { ...rowsData }; const originalSearchResults = [...searchResults]; const originalSelectedMeme = selectedMeme ? {...selectedMeme} : null;
        let wasInRows = false; let wasInSearchResults = false; let updatedMemeData = null;
        const getUpdatedMeme = (meme) => ({ ...meme, upvotes: voteType === 'upvote' ? (meme.upvotes ?? 0) + 1 : (meme.upvotes ?? 0), downvotes: voteType === 'downvote' ? (meme.downvotes ?? 0) + 1 : (meme.downvotes ?? 0) });

        setRowsData(prevRowsData => { const d = {...prevRowsData}; let f = false; for (const t in d) { d[t] = d[t].map(m => { if (m.id === memeId) { f = true; updatedMemeData = getUpdatedMeme(m); return updatedMemeData; } return m; }); } if (f) wasInRows = true; return d; });
        setSearchResults(prevResults => { let f = false; const r = prevResults.map(m => { if (m.id === memeId) { f = true; const u = updatedMemeData || getUpdatedMeme(m); updatedMemeData = u; return u; } return m; }); if (f) wasInSearchResults = true; return r; });
        if (selectedMeme && selectedMeme.id === memeId) { const u = updatedMemeData || getUpdatedMeme(selectedMeme); setSelectedMeme(u); }

        try { await axiosInstance.post(`/api/memes/${memeId}/${voteType}`); console.log(`Vote ${voteType} registered for ${memeId}`); }
        catch (error) { console.error(`Error ${voteType}ing meme ${memeId}:`, error); alert(`Failed vote.`); if (wasInRows) setRowsData(originalRowsData); if (wasInSearchResults) setSearchResults(originalSearchResults); if (originalSelectedMeme && selectedMeme?.id === memeId) setSelectedMeme(originalSelectedMeme); }
    }, [isAuthenticated, selectedMeme, searchResults, rowsData, axiosInstance]);

     const formatTagTitle = (tag) => tag.split(/[-_]/).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

    const showRows = !searchTerm && !loadingRows && !rowsError && Object.keys(rowsData).length > 0;
    const showSearchResults = searchTerm;
    const showNoTagsMessage = !searchTerm && !loadingRows && !rowsError && Object.keys(rowsData).length === 0;

    return (
        <>
             {!searchTerm && !loadingFeatured && featuredMeme && <HeroBanner featuredMeme={featuredMeme} onPlayClick={openModal} onFavoriteToggle={handleFavoriteToggle}/>}
             {(loadingFeatured || (loadingRows && !searchTerm) || (loadingSearch && searchTerm)) && <div className="loading-row" style={{ minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-secondary)' }}>Loading Content...</div>}
             {!searchTerm && rowsError && <div className="error-message" style={{ padding: '50px 5%', textAlign: 'center' }}>{rowsError}</div>}
             {searchTerm && searchError && <div className="error-message" style={{ padding: '50px 5%', textAlign: 'center' }}>{searchError}</div>}

            {searchTerm && ( <SearchControls currentFilterType={filterType} currentSortBy={sortBy} onFilterChange={handleFilterChange} onSortChange={handleSortChange}/> )}

            {showRows && (
                <div className="meme-rows-wrapper">
                    {memeRowsConfig.map(config => {
                        const rowMemes = rowsData[config.tag] || [];
                        // Render row only if currently loading OR if loading is done and it has memes
                        if (loadingRows || rowMemes.length > 0) {
                           return ( <MemeRow key={config.tag} title={formatTagTitle(config.tag)} memes={rowMemes} isLoading={loadingRows} onMemeClick={openModal} onFavoriteToggle={handleFavoriteToggle} /> );
                        }
                        return null; // Don't render empty rows after loading
                    })}
                </div>
            )}

            {showSearchResults && !loadingSearch && !searchError && (
                 <div className="search-results-container" style={{ padding: '0 5%' }}>
                    <h3>Search Results for "{searchTerm}"</h3>
                    <MemeGrid memes={searchResults} loading={false} error={null} onMemeClick={openModal} onVote={handleVote} onFavoriteToggle={handleFavoriteToggle} />
                    {searchResults.length === 0 && <div className="info-message" style={{ padding: '50px 0'}}>No memes found matching filters.</div>}
                </div>
            )}

            {showNoTagsMessage && ( <div className="info-message" style={{ padding: '50px 0', textAlign: 'center' }}>Could not find any memes for categories.</div> )}

            {isModalOpen && ( <MemeDetailModal meme={selectedMeme} onClose={closeModal} onVote={handleVote} onFavoriteToggle={handleFavoriteToggle}/> )}
        </>
    );
}

export default HomePage;