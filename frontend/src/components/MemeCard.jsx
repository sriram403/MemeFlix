import React from 'react';
import './MemeCard.css';
import './FavoriteButton.css';
import { useAuth } from '../contexts/AuthContext';

const MEDIA_BASE_URL = 'http://localhost:3001/media';

// onVote prop is REMOVED from here
function MemeCard({ meme, onCardClick, onFavoriteToggle }) {
  const { isAuthenticated, isFavorite, loadingFavorites } = useAuth();

  if (!meme) return null; // Return null if meme data is missing

  // Calculate score directly from the props. This will re-calculate on re-render.
  const score = (meme.upvotes ?? 0) - (meme.downvotes ?? 0);

  // Voting handlers are removed from this component

  // Favorite button handler
  const handleFavoriteButtonClick = (event) => {
      event.stopPropagation();
      if (isAuthenticated && !loadingFavorites && onFavoriteToggle) {
         onFavoriteToggle(meme.id);
      } else if (!isAuthenticated) {
          alert("Please log in to manage your list.");
      }
  };

  const renderMedia = () => {
    const mediaUrl = `${MEDIA_BASE_URL}/${meme.filename}`;
    switch (meme.type) {
      case 'image': case 'gif': return <img src={mediaUrl} alt={meme.title} loading="lazy" />;
      case 'video': return <video controls muted loop={false} playsInline src={mediaUrl} title={meme.title} preload="metadata">Video not supported.</video>;
      default: return <p>Unsupported media type</p>;
    }
  };

  const handleCardClick = () => { if (onCardClick) onCardClick(meme); };

  const isCurrentlyFavorite = isFavorite(meme.id);

  return (
    <div className="meme-card" onClick={handleCardClick}>
      <div className="meme-card-media">
         {isAuthenticated && (
            <button
                className={`favorite-button ${isCurrentlyFavorite ? 'is-favorite' : ''}`}
                onClick={handleFavoriteButtonClick}
                title={isCurrentlyFavorite ? "Remove from My List" : "Add to My List"}
                disabled={loadingFavorites}
                aria-label={isCurrentlyFavorite ? "Remove from My List" : "Add to My List"}
            >
                {isCurrentlyFavorite ? '❤️' : '♡'}
            </button>
         )}
         {renderMedia()}
      </div>
      <div className="meme-card-info">
        <h3 className="meme-card-title">{meme.title || 'Untitled Meme'}</h3>
        {/* Display Floompers score, calculated from props */}
        <div className="meme-card-actions">
           <span
              className="score floompers-score"
              title="Meme Score"
              aria-label={`Floompers score ${score}`}
            >
                Floompers: {score}
            </span>
        </div>
      </div>
    </div>
  );
}

export default MemeCard;