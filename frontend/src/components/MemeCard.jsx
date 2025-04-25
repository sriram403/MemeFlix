import React from 'react';
import './MemeCard.css'; // CSS for styling the card

// Base URL for media files from our backend
const MEDIA_BASE_URL = 'http://localhost:3001/media';

// The component receives a single 'meme' object as a prop
function MemeCard({ meme }) {

  // Helper function to render the correct media element (img or video)
  const renderMedia = () => {
    const mediaUrl = `${MEDIA_BASE_URL}/${meme.filename}`;

    switch (meme.type) {
      case 'image':
        return <img src={mediaUrl} alt={meme.title} loading="lazy" />; // Use lazy loading for images
      case 'gif':
        return <img src={mediaUrl} alt={meme.title} loading="lazy" />; // GIFs are also images
      case 'video':
        return (
          <video  controls // Add controls if you want play/pause buttons */
                  muted    // Mute by default to avoid autoplay noise */
                  loop = {false}     // Loop short videos/gifs? */
                 /* autoPlay // Autoplay on load? Use with caution */
                 playsInline /* Important for mobile */
                 src={mediaUrl}
                 title={meme.title} // Similar to alt text for videos
                 preload="metadata" // Load only metadata initially
                 >
              Your browser does not support the video tag.
          </video>
        );
      default:
        return <p>Unsupported media type</p>; // Fallback
    }
  };

  return (
    <div className="meme-card">
      <div className="meme-card-media">
        {renderMedia()} {/* Call helper function to render img or video */}
      </div>
      <div className="meme-card-info">
        <h3 className="meme-card-title">{meme.title}</h3>
        {/* Optional: Add description or tags later */}
        {/* <p className="meme-card-tags">Tags: {meme.tags}</p> */}
      </div>
      {/* Optional: Add overlay/buttons for actions on hover later */}
    </div>
  );
}

export default MemeCard;