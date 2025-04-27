// frontend/src/components/MemeGrid.jsx
// Remove useState, useEffect, axios imports if no longer needed here
import React from 'react';
import './MemeGrid.css';
import MemeCard from './MemeCard';

// Receive props from App.jsx: { memes, loading, error }
function MemeGrid({ memes, loading, error }) {

  // State and useEffect are removed - data comes via props

  // --- Conditional Rendering based on PROPS ---
  if (loading) {
    return <div className="loading">Loading memes...</div>;
  }

  if (error) {
    // Display the specific error message passed down from App
    return <div className="error-message">Error: {error}</div>;
  }

  // Use the length of the passed-in memes array
  if (!memes || memes.length === 0) {
     return <div className="info-message">No memes found! Try a different search or check the backend.</div>;
  }

  // --- Render the grid of MemeCards using PROPS ---
  return (
    <div className="meme-grid-container">
       {/* Maybe hide heading during search results? Optional */}
       {/* <h2>Browse Memes</h2> */}
       <div className="meme-grid">
         {/* Map over the memes PROP */}
         {memes.map((meme) => (
           <MemeCard key={meme.id} meme={meme} />
         ))}
       </div>
     </div>
   );
 }

 export default MemeGrid;