// frontend/src/components/MemeCard.jsx
import React from 'react';
import './MemeCard.css';
import './FavoriteButton.css';
import { useAuth } from '../contexts/AuthContext';

const MEDIA_BASE_URL = 'http://localhost:3001/media';

// Add the new isViewed prop
function MemeCard({ meme, onCardClick, onFavoriteToggle, isViewed = false }) {
  const { isAuthenticated, isFavorite, loadingFavorites } = useAuth();

  if (!meme) return null;

  const score = (meme.upvotes ?? 0) - (meme.downvotes ?? 0);

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
      // Removed controls from card view - only show in modal
      case 'video': return <video /* controls */ muted loop={false} playsInline src={mediaUrl} title={meme.title} preload="metadata">Video not supported.</video>;
      default: return <p>Unsupported media type</p>;
    }
  };

  const handleCardClick = () => { if (onCardClick) onCardClick(meme); };

  const isCurrentlyFavorite = isFavorite(meme.id);

  // Conditionally add the 'meme-card--viewed' class
  const cardClassName = `meme-card ${isViewed ? 'meme-card--viewed' : ''}`;

  return (
    <div className={cardClassName} onClick={handleCardClick}>
      <div className="meme-card-media">
         {/* Render checkmark icon if viewed */}
         {isViewed && <div className="viewed-indicator" title="Viewed">✔</div>}
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