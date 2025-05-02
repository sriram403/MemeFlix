// frontend/src/components/MemeRow.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import MemeCard from './MemeCard';
import './MemeRow.css';

// Props: title, tag OR fetchUrl, onMemeClick, onVote, onFavoriteToggle
function MemeRow({ title, tag, fetchUrl, onMemeClick, onVote, onFavoriteToggle }) {
    const [memes, setMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchRowMemes = useCallback(async () => {
        let urlToFetch = '';
        const params = { limit: 15 }; // Default limit for rows

        if (fetchUrl) {
            urlToFetch = fetchUrl; // Use direct URL if provided
            // Params might be already in fetchUrl, or could add more here
        } else if (tag) {
            urlToFetch = `/api/memes/tag/${encodeURIComponent(tag)}`; // Fetch by tag
            // params object already contains limit
        } else {
            // No tag or URL provided - cannot fetch
            setLoading(false);
            setError(`No data source (tag or fetchUrl) provided for row "${title}".`);
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const response = await axiosInstance.get(urlToFetch, { params });
            setMemes(response.data.memes || response.data || []);
        } catch (err) {
            console.error(`Error fetching memes for row "${title}" (${urlToFetch}):`, err);
            setError(`Could not load row for "${title}"`);
            setMemes([]);
        } finally {
            setLoading(false);
        }
    // Depend on tag OR fetchUrl
    }, [tag, fetchUrl, title, axiosInstance]);

    useEffect(() => {
        fetchRowMemes();
    }, [fetchRowMemes]);

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