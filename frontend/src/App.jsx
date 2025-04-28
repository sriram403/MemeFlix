// frontend/src/App.jsx
import React, { useState, useEffect } from 'react'; // Import hooks
import axios from 'axios';                         // Import axios
import './App.css';
import Navbar from './components/Navbar';
import MemeGrid from './components/MemeGrid';
import MemeDetailModal from './components/MemeDetailModal'; // Import the modal component
import PaginationControls from './components/PaginationControls'; // Import PaginationControls


const API_BASE_URL = 'http://localhost:3001'; // Backend URL
const MEMES_PER_PAGE = 2; // Define items per page

function App() {
  // --- State Variables ---
  const [memes, setMemes] = useState([]);           // Lifted from MemeGrid
  const [loading, setLoading] = useState(true);    // Lifted from MemeGrid
  const [error, setError] = useState(null);        // Lifted from MemeGrid
  const [searchTerm, setSearchTerm] = useState(''); // NEW: State for the search query

 // --- NEW: Modal State ---
 const [selectedMeme, setSelectedMeme] = useState(null); // Holds the meme object for the modal
 const [isModalOpen, setIsModalOpen] = useState(false); // Tracks if modal is open

   // --- NEW: Pagination State ---
   const [currentPage, setCurrentPage] = useState(1);
   const [totalPages, setTotalPages] = useState(0);
   // We could store totalMemes too if needed

  // --- Data Fetching Effect (Now in App.jsx) ---
  // --- Updated Data Fetching Effect ---
  useEffect(() => {
    const fetchMemes = async () => {
      setLoading(true);
      setError(null);
      let url = '';
      const params = {}; // Object to hold query parameters

      if (searchTerm) {
        // Keep search simple for now - does NOT use backend pagination yet
        url = `${API_BASE_URL}/api/memes/search?q=${encodeURIComponent(searchTerm)}`;
        // Reset page to 1 when searching
        if (currentPage !== 1) setCurrentPage(1);
        setTotalPages(0); // Hide pagination during search for simplicity
      } else {
        // Fetch paginated memes
        url = `${API_BASE_URL}/api/memes`;
        params.page = currentPage; // Add page param
        params.limit = MEMES_PER_PAGE; // Add limit param
      }

      try {
        const response = await axios.get(url, { params }); // Pass params object to axios

        setMemes(response.data.memes || []);

        // Update pagination state ONLY if not searching
        if (!searchTerm && response.data.pagination) {
          setTotalPages(response.data.pagination.totalPages);
          // Optionally update currentPage from response if needed (though we set it)
          // setCurrentPage(response.data.pagination.currentPage);
        } else if (searchTerm) {
            // If searching, determine totalPages based on results length (client-side)
            // For simplicity, we're hiding pagination during search for now.
            // Alternatively, modify backend search to paginate & return totalPages.
        }

      } catch (err) {
        console.error("Error fetching memes:", err);
        setError(searchTerm ? `Failed to search memes for "${searchTerm}".` : 'Failed to load memes.');
        setTotalPages(0); // Reset pages on error
      } finally {
        setLoading(false);
      }
    };

    fetchMemes();

  // Re-run effect when searchTerm OR currentPage changes
  }, [searchTerm, currentPage])

  // --- Search Handler Function ---
  // This function will be passed down to Navbar
  const handleSearch = (query) => {
    setSearchTerm(query); // Update the search term state
     // Reset to page 1 when a new search is initiated
     setCurrentPage(1);
  };

  const openModal = (meme) => {
    setSelectedMeme(meme);   // Set the selected meme data
    setIsModalOpen(true);    // Set modal visibility to true
  };

  const closeModal = () => {
    setIsModalOpen(false);   // Set modal visibility to false
    // Optionally reset selectedMeme after a delay for fade-out animation later
    // setTimeout(() => setSelectedMeme(null), 300);
     setSelectedMeme(null); // Reset selected meme immediately for now
  };

  const handlePageChange = (newPage) => {
    // Basic validation
    if (newPage >= 1 && newPage <= totalPages) {
        setCurrentPage(newPage);
        // Optional: Scroll to top when changing page
        window.scrollTo(0, 0);
    }
};

  return (
    <div className="App">
      <Navbar onSearch={handleSearch} currentSearchTerm={searchTerm} />

      <main>
        <MemeGrid
          memes={memes}
          loading={loading}
          error={error}
          onMemeClick={openModal}
        />
        {/* --- Render Pagination Controls --- */}
        {/* Only show pagination if not loading, no error, and more than 1 page exists */}
        {!loading && !error && totalPages > 1 && !searchTerm && (
           <PaginationControls
               currentPage={currentPage}
               totalPages={totalPages}
               onPageChange={handlePageChange}
           />
        )}
      </main>

      <footer>
        <p>Memeflix Footer - All Rights Reserved (locally)</p>
      </footer>

      {/* --- Conditionally Render the Modal --- */}
      {/* Only render the modal if isModalOpen is true */}
      {isModalOpen && (
        <MemeDetailModal
          meme={selectedMeme} // Pass the selected meme data
          onClose={closeModal}   // Pass the close handler function
        />
      )}
    </div>
  );
}

export default App;