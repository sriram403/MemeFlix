import React, { useEffect } from 'react';
import './MemeDetailModal.css'; // CSS for the modal

const MEDIA_BASE_URL = 'http://localhost:3001/media';

// Props:
// - meme: The meme object to display (contains filename, title, type, etc.)
// - onClose: A function passed from App.jsx to call when the modal should close
function MemeDetailModal({ meme, onClose }) {

  // Effect to listen for Escape key press to close the modal
  useEffect(() => {
    const handleEsc = (event) => {
      if (event.keyCode === 27) { // 27 is the keycode for Escape
       onClose(); // Call the onClose function passed from App
      }
    };
    // Add event listener when the modal mounts
    window.addEventListener('keydown', handleEsc);

    // Cleanup function: Remove event listener when the modal unmounts
    return () => {
      window.removeEventListener('keydown', handleEsc);
    };
  }, [onClose]); // Re-run effect if onClose changes (though it likely won't)


  // If no meme is provided (e.g., modal is told to render but no meme selected), render nothing
  if (!meme) {
    return null;
  }

  // Function to render the media (similar to MemeCard, but potentially larger/different controls)
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
        ); // Added autoplay/loop/muted maybe for modal view
      default:
        return <p>Unsupported media type</p>;
    }
  };

  // Prevent clicks inside the modal content from closing the modal
  const handleContentClick = (event) => {
      event.stopPropagation();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={handleContentClick}>
        <button className="modal-close-button" onClick={onClose}>×</button>

        {/* Media container */}
        <div className="modal-media">
          {renderMedia()}
        </div>

        {/* --- NEW: Info container --- */}
        <div className="modal-info">
          <h2>{meme.title}</h2>
          {/* Add description or other details */}
          {meme.description && <p className="modal-description">{meme.description}</p>}
          {meme.tags && <p className="modal-tags">Tags: {meme.tags}</p>}
        </div>

      </div>
    </div>
  );
}

export default MemeDetailModal;