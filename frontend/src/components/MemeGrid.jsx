// frontend/src/components/MemeGrid.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './MemeGrid.css';
import MemeCard from './MemeCard'; // *** IMPORT MemeCard ***

const API_BASE_URL = 'http://localhost:3001';

function MemeGrid() {
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMemes = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await axios.get(`${API_BASE_URL}/api/memes`);
        setMemes(response.data.memes);
      } catch (err) {
        console.error("Error fetching memes:", err);
        setError('Failed to load memes. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    fetchMemes();
  }, []);

  if (loading) { /* ... loading state ... */ }
  if (error) { /* ... error state ... */ }
  if (memes.length === 0 && !loading) { /* ... empty state ... */ } // Adjusted empty state check

  // --- Render the grid of MemeCards ---
  return (
    <div className="meme-grid-container"> {/* Optional outer container */}
      <h2>Browse Memes</h2>
      <div className="meme-grid"> {/* This div will act as the grid layout container */}
        {/* Map over the memes array and render a MemeCard for each meme */}
        {memes.map((meme) => (
          // Pass the entire 'meme' object as a prop to MemeCard
          // Use the unique 'meme.id' as the key
          <MemeCard key={meme.id} meme={meme} />
        ))}
      </div>
    </div>
  );
}

export default MemeGrid;