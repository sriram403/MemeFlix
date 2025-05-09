// frontend/src/components/MemeRow.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import MemeCard from './MemeCard';
import Spinner from './Spinner';
import './MemeRow.css';

// *** Rename prop to isMemeViewedCheck ***
function MemeRow({ title, memes, isLoading, onMemeClick, onFavoriteToggle, isMemeViewedCheck }) {
    const rowRef = useRef(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true);

    // checkScroll and useEffect (Unchanged)
    const checkScroll = useCallback(() => { const el = rowRef.current; if (el) { const isScrollable = el.scrollWidth > el.clientWidth; setShowLeftArrow(isScrollable && el.scrollLeft > 10); setShowRightArrow(isScrollable && el.scrollWidth - el.clientWidth - el.scrollLeft > 10); } else { setShowLeftArrow(false); setShowRightArrow(false); } }, []);
    useEffect(() => { const el = rowRef.current; if (el) { checkScroll(); window.addEventListener('resize', checkScroll); const observer = new MutationObserver(checkScroll); observer.observe(el, { childList: true, subtree: true }); return () => { window.removeEventListener('resize', checkScroll); observer.disconnect(); }; } }, [memes, isLoading, checkScroll]);
    const scroll = (direction) => { const el = rowRef.current; if (el) { const scrollAmount = el.clientWidth * 0.8; el.scrollBy({ left: direction === 'left' ? -scrollAmount : scrollAmount, behavior: 'smooth' }); } };

    if (isLoading) {
        return (
            <div className="meme-row-container">
                <h2 className="meme-row-title">{title}</h2>
                <div className="loading-row-placeholder"> <Spinner size="medium" /> </div>
            </div>
        );
    }

    if (!memes || memes.length === 0) { return null; }

    return (
        <div className="meme-row-container with-scroll-controls">
            <h2 className="meme-row-title">{title}</h2>
            <div className="meme-row-wrapper">
                {showLeftArrow && ( <button className="scroll-arrow left-arrow" onClick={() => scroll('left')} aria-label={`Scroll ${title} left`}>‹</button> )}
                <div className="meme-row" ref={rowRef} onScroll={checkScroll}>
                    {memes.map(meme => (
                        <MemeCard
                            key={meme.id}
                            meme={meme}
                            onCardClick={onMemeClick}
                            onFavoriteToggle={onFavoriteToggle}
                            // *** Call isMemeViewedCheck with the meme object ***
                            // meme.is_viewed comes from backend, isMemeViewedCheck checks session state too
                            isViewed={isMemeViewedCheck ? isMemeViewedCheck(meme) : !!meme.is_viewed}
                        />
                    ))}
                </div>
                 {showRightArrow && ( <button className="scroll-arrow right-arrow" onClick={() => scroll('right')} aria-label={`Scroll ${title} right`}>›</button> )}
            </div>
        </div>
    );
}

export default MemeRow;