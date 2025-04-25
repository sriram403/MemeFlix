import React from 'react';
import './MemeGrid.css'; // We'll create this CSS file next

// We'll pass the list of memes into this component later
function MemeGrid(/* { memes } */) {

  // For now, just a placeholder message
  // Later, we will map over the 'memes' array and display MemeCards
  const isLoading = false; // Simulate loading finished for now
  const memes = []; // Simulate empty memes list for now

  if (isLoading) {
    return <div className="loading">Loading memes...</div>;
  }

  if (memes.length === 0 && !isLoading) {
     return <div className="info-message">No memes found yet! (Or database is empty)</div>;
  }

  return (
    <div className="meme-grid">
       {/* We will map 'memes' to 'MemeCard' components here later */}
       Placeholder: Meme Cards will appear here.
    </div>
  );
}

export default MemeGrid;