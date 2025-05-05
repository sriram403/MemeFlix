// frontend/src/components/MemeGrid.jsx
import React from 'react';
import './MemeGrid.css';
import MemeCard from './MemeCard';
import Spinner from './Spinner';

// *** Rename prop to isMemeViewedCheck ***
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
             onVote={onVote}
             onFavoriteToggle={onFavoriteToggle}
             // *** Call isMemeViewedCheck with the meme object ***
             // meme.is_viewed comes from backend, isMemeViewedCheck checks session state too
             isViewed={isMemeViewedCheck ? isMemeViewedCheck(meme) : !!meme.is_viewed}
           />
         ))}
       </div>
     </div>
   );
 }

 export default MemeGrid;