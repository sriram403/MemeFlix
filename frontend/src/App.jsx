// frontend/src/App.jsx
import React, { useState, useEffect } from 'react'; // Import hooks
import axios from 'axios';                         // Import axios
import './App.css';
import Navbar from './components/Navbar';
import MemeGrid from './components/MemeGrid';
import MemeDetailModal from './components/MemeDetailModal'; // Import the modal component

const API_BASE_URL = 'http://localhost:3001'; // Backend URL

function App() {
  // --- State Variables ---
  const [memes, setMemes] = useState([]);           // Lifted from MemeGrid
  const [loading, setLoading] = useState(true);    // Lifted from MemeGrid
  const [error, setError] = useState(null);        // Lifted from MemeGrid
  const [searchTerm, setSearchTerm] = useState(''); // NEW: State for the search query

 // --- NEW: Modal State ---
 const [selectedMeme, setSelectedMeme] = useState(null); // Holds the meme object for the modal
 const [isModalOpen, setIsModalOpen] = useState(false); // Tracks if modal is open

  // --- Data Fetching Effect (Now in App.jsx) ---
  useEffect(() => {
    const fetchMemes = async () => {
      setLoading(true);
      setError(null);
      let url = `${API_BASE_URL}/api/memes`; // Default URL

      // If there's a search term, change the URL to the search endpoint
      if (searchTerm) {
        // Use encodeURIComponent to handle special characters in the search term
        url = `${API_BASE_URL}/api/memes/search?q=${encodeURIComponent(searchTerm)}`;
      }

      try {
        const response = await axios.get(url);
        setMemes(response.data.memes || []); // Ensure memes is always an array
      } catch (err) {
        console.error("Error fetching memes:", err);
        // More specific error based on search?
        setError(searchTerm ? `Failed to search memes for "${searchTerm}".` : 'Failed to load memes.');
      } finally {
        setLoading(false);
      }
    };

    fetchMemes(); // Execute fetch

  // *** IMPORTANT: Add searchTerm to the dependency array ***
  // This effect will re-run whenever searchTerm changes
  }, [searchTerm]);

  // --- Search Handler Function ---
  // This function will be passed down to Navbar
  const handleSearch = (query) => {
    setSearchTerm(query); // Update the search term state
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

  return (
    <div className="App">
      <Navbar onSearch={handleSearch} currentSearchTerm={searchTerm} />

      <main>
        {/* Pass openModal function down to MemeGrid */}
        <MemeGrid
          memes={memes}
          loading={loading}
          error={error}
          onMemeClick={openModal} // Pass the handler function as a prop
        />
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