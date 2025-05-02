// frontend/src/components/MemeRow.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import MemeCard from './MemeCard';
import './MemeRow.css';

// Props: title, tag (e.g., 'funny'), onMemeClick, onVote, onFavoriteToggle
function MemeRow({ title, tag, onMemeClick, onVote, onFavoriteToggle }) {
    const [memes, setMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Fetch memes specifically by tag
    const fetchMemesByTag = useCallback(async () => {
        if (!tag) { // Don't fetch if no tag provided
            setLoading(false);
            setError("No tag provided for row.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // Use the tag-specific API endpoint
            const response = await axiosInstance.get(`/api/memes/tag/${encodeURIComponent(tag)}`, {
                params: { limit: 15 } // Fetch limit for row display
            });
            // Expecting { memes: [...] } structure from backend
            setMemes(response.data.memes || []);
        } catch (err) {
            console.error(`Error fetching memes for tag "${tag}":`, err);
            setError(`Could not load row for "${title}"`);
            setMemes([]);
        } finally {
            setLoading(false);
        }
    }, [tag, title, axiosInstance]); // Depend on the tag

    useEffect(() => {
        fetchMemesByTag();
    }, [fetchMemesByTag]);

    // Don't render row if error or empty after loading
    if (error) return null;
    if (!loading && memes.length === 0) return null;

    return (
        <div className="meme-row-container">
            <h2 className="meme-row-title">{title}</h2>
            {loading ? (
                <div className="loading-row">Loading...</div>
            ) : (
                <div className="meme-row">
                    {memes.map(meme => (
                        <MemeCard
                            key={meme.id}
                            meme={meme}
                            onCardClick={onMemeClick}
                            onVote={onVote}
                            onFavoriteToggle={onFavoriteToggle}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default MemeRow;