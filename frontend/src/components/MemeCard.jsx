import React from 'react';
import './MemeCard.css'; // CSS for styling the card
import axios from 'axios'; // Import axios for voting API calls

// Base URL for media files from our backend
const MEDIA_BASE_URL = 'http://localhost:3001/media';
const API_BASE_URL = 'http://localhost:3001'; // For voting API

// The component receives a single 'meme' object as a prop
function MemeCard({ meme , onCardClick }) {

  // Calculate score (can be done directly in JSX too)
  const score = meme.upvotes - meme.downvotes;

  // --- Voting Handlers ---
  const handleUpvote = async (event) => {
    event.stopPropagation(); // Prevent card click when clicking button
    try {
      // Send POST request to backend upvote endpoint
      await axios.post(`${API_BASE_URL}/api/memes/${meme.id}/upvote`);
      // TODO: Optimistically update UI or re-fetch data for immediate feedback
      console.log(`Upvoted meme ${meme.id}`);
      // Note: Score won't update visually until next data fetch without extra logic
    } catch (error) {
      console.error("Error upvoting meme:", error);
      // TODO: Show error to user
    }
  };

  const handleDownvote = async (event) => {
    event.stopPropagation(); // Prevent card click
    try {
      await axios.post(`${API_BASE_URL}/api/memes/${meme.id}/downvote`);
      console.log(`Downvoted meme ${meme.id}`);
      // TODO: Optimistic UI update or re-fetch
    } catch (error) {
      console.error("Error downvoting meme:", error);
        // TODO: Show error to user
    }
  };

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
  const handleCardClick = () => {
    // Call the function passed down from App (via MemeGrid)
    // Pass this card's specific meme data back up
    onCardClick(meme);
  };
  
  return (
    // Add onClick handler to the main card div
    <div className="meme-card" onClick={handleCardClick}>
      <div className="meme-card-media">
        {renderMedia()}
      </div>
      <div className="meme-card-info">
        <h3 className="meme-card-title">{meme.title}</h3>
        <div className="meme-card-actions">
           <button className="vote-button upvote" onClick={handleUpvote}>
             👍 <span className="vote-count">{meme.upvotes}</span>
           </button>
           <span className="score">Score: {score}</span>
           <button className="vote-button downvote" onClick={handleDownvote}>
             👎 <span className="vote-count">{meme.downvotes}</span>
           </button>
        </div>
      </div>
    </div>
  );
}

export default MemeCard;