// frontend/src/components/MemeDetailModal.jsx
import React, { useEffect } from 'react';
// No longer needs axios here
import './MemeDetailModal.css'; // Ensure CSS is imported

const MEDIA_BASE_URL = 'http://localhost:3001/media';
// API_BASE_URL removed

// Props: meme, onClose, onVote
function MemeDetailModal({ meme, onClose, onVote }) {

  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) {
       onClose();
      }
    };
    window.addEventListener('keydown', handleEsc);
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]);

  if (!meme) {
    return null; // Render nothing if no meme is selected
  }

  // --- Media Rendering ---
  const renderMedia = () => {
    const mediaUrl = `${MEDIA_BASE_URL}/${meme.filename}`;
    switch (meme.type) {
      case 'image':
      case 'gif':
        return <img src={mediaUrl} alt={meme.title} />;
      case 'video':
        return (
          <video controls autoPlay playsInline muted loop src={mediaUrl} title={meme.title}>
              Your browser does not support the video tag.
          </video>
        );
      default:
        return <p>Unsupported media type</p>;
    }
  };

  // Prevent clicks inside content from closing modal
  const handleContentClick = (event) => {
      event.stopPropagation();
  };

  // --- Voting Handlers (call prop) ---
   const handleUpvote = (event) => {
    event.stopPropagation(); // Prevent clicks bubbling up
    onVote(meme.id, 'upvote'); // Call handler from App
  };

  const handleDownvote = (event) => {
    event.stopPropagation();
    onVote(meme.id, 'downvote'); // Call handler from App
  };

  // Calculate score from the current meme prop
  const score = meme.upvotes - meme.downvotes;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={handleContentClick}>
        <button className="modal-close-button" onClick={onClose}>×</button>

        <div className="modal-media">
          {renderMedia()}
        </div>

        <div className="modal-info">
          <h2>{meme.title}</h2>
          {meme.description && <p className="modal-description">{meme.description}</p>}
          {meme.tags && <p className="modal-tags">Tags: {meme.tags}</p>}

          {/* --- Voting Section Added to Modal --- */}
          <div className="modal-actions">
            <button className="vote-button upvote" onClick={handleUpvote}>
              👍 <span className="vote-count">{meme.upvotes}</span>
            </button>
            <span className="score">Score: {score}</span>
            <button className="vote-button downvote" onClick={handleDownvote}>
              👎 <span className="vote-count">{meme.downvotes}</span>
            </button>
             {/* Add other actions like sharing later? */}
          </div>
          {/* --- End Voting Section --- */}

        </div>
      </div>
    </div>
  );
}

export default MemeDetailModal;