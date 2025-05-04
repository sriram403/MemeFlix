// frontend/src/components/MemeDetailModal.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom'; // Import useNavigate
import './MemeDetailModal.css';
import './FavoriteButton.css'; // Keep base styles
import { useAuth, axiosInstance } from '../contexts/AuthContext';

const MEDIA_BASE_URL = 'http://localhost:3001/media';
const API_BASE_URL = 'http://localhost:3001'; // Define API base URL

function MemeDetailModal({ meme, onClose, onVote, onFavoriteToggle }) {
  const { isAuthenticated, isFavorite, loadingFavorites, recordView } = useAuth();
  const [relatedTags, setRelatedTags] = useState([]);
  const [loadingRelatedTags, setLoadingRelatedTags] = useState(false);
  const navigate = useNavigate(); // Initialize navigate
  const [isMediaReady, setIsMediaReady] = useState(false);

  // Fetch related tags when the meme prop changes
  useEffect(() => {
    const fetchRelatedTags = async () => {
      if (!meme?.id) {
        setRelatedTags([]);
        return;
      }
      setLoadingRelatedTags(true);
      try {
        const response = await axiosInstance.get(`${API_BASE_URL}/api/memes/${meme.id}/related-tags`, { params: { limit: 5 } });
        setRelatedTags(response.data?.relatedTags || []);
      } catch (error) {
        console.error("Failed to fetch related tags:", error);
        setRelatedTags([]); // Clear on error
      } finally {
        setLoadingRelatedTags(false);
      }
    };

    fetchRelatedTags();
  }, [meme?.id]); // Dependency on meme.id

  // Handle ESC key close
  useEffect(() => {
    const handleEsc = (event) => event.keyCode === 27 && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Record view when modal opens (logic unchanged)
  useEffect(() => {
      if (meme?.id && isAuthenticated) {
          recordView(meme.id);
      }
  }, [meme?.id, isAuthenticated, recordView]);

  // Reset media ready state when meme changes
   useEffect(() => {
      setIsMediaReady(false);
      const timer = setTimeout(() => setIsMediaReady(true), 100);
      return () => clearTimeout(timer);
   }, [meme]);


  if (!meme) return null;

  const score = (meme.upvotes ?? 0) - (meme.downvotes ?? 0);
  const isCurrentlyFavorite = isFavorite(meme.id);

  const renderMedia = () => {
    const mediaUrl = `${MEDIA_BASE_URL}/${meme.filename}`;
    const mediaKey = `${meme.id}-${meme.filename}`;
    if (!isMediaReady || !mediaUrl || !meme.filename) {
        return <div className="media-placeholder">Loading Media...</div>;
    }
    switch (meme.type) {
      case 'image': case 'gif': return <img key={mediaKey} src={mediaUrl} alt={meme.title} />;
      case 'video': return ( <video key={mediaKey} controls autoPlay playsInline muted loop src={mediaUrl} title={meme.title}> Video not supported. </video> );
      default: return <p>Unsupported media type</p>;
    }
  };

  // --- Event Handlers ---
  const handleContentClick = (event) => event.stopPropagation();
  const handleUpvote = (event) => { event.stopPropagation(); if(onVote) onVote(meme.id, 'upvote'); };
  const handleDownvote = (event) => { event.stopPropagation(); if(onVote) onVote(meme.id, 'downvote'); };
  const handleFavoriteButtonClick = (event) => { event.stopPropagation(); if (isAuthenticated && !loadingFavorites && onFavoriteToggle) onFavoriteToggle(meme.id); };
  const handleTagClick = (tag, event) => { event.stopPropagation(); onClose(); navigate(`/browse?tag=${encodeURIComponent(tag)}`); };

  const currentMemeTags = meme.tags ? meme.tags.split(',') : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={handleContentClick}>
        <button className="modal-close-button" onClick={onClose} aria-label="Close modal">×</button>

        <div className="modal-media">{renderMedia()}</div>

        <div className="modal-info">
          <h2>{meme.title || 'Untitled Meme'}</h2>
          {meme.description && <p className="modal-description">{meme.description}</p>}

          {/* Tags Section */}
          <div className="modal-tags-section">
            {currentMemeTags.length > 0 && (
              <div className="modal-tags-container">
                <span className="tags-label">Tags:</span>
                {currentMemeTags.map(tag => (
                  <button key={tag} className="tag-button" onClick={(e) => handleTagClick(tag, e)}>
                    {tag}
                  </button>
                ))}
              </div>
            )}
            {!loadingRelatedTags && relatedTags.length > 0 && (
              <div className="modal-tags-container related-tags-container">
                 <span className="tags-label">Related:</span>
                 {relatedTags.map(tag => (
                     <button key={tag} className="tag-button related-tag" onClick={(e) => handleTagClick(tag, e)}>
                         {tag}
                     </button>
                 ))}
              </div>
            )}
            {loadingRelatedTags && <div className="related-tags-loading">Loading related tags...</div>}
          </div>
          {/* --- End Tags Section --- */}

          {/* --- REMOVED Favorite Button Container --- */}


          {/* --- Updated Vote Actions --- */}
          <div className="modal-actions">
             {/* Upvote Button */}
             <button className="vote-button upvote" onClick={handleUpvote} aria-label="Upvote">
               😂 <span className="vote-count">{meme.upvotes ?? 0}</span>
             </button>

             {/* Score */}
             <span className="score" aria-label={`Current score ${score}`}>Score: {score}</span>

             {/* Downvote Button */}
             <button className="vote-button downvote" onClick={handleDownvote} aria-label="Downvote">
               😑 <span className="vote-count">{meme.downvotes ?? 0}</span>
             </button>

             {/* --- MOVED Favorite Button Here --- */}
              {isAuthenticated && (
                  <button
                      className={`favorite-button modal-fav-button-action ${isCurrentlyFavorite ? 'is-favorite' : ''}`} // Use a new class for context
                      onClick={handleFavoriteButtonClick}
                      title={isCurrentlyFavorite ? "Remove from My List" : "Add to My List"}
                      disabled={loadingFavorites}
                      aria-label={isCurrentlyFavorite ? "Remove from My List" : "Add to My List"}
                  >
                      {isCurrentlyFavorite ? '❤️' : '♡'}
                  </button>
              )}
              {/* --- End Moved Favorite Button --- */}
          </div>

        </div> {/* End modal-info */}
      </div> {/* End modal-content */}
    </div> /* End modal-overlay */
  );
}

export default MemeDetailModal;