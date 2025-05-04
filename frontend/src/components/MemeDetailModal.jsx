import React, { useEffect } from 'react';
import './MemeDetailModal.css';
import './FavoriteButton.css'; // Still need for base styling
import { useAuth } from '../contexts/AuthContext';

const MEDIA_BASE_URL = 'http://localhost:3001/media';

function MemeDetailModal({ meme, onClose, onVote, onFavoriteToggle }) {
  console.log('Meme prop received by modal:', meme);
  const { isAuthenticated, isFavorite, loadingFavorites, recordView } = useAuth();

  useEffect(() => {
    const handleEsc = (event) => event.keyCode === 27 && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  useEffect(() => {
      if (meme?.id && isAuthenticated) {
          recordView(meme.id);
      }
  }, [meme?.id, isAuthenticated, recordView]);


  if (!meme) return null;

  const score = (meme.upvotes ?? 0) - (meme.downvotes ?? 0);
  const isCurrentlyFavorite = isFavorite(meme.id);


  const renderMedia = () => {
    const mediaUrl = `${MEDIA_BASE_URL}/${meme.filename}`;
    switch (meme.type) {
      case 'image': case 'gif': return <img src={mediaUrl} alt={meme.title} />;
      case 'video': return <video controls autoPlay playsInline muted loop src={mediaUrl} title={meme.title}>Video not supported.</video>;
      default: return <p>Unsupported media type</p>;
    }
  };

  const handleContentClick = (event) => event.stopPropagation();
  const handleUpvote = (event) => { event.stopPropagation(); if(onVote) onVote(meme.id, 'upvote'); };
  const handleDownvote = (event) => { event.stopPropagation(); if(onVote) onVote(meme.id, 'downvote'); };

  // Favorite button handler remains the same logic
  const handleFavoriteButtonClick = (event) => {
      event.stopPropagation();
      if (isAuthenticated && !loadingFavorites && onFavoriteToggle) {
          onFavoriteToggle(meme.id);
      }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={handleContentClick}>
        <button className="modal-close-button" onClick={onClose} aria-label="Close modal">×</button>

        {/* Media Section - Favorite button REMOVED from here */}
        <div className="modal-media">
           {renderMedia()}
        </div>

        {/* Info Section */}
        <div className="modal-info">
          {/* Title remains at top */}
          <h2>{meme.title || 'Untitled Meme'}</h2>

          {/* Description and Tags */}
          {meme.description && <p className="modal-description">{meme.description}</p>}

          {/* --- Tags and Favorite Button Row --- */}
          <div className="modal-tags-actions-row">
              {meme.tags && <p className="modal-tags">Tags: {meme.tags}</p>}
              {/* --- FAVORITE BUTTON MOVED HERE --- */}
              {isAuthenticated && (
                  <button
                      className={`favorite-button modal-fav-button-inline ${isCurrentlyFavorite ? 'is-favorite' : ''}`} // New specific class
                      onClick={handleFavoriteButtonClick}
                      title={isCurrentlyFavorite ? "Remove from My List" : "Add to My List"}
                      disabled={loadingFavorites}
                      aria-label={isCurrentlyFavorite ? "Remove from My List" : "Add to My List"}
                  >
                      {isCurrentlyFavorite ? '❤️' : '♡'}
                  </button>
              )}
              {/* --- END FAVORITE BUTTON MOVE --- */}
          </div>

          {/* Vote Actions remain at the bottom */}
          <div className="modal-actions">
             <button className="vote-button upvote" onClick={handleUpvote} aria-label="Upvote">
               😂 <span className="vote-count">{meme.upvotes ?? 0}</span>
             </button>
             <span className="score" aria-label={`Current score ${score}`}>Score: {score}</span>
             <button className="vote-button downvote" onClick={handleDownvote} aria-label="Downvote">
               😑 <span className="vote-count">{meme.downvotes ?? 0}</span>
             </button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default MemeDetailModal;