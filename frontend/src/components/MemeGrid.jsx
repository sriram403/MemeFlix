// frontend/src/components/MemeGrid.jsx
import React from 'react';
import './MemeGrid.css';
import MemeCard from './MemeCard'; // Ensure MemeCard is imported

// Receive onVote prop from App.jsx
function MemeGrid({ memes, loading, error, onMemeClick, onVote }) {

  if (loading) {
    return <div className="loading">Loading memes...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  if (!memes || memes.length === 0) {
     return <div className="info-message">No memes found! Try a different search or check the backend.</div>;
  }

  return (
    <div className="meme-grid-container">
      {/* Maybe hide heading during search results? Optional */}
      {/* <h2>Browse Memes</h2> */}
       <div className="meme-grid">
         {/* Map over the memes PROP */}
         {memes.map((meme) => (
           // Pass onVote down to each MemeCard
           <MemeCard
             key={meme.id}
             meme={meme}
             onCardClick={onMemeClick}
             onVote={onVote} // Pass the onVote handler
           />
         ))}
       </div>
     </div>
   );
 }

 export default MemeGrid;