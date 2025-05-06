// frontend/src/components/HeroBanner.jsx
import React from 'react';
import './HeroBanner.css';
import './FavoriteButton.css';
import { useAuth } from '../contexts/AuthContext';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';
const MEDIA_BASE_URL = `${API_BASE_URL}/media`;

function HeroBanner({ featuredMeme, onPlayClick, onFavoriteToggle }) {
  const { isAuthenticated, isFavorite, loadingFavorites } = useAuth();

  if (!featuredMeme) return null;

  const isVideo = featuredMeme.type === 'video';
  const mediaUrl = `${MEDIA_BASE_URL}/${featuredMeme.filename}`;

  // --- Style Calculation ---
  let bannerStyle = {};
  let bannerClassName = "hero-banner"; // Base class

  if (isVideo) {
      bannerClassName += " hero-banner-video"; // Add specific class for video
      // Apply a more dynamic gradient or background for videos inline
      bannerStyle = {
          // Example: Gradient with accent color influence
          background: `
              radial-gradient(circle at 15% 85%, rgba(229, 9, 20, 0.25) 0%, transparent 40%),
              linear-gradient(180deg, rgba(20, 20, 20, 0) 60%, rgba(20, 20, 20, 0.8) 100%),
              var(--primary-dark-bg)
          `,
          // No background-image needed for video gradient background
      };
  } else {
      bannerClassName += " hero-banner-image"; // Add specific class for image/gif
      // Set background image for non-videos
      bannerStyle = {
          backgroundImage: `url(${mediaUrl})`,
      };
       // The dark overlay gradients for images will be handled by the ::before pseudo-element in CSS
  }
  // --- End Style Calculation ---

  const handleFavoriteButtonClick = (event) => {
      event.stopPropagation();
      if (isAuthenticated && !loadingFavorites && onFavoriteToggle) onFavoriteToggle(featuredMeme.id);
      else if (!isAuthenticated) alert("Please log in.");
  };

  const handlePlayButtonClick = (event) => { event.stopPropagation(); if(onPlayClick) onPlayClick(featuredMeme); }
  const handleInfoButtonClick = (event) => { event.stopPropagation(); if(onPlayClick) onPlayClick(featuredMeme); } // Info button also opens modal

  const isCurrentlyFavorite = isFavorite(featuredMeme.id);

  return (
    // Apply dynamic class name and inline style
    <div className={bannerClassName} style={bannerStyle}>
      <div className="hero-content">
        <h1 className="hero-title">{featuredMeme.title || 'Featured Meme'}</h1>
        <div className="hero-buttons">
          {/* Play button is always relevant now, opens modal */}
          <button className="hero-button play-button" onClick={handlePlayButtonClick}>
             ▶ {isVideo ? 'Play' : 'View'} {/* Adjust text slightly */}
          </button>
          {/* Info button becomes somewhat redundant if Play does the same thing */}
          {/* <button className="hero-button info-button" onClick={handleInfoButtonClick}>More Info</button> */}
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
         {/* Optionally show description only if it exists */}
         {featuredMeme.description && (
            <p className="hero-description">{featuredMeme.description}</p>
         )}
      </div>
    </div>
  );
}
export default HeroBanner;