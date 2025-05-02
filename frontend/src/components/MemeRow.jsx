// frontend/src/components/MemeRow.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import MemeCard from './MemeCard';
import './MemeRow.css';

// Removed onVote prop
function MemeRow({ title, tag, fetchUrl, onMemeClick, onFavoriteToggle }) {
    const [memes, setMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchRowMemes = useCallback(async () => {
        let urlToFetch = '';
        const params = { limit: 15 };
        if (fetchUrl) { urlToFetch = fetchUrl; }
        else if (tag) { urlToFetch = `/api/memes/tag/${encodeURIComponent(tag)}`; }
        else { setLoading(false); setError(`No source for row "${title}".`); return; }

        setLoading(true); setError(null);
        try {
            const response = await axiosInstance.get(urlToFetch, { params });
            setMemes(response.data.memes || response.data || []);
        } catch (err) {
            console.error(`Error fetching for row "${title}":`, err);
            setError(`Could not load row.`); setMemes([]);
        } finally { setLoading(false); }
    }, [tag, fetchUrl, title, axiosInstance]);

    useEffect(() => { fetchRowMemes(); }, [fetchRowMemes]);

    if (error || (!loading && memes.length === 0)) return null;

    return (
        <div className="meme-row-container">
            <h2 className="meme-row-title">{title}</h2>
            {loading ? ( <div className="loading-row">Loading...</div> ) : (
                <div className="meme-row">
                    {memes.map(meme => (
                        <MemeCard
                            key={meme.id}
                            meme={meme}
                            onCardClick={onMemeClick}
                            // onVote prop removed here
                            onFavoriteToggle={onFavoriteToggle}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

export default MemeRow;