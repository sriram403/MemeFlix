// frontend/src/App.jsx
import React, { useState, useEffect, useCallback } from 'react'; // Added useCallback
import axios from 'axios';
import './App.css';
import Navbar from './components/Navbar';
import MemeGrid from './components/MemeGrid';
import MemeDetailModal from './components/MemeDetailModal';
import PaginationControls from './components/PaginationControls';
import HeroBanner from './components/HeroBanner'; // Ensure HeroBanner is imported

const API_BASE_URL = 'http://localhost:3001';
const MEMES_PER_PAGE = 12;

function App() {
  // --- State Variables ---
  const [memes, setMemes] = useState([]); // Holds the list of memes AND their current vote counts
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedMeme, setSelectedMeme] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  // --- Data Fetching Effect (using useCallback for fetchMemes) ---
  const fetchMemes = useCallback(async () => {
    setLoading(true);
    setError(null);
    let url = '';
    const params = {};

    if (searchTerm) {
      url = `${API_BASE_URL}/api/memes/search?q=${encodeURIComponent(searchTerm)}`;
       // Reset page/pagination state if needed when searching
      // If search backend doesn't support pagination, reset here
      // if (currentPage !== 1) setCurrentPage(1); // Might cause flicker if search term changes rapidly
       setTotalPages(0);
    } else {
      url = `${API_BASE_URL}/api/memes`;
      params.page = currentPage;
      params.limit = MEMES_PER_PAGE;
    }

    try {
      const response = await axios.get(url, { params });
      setMemes(response.data.memes || []); // Update memes list

      if (!searchTerm && response.data.pagination) {
        setTotalPages(response.data.pagination.totalPages);
        // Adjust current page if it's somehow out of bounds after fetch
        if (response.data.pagination.currentPage !== currentPage && currentPage > response.data.pagination.totalPages) {
            setCurrentPage(response.data.pagination.totalPages || 1);
        }
      } else if(searchTerm) {
          // Handle pagination for search results if backend supports it
          // Otherwise, calculate based on results length or hide as currently done
          setTotalPages(0); // Hiding for now
      }
    } catch (err) {
      console.error("Error fetching memes:", err);
      setError(searchTerm ? `Failed to search memes for "${searchTerm}".` : 'Failed to load memes.');
      setTotalPages(0);
      setMemes([]); // Clear memes on error
    } finally {
      setLoading(false);
    }
  }, [searchTerm, currentPage]); // Dependencies for useCallback

  useEffect(() => {
    fetchMemes(); // Call the memoized fetch function
  }, [fetchMemes]); // useEffect depends on the memoized function itself


  // --- Search Handler ---
  const handleSearch = (query) => {
    setSearchTerm(query);
    setCurrentPage(1); // Reset to page 1 on new search
  };

  // --- Modal Handlers ---
  const openModal = (meme) => {
    setSelectedMeme(meme);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedMeme(null);
  };

  // --- Page Change Handler ---
  const handlePageChange = (newPage) => {
      if (newPage >= 1 && (!totalPages || newPage <= totalPages)) { // Allow change if totalPages is 0 (e.g., during search)
          setCurrentPage(newPage);
          window.scrollTo(0, 0);
      }
  };

  // --- *** NEW: Vote Handling Logic *** ---
  const handleVote = useCallback(async (memeId, voteType) => {
    const originalMemes = [...memes]; // Keep a copy for potential rollback
    let updatedMemeData = null;

    // --- Optimistic UI Update ---
    // Update the local state IMMEDIATELY for better UX
    setMemes(prevMemes => prevMemes.map(meme => {
      if (meme.id === memeId) {
        // Create a new object with updated votes
        updatedMemeData = {
          ...meme,
          upvotes: voteType === 'upvote' ? meme.upvotes + 1 : meme.upvotes,
          downvotes: voteType === 'downvote' ? meme.downvotes + 1 : meme.downvotes,
        };
        // If modal is open and showing this meme, update selectedMeme state too
        if (selectedMeme && selectedMeme.id === memeId) {
            setSelectedMeme(updatedMemeData);
        }
        return updatedMemeData;
      }
      return meme; // Return unchanged memes
    }));

    // --- Send API Request ---
    try {
      const voteUrl = `${API_BASE_URL}/api/memes/${memeId}/${voteType}`; // voteType is 'upvote' or 'downvote'
      await axios.post(voteUrl);
      // If successful, the optimistic update is correct. Do nothing more here for now.
      console.log(`Successfully ${voteType}d meme ${memeId} on backend.`);

    } catch (error) {
      console.error(`Error ${voteType}ing meme ${memeId}:`, error);
      // --- Rollback UI on Error ---
      // If the API call fails, revert the state change
      alert(`Failed to register ${voteType}. Please try again.`); // Simple error feedback
      setMemes(originalMemes); // Restore original memes list
      // If modal was showing this meme, restore its state too
      if (selectedMeme && selectedMeme.id === memeId) {
          const originalMemeInList = originalMemes.find(m => m.id === memeId);
          if(originalMemeInList) setSelectedMeme(originalMemeInList);
      }
      // TODO: More sophisticated error handling/feedback
    }
  }, [memes, selectedMeme]); // Dependencies for useCallback: Needs access to memes and selectedMeme


  // Determine the featured meme
  const featuredMeme = !loading && !error && memes.length > 0 ? memes[0] : null;

  return (
    <div className="App">
      <Navbar onSearch={handleSearch} currentSearchTerm={searchTerm} />

      <main>
        {!searchTerm && <HeroBanner featuredMeme={featuredMeme} onPlayClick={openModal}/>}

        {/* Pass handleVote down */}
        <MemeGrid
          memes={memes}
          loading={loading}
          error={error}
          onMemeClick={openModal}
          onVote={handleVote} // Pass vote handler
        />

        {!loading && !error && totalPages > 1 && !searchTerm && (
           <PaginationControls
               currentPage={currentPage}
               totalPages={totalPages}
               onPageChange={handlePageChange}
           />
        )}
      </main>

      <footer>{/* ... */}</footer>

      {/* Pass handleVote down to Modal as well */}
      {isModalOpen && (
        <MemeDetailModal
          meme={selectedMeme}
          onClose={closeModal}
          onVote={handleVote} // Pass vote handler
        />
      )}
    </div>
  );
}

export default App;