import React from 'react';
import './HeroBanner.css';
import './FavoriteButton.css';
import { useAuth } from '../contexts/AuthContext';

const MEDIA_BASE_URL = 'http://localhost:3001/media';

function HeroBanner({ featuredMeme, onPlayClick, onFavoriteToggle }) {
  const { isAuthenticated, isFavorite, loadingFavorites } = useAuth();

  if (!featuredMeme) return null;

  const backgroundImageUrl = `${MEDIA_BASE_URL}/${featuredMeme.filename}`;
  const isVideo = featuredMeme.type === 'video';
  const isCurrentlyFavorite = isFavorite(featuredMeme.id);

  const bannerStyle = {
      backgroundImage: !isVideo ? `linear-gradient(to right, rgba(0, 0, 0, 0.8) 20%, rgba(0, 0, 0, 0) 80%), url(${backgroundImageUrl})` : 'linear-gradient(to right, rgba(0, 0, 0, 0.8) 20%, rgba(0, 0, 0, 0) 80%)',
  };

  const handleFavoriteButtonClick = (event) => {
      event.stopPropagation();
      if (isAuthenticated && !loadingFavorites && onFavoriteToggle) onFavoriteToggle(featuredMeme.id);
      else if (!isAuthenticated) alert("Please log in.");
  };

  const handlePlayButtonClick = (event) => { event.stopPropagation(); if(onPlayClick) onPlayClick(featuredMeme); }
  const handleInfoButtonClick = (event) => { event.stopPropagation(); if(onPlayClick) onPlayClick(featuredMeme); }

  return (
    <div className="hero-banner" style={bannerStyle}>
      <div className="hero-content">
        <h1 className="hero-title">{featuredMeme.title || 'Featured Meme'}</h1>
        <div className="hero-buttons">
          {isVideo && (<button className="hero-button play-button" onClick={handlePlayButtonClick}>▶ Play</button>)}
           <button className="hero-button info-button" onClick={handleInfoButtonClick}>More Info</button>
           {isAuthenticated && (
              <button
                  className={`favorite-button hero-fav-button ${isCurrentlyFavorite ? 'is-favorite' : ''}`}
                  onClick={handleFavoriteButtonClick}
                  title={isCurrentlyFavorite ? "Remove from My List" : "Add to My List"}
                  disabled={loadingFavorites}
                  aria-label={isCurrentlyFavorite ? "Remove from My List" : "Add to My List"}
              >
                   {isCurrentlyFavorite ? '❤️' : '♡'}
              </button>
           )}
        </div>
      </div>
    </div>
  );
}
export default HeroBanner;