// frontend/src/components/MemeCard.jsx
import React from 'react';
// No longer needs axios here
import './MemeCard.css';

const MEDIA_BASE_URL = 'http://localhost:3001/media';
// API_BASE_URL removed - voting handled by prop

// Receive meme, onCardClick, and onVote props
function MemeCard({ meme, onCardClick, onVote }) {

  // Calculate score (upvotes/downvotes come from the meme prop)
  const score = meme.upvotes - meme.downvotes;

  // --- Voting Handlers ---
  // These now call the onVote prop passed from App
  const handleUpvote = (event) => {
    event.stopPropagation(); // Prevent card click
    onVote(meme.id, 'upvote'); // Call parent handler with ID and type
  };

  const handleDownvote = (event) => {
    event.stopPropagation(); // Prevent card click
    onVote(meme.id, 'downvote'); // Call parent handler with ID and type
  };

  // --- Media Rendering ---
  const renderMedia = () => {
    const mediaUrl = `${MEDIA_BASE_URL}/${meme.filename}`;
    switch (meme.type) {
      case 'image':
      case 'gif':
        return <img src={mediaUrl} alt={meme.title} loading="lazy" />;
      case 'video':
        return (
          <video controls muted loop={false} playsInline src={mediaUrl} title={meme.title} preload="metadata">
              Your browser does not support the video tag.
          </video>
        );
      default:
        return <p>Unsupported media type</p>;
    }
  };

  // --- Card Click Handler ---
  const handleCardClick = () => {
    // Only call if onCardClick is actually provided (it should be)
    if (onCardClick) {
       onCardClick(meme);
    }
  };

  return (
    <div className="meme-card" onClick={handleCardClick}>
      <div className="meme-card-media">
        {renderMedia()}
      </div>
      <div className="meme-card-info">
        <h3 className="meme-card-title">{meme.title}</h3>
        {/* Use vote counts directly from the meme prop */}
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