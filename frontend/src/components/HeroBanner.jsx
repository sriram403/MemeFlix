// frontend/src/components/HeroBanner.jsx
import React from 'react';
import './HeroBanner.css';

const MEDIA_BASE_URL = 'http://localhost:3001/media';

// Props:
// - featuredMeme: The meme object designated as featured
// - onPlayClick: Optional function to handle clicking a play button
function HeroBanner({ featuredMeme, onPlayClick }) {

  // If no meme is provided, don't render the banner
  if (!featuredMeme) {
    return null;
  }

  const backgroundImageUrl = `${MEDIA_BASE_URL}/${featuredMeme.filename}`;
  const isVideo = featuredMeme.type === 'video';

  // Style for the banner's background image/gradient
  // Using inline styles here for dynamic background image
  const bannerStyle = {
      // Set background image only if it's not a video (or provide a fallback image?)
      backgroundImage: !isVideo
          ? `linear-gradient(to right, rgba(0, 0, 0, 0.8) 20%, rgba(0, 0, 0, 0) 80%), url(${backgroundImageUrl})`
          : 'linear-gradient(to right, rgba(0, 0, 0, 0.8) 20%, rgba(0, 0, 0, 0) 80%)', // Only gradient for videos
      // If it IS a video, maybe we display the video element itself instead/as well? Or just info?
  };


  return (
    <div className="hero-banner" style={bannerStyle}>
      <div className="hero-content">
        <h1 className="hero-title">{featuredMeme.title}</h1>
        {/* Optional: Add description */}
        {/* <p className="hero-description">{featuredMeme.description}</p> */}
        <div className="hero-buttons">
          {/* If it's a video, maybe show a "Play" button that opens the modal */}
          {/* We'll pass the onPlayClick handler down from App */}
          {isVideo && (
              <button className="hero-button play-button" onClick={() => onPlayClick(featuredMeme)}>
                  ▶ Play
              </button>
          )}
          {/* Add other buttons later? e.g., More Info (opens modal) */}
           <button className="hero-button info-button" onClick={() => onPlayClick(featuredMeme)}>
               More Info
           </button>
        </div>
      </div>
      {/* Optional: We could embed the video directly here instead of just a background */}
      {/* {isVideo && (
           <video className="hero-video-background" autoPlay muted loop src={backgroundImageUrl}></video>
       )} */}
    </div>
  );
}

export default HeroBanner;