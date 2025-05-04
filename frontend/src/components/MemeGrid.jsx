// frontend/src/components/MemeGrid.jsx
import React from 'react';
import './MemeGrid.css';
import MemeCard from './MemeCard';

// Accept isMemeViewed function prop
function MemeGrid({ memes, loading, error, onMemeClick, onVote, onFavoriteToggle, isMemeViewed }) {

  if (loading) {
    return <div className="loading">Loading memes...</div>;
  }

  if (error) {
    return <div className="error-message">Error: {error}</div>;
  }

  if (!memes || memes.length === 0) {
      if (!loading && !error) {
         return <div className="info-message">No memes found matching your criteria.</div>;
      }
      return null;
  }

  return (
    <div className="meme-grid-container">
       <div className="meme-grid">
         {memes.map((meme) => (
           <MemeCard
             key={meme.id}
             meme={meme}
             onCardClick={onMemeClick}
             onVote={onVote} // Pass vote handler (if needed for future card actions)
             onFavoriteToggle={onFavoriteToggle}
             // *** Pass the result of isMemeViewed for this specific meme ***
             isViewed={isMemeViewed ? isMemeViewed(meme.id) : false}
           />
         ))}
       </div>
     </div>
   );
 }

 export default MemeGrid;