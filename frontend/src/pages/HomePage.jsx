import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import MemeGrid from '../components/MemeGrid';
import MemeDetailModal from '../components/MemeDetailModal';
import PaginationControls from '../components/PaginationControls';
import HeroBanner from '../components/HeroBanner';

const API_BASE_URL = 'http://localhost:3001';
const MEMES_PER_PAGE = 12;

function HomePage() {
    const [memes, setMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    const { isAuthenticated, addFavorite, removeFavorite, isFavorite, loadingFavorites } = useAuth();
    const [searchParams] = useSearchParams();
    const searchTerm = searchParams.get('search') || '';

     const fetchMemes = useCallback(async (pageToFetch) => {
        setLoading(true);
        setError(null);
        let url = '';
        const params = {};

        if (searchTerm) {
            url = `${API_BASE_URL}/api/memes/search`;
            params.q = searchTerm;
            // Reset page state locally if search term changes, handled in dependency effect
            setTotalPages(0); // Hide pagination during search
        } else {
            url = `${API_BASE_URL}/api/memes`;
            params.page = pageToFetch; // Use the passed page number
            params.limit = MEMES_PER_PAGE;
        }

        try {
            const response = await axiosInstance.get(url, { params });
            setMemes(response.data.memes || []);

            if (!searchTerm && response.data.pagination) {
                setTotalPages(response.data.pagination.totalPages);
                // Check if fetched page matches current requested page (to avoid race conditions)
                if (response.data.pagination.currentPage !== pageToFetch) {
                    // If backend gives a different page than requested (e.g., invalid page requested), adjust
                     if(pageToFetch > response.data.pagination.totalPages && response.data.pagination.totalPages > 0){
                        setCurrentPage(response.data.pagination.totalPages); // Go to last valid page
                     }
                     // Or if backend corrected it for other reasons, trust the backend's current page
                     // setCurrentPage(response.data.pagination.currentPage);
                }
            } else if (searchTerm) {
                 setTotalPages(0);
            }
        } catch (err) {
            console.error("Error fetching memes:", err);
            setError(searchTerm ? `Failed to search memes for "${searchTerm}".` : 'Failed to load memes.');
            setTotalPages(0);
            setMemes([]);
        } finally {
            setLoading(false);
        }
    }, [searchTerm]); // Remove currentPage dependency here

     useEffect(() => {
        // Reset to page 1 when search term changes
        if (searchTerm) {
            setCurrentPage(1);
            fetchMemes(1); // Fetch page 1 for new search term
        } else {
            fetchMemes(currentPage); // Fetch current page when search is cleared or page changes
        }
    }, [searchTerm, currentPage, fetchMemes]); // Depend on search, page, and the memoized fetch function


    const openModal = (meme) => { setSelectedMeme(meme); setIsModalOpen(true); };
    const closeModal = () => { setIsModalOpen(false); setSelectedMeme(null); };

    const handlePageChange = (newPage) => {
        if (newPage >= 1 && (!totalPages || newPage <= totalPages)) {
            setCurrentPage(newPage);
            window.scrollTo(0, 0);
        }
    };

     const handleVote = useCallback(async (memeId, voteType) => {
        // This function could potentially be moved to AuthContext if preferred
        if (!isAuthenticated && voteType !== 'view') { // Allow viewing without auth?
            alert("Please log in to vote.");
            return;
        }
        const originalMemes = [...memes];
        let updatedMemeData = null;

        setMemes(prevMemes => prevMemes.map(meme => {
            if (meme.id === memeId) {
                updatedMemeData = { ...meme, upvotes: voteType === 'upvote' ? meme.upvotes + 1 : meme.upvotes, downvotes: voteType === 'downvote' ? meme.downvotes + 1 : meme.downvotes };
                if (selectedMeme && selectedMeme.id === memeId) setSelectedMeme(updatedMemeData);
                return updatedMemeData;
            }
            return meme;
        }));

        try {
            const voteUrl = `/api/memes/${memeId}/${voteType}`;
            await axiosInstance.post(voteUrl);
        } catch (error) {
            console.error(`Error ${voteType}ing meme ${memeId}:`, error);
            alert(`Failed to register ${voteType}.`);
            setMemes(originalMemes);
             if (selectedMeme && selectedMeme.id === memeId) {
                 const originalMemeInList = originalMemes.find(m => m.id === memeId);
                 if(originalMemeInList) setSelectedMeme(originalMemeInList);
             }
        }
    }, [memes, selectedMeme, isAuthenticated, axiosInstance]);

     const handleFavoriteToggle = useCallback(async (memeId) => {
         if (!isAuthenticated) {
             alert("Please log in to manage your list.");
             return;
         }
         if (loadingFavorites) return;
         const currentlyFavorite = isFavorite(memeId);
         if (currentlyFavorite) { await removeFavorite(memeId); }
         else { await addFavorite(memeId); }
     }, [isAuthenticated, loadingFavorites, isFavorite, addFavorite, removeFavorite]);

    const featuredMeme = !loading && !error && memes.length > 0 && !searchTerm ? memes[0] : null;

    return (
        <>
             {featuredMeme && <HeroBanner featuredMeme={featuredMeme} onPlayClick={openModal} onFavoriteToggle={handleFavoriteToggle}/>}

            <MemeGrid
                memes={memes}
                loading={loading}
                error={error}
                onMemeClick={openModal}
                onVote={handleVote}
                onFavoriteToggle={handleFavoriteToggle}
            />

            {!loading && !error && totalPages > 1 && !searchTerm && (
               <PaginationControls
                   currentPage={currentPage}
                   totalPages={totalPages}
                   onPageChange={handlePageChange}
               />
            )}

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