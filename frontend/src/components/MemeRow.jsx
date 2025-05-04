// frontend/src/components/MemeRow.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import MemeCard from './MemeCard';
import './MemeRow.css';

function MemeRow({ title, memes, isLoading, onMemeClick, onFavoriteToggle }) {
    const rowRef = useRef(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(true); // Assume show right initially

    const checkScroll = useCallback(() => {
        const el = rowRef.current;
        if (el) {
            const isScrollable = el.scrollWidth > el.clientWidth;
            setShowLeftArrow(isScrollable && el.scrollLeft > 10); // Show if scrolled slightly
            // Show right arrow if not scrolled all the way to the end
            setShowRightArrow(isScrollable && el.scrollWidth - el.clientWidth - el.scrollLeft > 10);
        } else {
            setShowLeftArrow(false);
            setShowRightArrow(false);
        }
    }, []); // No dependencies needed initially, relies on ref.current

    useEffect(() => {
        const el = rowRef.current;
        if (el) {
            // Check initially and on resize
            checkScroll();
            window.addEventListener('resize', checkScroll);
            // Check when memes data changes might affect scrollWidth
            const observer = new MutationObserver(checkScroll);
            observer.observe(el, { childList: true, subtree: true });


            return () => {
                window.removeEventListener('resize', checkScroll);
                observer.disconnect();
            };
        }
    }, [memes, isLoading, checkScroll]); // Re-run if memes/loading changes

    const scroll = (direction) => {
        const el = rowRef.current;
        if (el) {
            // Calculate scroll amount (e.g., 80% of viewport width)
            const scrollAmount = el.clientWidth * 0.8;
            el.scrollBy({
                left: direction === 'left' ? -scrollAmount : scrollAmount,
                behavior: 'smooth'
            });
            // We don't call checkScroll immediately here,
            // let the onScroll event handler update the state after scrolling finishes.
        }
    };

    if (isLoading) {
        return (
            <div className="meme-row-container">
                <h2 className="meme-row-title">{title}</h2>
                <div className="loading-row">Loading...</div>
            </div>
        );
    }

    if (!memes || memes.length === 0) {
        return null;
    }

    return (
        <div className="meme-row-container with-scroll-controls"> {/* Add class for context */}
            <h2 className="meme-row-title">{title}</h2>
            <div className="meme-row-wrapper"> {/* Added wrapper for button positioning */}
                {showLeftArrow && (
                    <button
                        className="scroll-arrow left-arrow"
                        onClick={() => scroll('left')}
                        aria-label={`Scroll ${title} left`}
                    >
                        ‹
                    </button>
                )}
                <div
                    className="meme-row"
                    ref={rowRef}
                    onScroll={checkScroll} // Update arrows during/after scroll
                 >
                    {memes.map(meme => (
                        <MemeCard
                            key={meme.id}
                            meme={meme}
                            onCardClick={onMemeClick}
                            onFavoriteToggle={onFavoriteToggle}
                        />
                    ))}
                </div>
                 {showRightArrow && (
                    <button
                        className="scroll-arrow right-arrow"
                        onClick={() => scroll('right')}
                        aria-label={`Scroll ${title} right`}
                    >
                        ›
                    </button>
                )}
            </div>
        </div>
    );
}

export default MemeRow;