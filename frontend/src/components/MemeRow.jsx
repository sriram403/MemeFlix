import React from 'react';
import MemeCard from './MemeCard';
import './MemeRow.css';

// Props: title, memes (array), isLoading, onMemeClick, onVote, onFavoriteToggle
function MemeRow({ title, memes, isLoading, onMemeClick, onVote, onFavoriteToggle }) {

    // No internal state or fetching needed anymore

    // Render loading state if parent indicates
    if (isLoading) {
         return (
             <div className="meme-row-container">
                <h2 className="meme-row-title">{title}</h2>
                <div className="loading-row">Loading...</div>
            </div>
         );
    }

    // Don't render if no memes provided (after loading)
    if (!memes || memes.length === 0) {
        return null;
    }

    return (
        <div className="meme-row-container">
            <h2 className="meme-row-title">{title}</h2>
            <div className="meme-row">
                {memes.map(meme => (
                    <MemeCard
                        key={meme.id}
                        meme={meme}
                        onCardClick={onMemeClick}
                        // onVote prop is REMOVED - voting handled via modal/search grid
                        onFavoriteToggle={onFavoriteToggle}
                    />
                ))}
            </div>
        </div>
    );
}

export default MemeRow;