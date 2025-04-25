import React, { useState, useEffect } from 'react'; // Import useState and useEffect hooks
import axios from 'axios'; // Import axios for API calls
import './MemeGrid.css';

// Define the base URL for our backend API
const API_BASE_URL = 'http://localhost:3001'; // Your backend server address

function MemeGrid() {
  // --- State Variables ---
  // 1. To store the array of memes fetched from the API
  const [memes, setMemes] = useState([]); // Initial state is an empty array
  // 2. To track the loading state
  const [loading, setLoading] = useState(true); // Start in loading state
  // 3. To store any potential error messages
  const [error, setError] = useState(null); // Start with no error

  // --- Data Fetching Effect ---
  // useEffect runs after the component renders.
  // The empty dependency array [] means it runs only ONCE when the component mounts.
  useEffect(() => {
    // Define an async function inside useEffect to use await
    const fetchMemes = async () => {
      setLoading(true); // Set loading true before fetching
      setError(null); // Clear previous errors
      try {
        // Make the GET request to our backend endpoint using axios
        const response = await axios.get(`${API_BASE_URL}/api/memes`);
        // Axios puts the actual response data in the 'data' property
        // Our backend sends { memes: [...] }, so we access response.data.memes
        setMemes(response.data.memes); // Update the memes state with fetched data
      } catch (err) {
        // If an error occurs during the request
        console.error("Error fetching memes:", err);
        setError('Failed to load memes. Please try again later.'); // Update the error state
      } finally {
        // This block runs regardless of success or error
        setLoading(false); // Set loading to false after fetching is complete
      }
    };

    fetchMemes(); // Call the async function to start fetching

  }, []); // Empty dependency array means run this effect only once on mount

  // --- Conditional Rendering based on state ---
  if (loading) {
    return <div className="loading">Loading memes...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  if (memes.length === 0) {
     return <div className="info-message">No memes found! Add some to the database or check the backend.</div>;
  }

  // --- Render the list of memes (titles only for now) ---
  return (
    <div className="meme-grid">
      <h2>Browse Memes</h2>
      <ul>
        {/* Map over the memes array and render a list item for each meme's title */}
        {memes.map((meme) => (
          <li key={meme.id}>{meme.title} (Type: {meme.type})</li>
        ))}
      </ul>
    </div>
  );
}

export default MemeGrid;