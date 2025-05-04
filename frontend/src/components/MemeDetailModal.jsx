// frontend/src/components/MemeDetailModal.jsx
import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import './MemeDetailModal.css';
import './FavoriteButton.css';
import { useAuth, axiosInstance } from '../contexts/AuthContext';

// *** CORRECT THIS LINE ***
const MEDIA_BASE_URL = 'http://localhost:3001/media'; // Add /media here
// *** END CORRECTION ***

const API_BASE_URL = 'http://localhost:3001';

// --- Rest of the component remains the same ---

function MemeDetailModal({ meme, onClose, onVote, onFavoriteToggle }) {
  // --- DEBUG: Log initial props ---
  // console.log('[Modal Debug] Initial meme prop received:', meme);

  const { isAuthenticated, isFavorite, loadingFavorites, recordView } = useAuth();
  const [relatedTags, setRelatedTags] = useState([]);
  const [loadingRelatedTags, setLoadingRelatedTags] = useState(false);
  const navigate = useNavigate();
  const [isMediaReady, setIsMediaReady] = useState(false);

  // Fetch related tags
  useEffect(() => {
    const fetchRelatedTags = async () => {
      if (!meme?.id) {
        // console.log('[Modal Debug] Skipping related tags fetch: no meme.id');
        setRelatedTags([]);
        return;
      }
      // console.log(`[Modal Debug] Fetching related tags for meme id: ${meme.id}`);
      setLoadingRelatedTags(true);
      try {
        const response = await axiosInstance.get(`${API_BASE_URL}/api/memes/${meme.id}/related-tags`, { params: { limit: 5 } });
        // console.log('[Modal Debug] Related tags API response:', response.data);
        setRelatedTags(response.data?.relatedTags || []);
      } catch (error) {
        console.error("[Modal Debug] Failed to fetch related tags:", error);
        setRelatedTags([]);
      } finally {
        // console.log('[Modal Debug] Finished related tags fetch.');
        setLoadingRelatedTags(false);
      }
    };
    fetchRelatedTags();
  }, [meme?.id]);

  // Handle ESC key close
  useEffect(() => {
    const handleEsc = (event) => event.keyCode === 27 && onClose();
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  // Record view when modal opens
  useEffect(() => {
      if (meme?.id && isAuthenticated) {
          // console.log(`[Modal Debug] Recording view for meme id: ${meme.id}`);
          recordView(meme.id);
      } else {
          // console.log('[Modal Debug] Not recording view (meme missing, or not authenticated).');
      }
  }, [meme?.id, isAuthenticated, recordView]);

  // --- Reset media ready state when meme changes ---
  useEffect(() => {
      // console.log('[Modal Debug] Meme prop changed. Resetting isMediaReady.');
      setIsMediaReady(false);
      const timer = setTimeout(() => {
        // console.log('[Modal Debug] Setting isMediaReady to true after delay.');
        setIsMediaReady(true);
      }, 100); // Keep delay
      return () => clearTimeout(timer);
  }, [meme]);

  if (!meme) {
    // console.log('[Modal Debug] Meme prop is null or undefined. Rendering null.');
    return null;
  }

  const score = (meme.upvotes ?? 0) - (meme.downvotes ?? 0);
  const isCurrentlyFavorite = isFavorite(meme.id);

  const renderMedia = () => {
    const mediaUrl = `${MEDIA_BASE_URL}/${meme.filename}`; // This will now be correct
    const mediaKey = `${meme.id}-${meme.filename}`;

    // console.log(`[Modal Debug] renderMedia called. isMediaReady: ${isMediaReady}, mediaUrl: ${mediaUrl}`);

    if (!isMediaReady || !mediaUrl || !meme.filename) {
        // console.log('[Modal Debug] renderMedia returning placeholder.');
        return <div className="media-placeholder">Loading Media...</div>;
    }

    let mediaElement = null;
    switch (meme.type) {
      case 'image':
      case 'gif':
        // console.log(`[Modal Debug] renderMedia rendering <img> for ${mediaUrl}`);
        mediaElement = <img key={mediaKey} src={mediaUrl} alt={meme.title} />;
        break;
      case 'video':
        // console.log(`[Modal Debug] renderMedia rendering <video> for ${mediaUrl}`);
        mediaElement = (
            <video key={mediaKey} controls autoPlay playsInline muted loop src={mediaUrl} title={meme.title}>
                Video not supported.
            </video>
        );
        break;
      default:
        // console.log(`[Modal Debug] renderMedia rendering unsupported type for ${meme.type}`);
        mediaElement = <p>Unsupported media type</p>;
        break;
    }
    // console.log('[Modal Debug] renderMedia returning element:', mediaElement);
    return mediaElement;
  };

  // --- Event Handlers ---
  const handleContentClick = (event) => event.stopPropagation();
  const handleUpvote = (event) => { event.stopPropagation(); if(onVote) onVote(meme.id, 'upvote'); };
  const handleDownvote = (event) => { event.stopPropagation(); if(onVote) onVote(meme.id, 'downvote'); };
  const handleFavoriteButtonClick = (event) => { event.stopPropagation(); if (isAuthenticated && !loadingFavorites && onFavoriteToggle) onFavoriteToggle(meme.id); };
  const handleTagClick = (tag, event) => { event.stopPropagation(); onClose(); navigate(`/browse?tag=${encodeURIComponent(tag)}`); };

  const currentMemeTags = meme.tags ? meme.tags.split(',') : [];

  // console.log(`[Modal Debug] Rendering Modal. Meme ID: ${meme.id}, Filename: ${meme.filename}, Type: ${meme.type}`);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={handleContentClick}>
        <button className="modal-close-button" onClick={onClose} aria-label="Close modal">×</button>

        <div className="modal-media">
            {/* {console.log("[Modal Debug] Inserting media element into modal-media div.")} */}
            {renderMedia()}
        </div>

        <div className="modal-info">
          <h2>{meme.title || 'Untitled Meme'}</h2>
          {meme.description && <p className="modal-description">{meme.description}</p>}

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

          <div className="modal-fav-button-container">
              {isAuthenticated && (
                  <button
                      className={`favorite-button modal-fav-button-inline ${isCurrentlyFavorite ? 'is-favorite' : ''}`}
                      onClick={handleFavoriteButtonClick}
                      title={isCurrentlyFavorite ? "Remove from My List" : "Add to My List"}
                      disabled={loadingFavorites}
                      aria-label={isCurrentlyFavorite ? "Remove from My List" : "Add to My List"}
                  >
                      {isCurrentlyFavorite ? '❤️' : '♡'}
                  </button>
              )}
          </div>

          <div className="modal-actions">
             <button className="vote-button upvote" onClick={handleUpvote} aria-label="Upvote">😂 <span className="vote-count">{meme.upvotes ?? 0}</span></button>
             <span className="score" aria-label={`Current score ${score}`}>Score: {score}</span>
             <button className="vote-button downvote" onClick={handleDownvote} aria-label="Downvote">😑 <span className="vote-count">{meme.downvotes ?? 0}</span></button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default MemeDetailModal;