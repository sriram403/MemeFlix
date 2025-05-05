// frontend/src/components/MemeDetailModal.jsx
import React, { useEffect, useState, useCallback, useId } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast, ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import './MemeDetailModal.css';
import './FavoriteButton.css';
import { useAuth, axiosInstance } from '../contexts/AuthContext';

const MEDIA_BASE_URL = 'http://localhost:3001/media';
const API_BASE_URL = 'http://localhost:3001';
const FRONTEND_BASE_URL = window.location.origin;

function MemeDetailModal({ meme, onClose, onVote, onFavoriteToggle }) {
  // *** Get getUserVoteStatus from context ***
  const { isAuthenticated, isFavorite, loadingFavorites, recordView, getUserVoteStatus } = useAuth();
  const [relatedTags, setRelatedTags] = useState([]);
  const [loadingRelatedTags, setLoadingRelatedTags] = useState(false);
  const navigate = useNavigate();
  const [isMediaReady, setIsMediaReady] = useState(false);
  const modalTitleId = useId();
  const modalDescriptionId = useId();

  // Fetch related tags (Unchanged)
  useEffect(() => { const fetchRelatedTags = async () => { if (!meme?.id) { setRelatedTags([]); return; } setLoadingRelatedTags(true); try { const response = await axiosInstance.get(`${API_BASE_URL}/api/memes/${meme.id}/related-tags`, { params: { limit: 5 } }); setRelatedTags(response.data?.relatedTags || []); } catch (error) { console.error("Failed to fetch related tags:", error); setRelatedTags([]); } finally { setLoadingRelatedTags(false); } }; fetchRelatedTags(); }, [meme?.id]);
  // Handle ESC key close (Unchanged)
  useEffect(() => { const handleEsc = (event) => event.keyCode === 27 && onClose(); window.addEventListener('keydown', handleEsc); return () => window.removeEventListener('keydown', handleEsc); }, [onClose]);
  // Record view when modal opens (Unchanged)
  useEffect(() => { if (meme?.id && isAuthenticated) { recordView(meme.id); } }, [meme?.id, isAuthenticated, recordView]);
  // Reset media ready state (Unchanged)
  useEffect(() => { setIsMediaReady(false); const timer = setTimeout(() => setIsMediaReady(true), 50); return () => clearTimeout(timer); }, [meme?.id]);


  if (!meme) return null;

  // --- Get current vote status for styling ---
  const currentUserVote = getUserVoteStatus(meme.id); // 1, -1, or 0

  const score = (meme.upvotes ?? 0) - (meme.downvotes ?? 0);
  const isCurrentlyFavorite = isFavorite(meme.id);

  // renderMedia (Unchanged)
  const renderMedia = () => { const mediaUrl = `${MEDIA_BASE_URL}/${meme.filename}`; const mediaKey = `${meme.id}-${meme.filename}`; if (!isMediaReady || !mediaUrl || !meme.filename) { return <div className="media-placeholder" role="status">Loading Media...</div>; } switch (meme.type) { case 'image': case 'gif': return <img key={mediaKey} src={mediaUrl} alt={meme.title} />; case 'video': return ( <video key={mediaKey} controls autoPlay playsInline muted loop src={mediaUrl} title={meme.title}> Video not supported. </video> ); default: return <p>Unsupported media type</p>; } };

  // Event Handlers (Unchanged)
  const handleContentClick = (event) => event.stopPropagation();
  const handleUpvote = (event) => { event.stopPropagation(); if(onVote) onVote(meme.id, 'upvote'); };
  const handleDownvote = (event) => { event.stopPropagation(); if(onVote) onVote(meme.id, 'downvote'); };
  const handleFavoriteButtonClick = (event) => { event.stopPropagation(); if (isAuthenticated && !loadingFavorites && onFavoriteToggle) onFavoriteToggle(meme.id); };
  const handleTagClick = (tag, event) => { event.stopPropagation(); onClose(); navigate(`/browse?tag=${encodeURIComponent(tag)}`); };
  const handleCopyLink = useCallback((event) => { event.stopPropagation(); if (!meme || !meme.id) { toast.error('Cannot copy link, meme data missing.', { theme: "dark" }); return; } const memeLinkQuery = `openMemeId=${meme.id}`; const urlToCopy = `${FRONTEND_BASE_URL}/browse?${memeLinkQuery}`; navigator.clipboard.writeText(urlToCopy).then(() => { toast.success('Link copied!', { theme: "dark", autoClose: 2000 }); }).catch(err => { console.error('Failed to copy link: ', err); toast.error('Could not copy link.', { theme: "dark" }); }); }, [meme?.id]);

  const currentMemeTags = meme.tags ? meme.tags.split(',') : [];

  return (
    <div className="modal-overlay" onClick={onClose} role="presentation">
       <ToastContainer position="bottom-center" autoClose={2000} hideProgressBar={true} newestOnTop={false} closeOnClick rtl={false} pauseOnFocusLoss draggable pauseOnHover theme="dark" />
      <div className="modal-content" onClick={handleContentClick} role="dialog" aria-modal="true" aria-labelledby={modalTitleId} aria-describedby={meme.description ? modalDescriptionId : undefined} tabIndex="-1" >
        <button className="modal-close-button" onClick={onClose} aria-label="Close modal">×</button>
        <div className="modal-media" role="figure">{renderMedia()}</div>
        <div className="modal-info">
          <h2 id={modalTitleId}>{meme.title || 'Untitled Meme'}</h2>
          {meme.description && <p className="modal-description" id={modalDescriptionId}>{meme.description}</p>}

          <div className="modal-tags-section" aria-label="Meme Tags">
             {currentMemeTags.length > 0 && ( <div className="modal-tags-container"> <span className="tags-label" aria-hidden="true">Tags:</span> {currentMemeTags.map(tag => (<button key={tag} className="tag-button" onClick={(e) => handleTagClick(tag, e)}> {tag} </button>))} </div> )}
             {!loadingRelatedTags && relatedTags.length > 0 && ( <div className="modal-tags-container related-tags-container" aria-label="Related Tags"> <span className="tags-label" aria-hidden="true">Related:</span> {relatedTags.map(tag => (<button key={tag} className="tag-button related-tag" onClick={(e) => handleTagClick(tag, e)}> {tag} </button>))} </div> )}
             {loadingRelatedTags && <div className="related-tags-loading" role="status">Loading related tags...</div>}
          </div>

          <div className="modal-actions" role="toolbar" aria-label="Meme Actions">
             {/* --- Add 'active' class based on currentUserVote --- */}
             <button
                className={`vote-button upvote ${currentUserVote === 1 ? 'vote-button--active' : ''}`}
                onClick={handleUpvote}
                aria-pressed={currentUserVote === 1} // Indicate pressed state
                aria-label={`Upvote meme. Current upvotes: ${meme.upvotes ?? 0}`}
              >
                😂 <span className="vote-count" aria-hidden="true">{meme.upvotes ?? 0}</span>
             </button>

             <span className="score" aria-label={`Current score ${score}`} role="status">Score: {score}</span>

             {/* --- Add 'active' class based on currentUserVote --- */}
             <button
                className={`vote-button downvote ${currentUserVote === -1 ? 'vote-button--active' : ''}`}
                onClick={handleDownvote}
                aria-pressed={currentUserVote === -1} // Indicate pressed state
                aria-label={`Downvote meme. Current downvotes: ${meme.downvotes ?? 0}`}
              >
                 😑 <span className="vote-count" aria-hidden="true">{meme.downvotes ?? 0}</span>
             </button>

             {isAuthenticated && ( <button className={`favorite-button modal-fav-button-action ${isCurrentlyFavorite ? 'is-favorite' : ''}`} onClick={handleFavoriteButtonClick} title={isCurrentlyFavorite ? "Remove from My List" : "Add to My List"} disabled={loadingFavorites} aria-label={isCurrentlyFavorite ? "Remove from My List" : "Add to My List"}> {isCurrentlyFavorite ? '❤️' : '♡'} </button> )}
             <button className="action-button share-button" onClick={handleCopyLink} title="Copy Link" aria-label="Copy link to clipboard">🔗</button>
          </div>

        </div>
      </div>
    </div>
  );
}

export default MemeDetailModal;