import React from 'react';
import './MemeGrid.css';
import MemeCard from './MemeCard';

// Receive onFavoriteToggle prop
function MemeGrid({ memes, loading, error, onMemeClick, onVote, onFavoriteToggle }) {

  if (loading) {
    return <div className="loading">Loading memes...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  // Handle empty state specifically AFTER loading and error checks
  if (!memes || memes.length === 0) {
      // Don't show empty message if loading or error already handled it
      if (!loading && !error) {
         return <div className="info-message">No memes found matching your criteria.</div>;
      }
      return null; // Otherwise, let loading/error messages show
  }


  return (
    <div className="meme-grid-container">
      {/* Conditionally render heading? Maybe based on a prop */}
      {/* <h2>Browse Memes</h2> */}
       <div className="meme-grid">
         {memes.map((meme) => (
           <MemeCard
             key={meme.id}
             meme={meme}
             onCardClick={onMemeClick}
             onVote={onVote}
             onFavoriteToggle={onFavoriteToggle} // Pass toggle handler down
           />
         ))}
       </div>
     </div>
   );
 }

 export default MemeGrid;