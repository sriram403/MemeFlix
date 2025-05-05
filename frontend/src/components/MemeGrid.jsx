// frontend/src/components/MemeGrid.jsx
import React from 'react';
import './MemeGrid.css';
import MemeCard from './MemeCard';
import Spinner from './Spinner'; // Import Spinner

function MemeGrid({ memes, loading, error, onMemeClick, onVote, onFavoriteToggle, isMemeViewed }) {

  // *** Use Spinner component for loading state ***
  if (loading) {
    // Optionally add a message to the spinner
    return <Spinner size="large" message="Loading memes..." />;
  }

  if (error) {
    // Keep error message as text, but add ARIA role
    return <div className="error-message" role="alert">Error: {error}</div>;
  }

  if (!memes || memes.length === 0) {
      if (!loading && !error) {
         // Keep info message as text
         return <div className="info-message" role="status">No memes found matching your criteria.</div>;
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
             onVote={onVote}
             onFavoriteToggle={onFavoriteToggle}
             isViewed={isMemeViewed ? isMemeViewed(meme.id) : false}
           />
         ))}
       </div>
     </div>
   );
 }

 export default MemeGrid;