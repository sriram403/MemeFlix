// frontend/src/components/MemeGrid.jsx
import React from 'react';
import './MemeGrid.css';
import MemeCard from './MemeCard';
import Spinner from './Spinner';

// Use 'isMemeViewedCheck' consistently for the prop name
function MemeGrid({ memes, loading, error, onMemeClick, onVote, onFavoriteToggle, isMemeViewedCheck }) {

  if (loading) {
    return <Spinner size="large" message="Loading memes..." />;
  }

  if (error) {
    return <div className="error-message" role="alert">Error: {error}</div>;
  }

  if (!memes || memes.length === 0) {
      if (!loading && !error) {
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
             onVote={onVote} // Keep passing down if needed elsewhere eventually
             onFavoriteToggle={onFavoriteToggle}
             // Call the passed function with the meme data
             isViewed={isMemeViewedCheck ? isMemeViewedCheck(meme) : !!meme.is_viewed}
           />
         ))}
       </div>
     </div>
   );
 }

 export default MemeGrid;