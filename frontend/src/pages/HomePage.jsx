// frontend/src/pages/HomePage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom'; // Import useSearchParams
import HeroBanner from '../components/HeroBanner';
import MemeRow from '../components/MemeRow';
import MemeDetailModal from '../components/MemeDetailModal';
import Spinner from '../components/Spinner';
import { useAuth, axiosInstance } from '../contexts/AuthContext';
import { toast } from 'react-toastify';
import './HomePage.css';

// Define API_BASE_URL consistently
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function HomePage() {
    const [featuredMeme, setFeaturedMeme] = useState(null);
    const [popularTags, setPopularTags] = useState([]);
    const [memesByTag, setMemesByTag] = useState({}); // { tag: [memes] }
    const [loading, setLoading] = useState({
        featured: true,
        tags: true,
        tagsLoading: {}, // Track loading state per tag
        sharedMeme: false, // Loading state for shared meme
    });
    const [error, setError] = useState('');
    const [selectedMeme, setSelectedMeme] = useState(null); // State for the modal
    const { addFavorite, removeFavorite, recordVote, isFavorite } = useAuth(); // Get auth actions including isFavorite

    // --- Logic to handle incoming shared link ---
    const [searchParams, setSearchParams] = useSearchParams(); // Hook to read URL params

    // Effect to check for 'openMemeId' on initial load and fetch if needed
    useEffect(() => {
        const memeIdFromUrl = searchParams.get('openMemeId');
        // Only run if memeIdFromUrl exists and we haven't already loaded or tried to load it
        if (memeIdFromUrl && !selectedMeme && !loading.sharedMeme) {
            console.log(`Found openMemeId in URL: ${memeIdFromUrl}, fetching...`);
            setLoading(prev => ({ ...prev, sharedMeme: true })); // Set loading state

            const fetchMemeById = async (id) => {
                try {
                    // --- !!! IMPORTANT: BACKEND CHANGE NEEDED !!! ---
                    // Your backend currently LACKS an endpoint like /api/memes/:id
                    // You MUST add this endpoint to your backend/Server.js
                    // The endpoint should fetch and return the full meme details (including tags, votes, etc.)
                    // based on the provided ID.
                    // Example of how you *would* call it if it existed:
                    // const response = await axiosInstance.get(`${API_BASE_URL}/api/memes/${id}`);
                    // if (response.data && response.data.meme) {
                    //     setSelectedMeme(response.data.meme); // Open the modal with fetched data
                    // } else {
                    //     throw new Error('Meme not found in API response');
                    // }
                    // --- End of Backend Change Requirement ---

                    // --- Current Fallback (Shows Error) ---
                    console.error(`Error: Cannot fetch specific meme. Add GET /api/memes/:id endpoint to backend/Server.js`);
                    toast.error("Could not load the specific shared meme. Feature requires backend update.", { autoClose: 5000 });
                    // --- End of Fallback ---

                } catch (fetchError) {
                    console.error(`Error fetching meme with ID ${id} from URL:`, fetchError);
                    toast.error('Failed to load shared meme data.');
                } finally {
                    // Remove the query parameter from URL after attempting to load
                    searchParams.delete('openMemeId');
                    setSearchParams(searchParams, { replace: true }); // Use replace to avoid history pollution
                    setLoading(prev => ({ ...prev, sharedMeme: false })); // Reset loading state
                }
            };

            fetchMemeById(memeIdFromUrl);
        }
    }, [searchParams, setSearchParams, selectedMeme, loading.sharedMeme]); // Dependencies

    // --- End of shared link logic ---


    // Fetch featured meme
    useEffect(() => {
        const fetchFeatured = async () => {
            setLoading(prev => ({ ...prev, featured: true }));
            try {
                const response = await axiosInstance.get(`${API_BASE_URL}/api/memes/random`);
                setFeaturedMeme(response.data.meme);
            } catch (err) {
                console.error("Error fetching featured meme:", err);
                setError('Could not load featured content. Please try again later.');
            } finally {
                setLoading(prev => ({ ...prev, featured: false }));
            }
        };
        fetchFeatured();
    }, []); // Run once on mount

    // Fetch popular tags
    useEffect(() => {
        const fetchTags = async () => {
            setLoading(prev => ({ ...prev, tags: true }));
            try {
                // Fetch slightly more tags initially, maybe filter later if needed
                const response = await axiosInstance.get(`${API_BASE_URL}/api/tags/popular`, { params: { limit: 10 } });
                setPopularTags(response.data.popularTags || []);
            } catch (err) {
                console.error("Error fetching popular tags:", err);
                // Don't set main error for tags failure
            } finally {
                setLoading(prev => ({ ...prev, tags: false }));
            }
        };
        fetchTags();
    }, []); // Run once on mount

    // Fetch memes for each popular tag (using useCallback for stability)
    const fetchMemesForTag = useCallback(async (tag) => {
        // Prevent fetching if already loading or data exists (unless refresh needed)
        if (!tag || loading.tagsLoading[tag] || (memesByTag[tag] && memesByTag[tag].length > 0)) return;

        setLoading(prev => ({ ...prev, tagsLoading: { ...prev.tagsLoading, [tag]: true } }));
        try {
            const response = await axiosInstance.get(`${API_BASE_URL}/api/memes/by-tag/${encodeURIComponent(tag)}`, { params: { limit: 12 } }); // Consistent limit?
            setMemesByTag(prev => ({ ...prev, [tag]: response.data.memes || [] }));
        } catch (err) {
            console.error(`Error fetching memes for tag ${tag}:`, err);
            setMemesByTag(prev => ({ ...prev, [tag]: [] })); // Set empty array on error
        } finally {
            setLoading(prev => ({ ...prev, tagsLoading: { ...prev.tagsLoading, [tag]: false } }));
        }
    }, [memesByTag, loading.tagsLoading]); // Dependencies

    // Trigger fetching memes when popular tags are loaded
    useEffect(() => {
        if (popularTags.length > 0) {
            // Limit the number of rows displayed if needed, e.g., first 5 tags
            const tagsToFetch = popularTags.slice(0, 7); // Show first 7 tag rows
            tagsToFetch.forEach(tagData => {
                fetchMemesForTag(tagData.tag);
            });
        }
    }, [popularTags, fetchMemesForTag]);


    // Handlers for Modal
    const handleOpenModal = (meme) => {
        console.log("Opening modal for:", meme);
        setSelectedMeme(meme); // Set the full meme object
    };

    const handleCloseModal = () => {
        setSelectedMeme(null);
    };

    // Function to update meme state after vote/favorite actions
    // This tries to update the state locally *first* for better UX,
    // then relies on background refetches or context updates for full consistency.
    const updateMemeState = (memeId, updates) => {
        // Update featured meme if it's the one affected
        setFeaturedMeme(current => (current && current.id === memeId) ? { ...current, ...updates } : current);
        // Update memes in tag rows
        setMemesByTag(currentMap => {
            const newMap = { ...currentMap };
            Object.keys(newMap).forEach(tag => {
                newMap[tag] = newMap[tag].map(meme =>
                    meme.id === memeId ? { ...meme, ...updates } : meme
                );
            });
            return newMap;
        });
         // Update selected meme in modal if it's the one affected
         setSelectedMeme(current => (current && current.id === memeId) ? { ...current, ...updates } : current);
    };


    const handleVoteInModal = async (memeId, voteType) => {
        const originalVoteStatus = selectedMeme?.user_vote_status; // Store original status

        // Optimistic UI Update (Example)
        const optimisticUpdates = {
            user_vote_status: voteType === 'upvote' ? 1 : -1,
            // Note: Updating exact vote counts optimistically is complex,
            // better rely on refetch or context update.
        };
        updateMemeState(memeId, optimisticUpdates); // Update UI immediately

        try {
            await recordVote(memeId, voteType); // API call
            // Optional: Refetch specific data or rely on context updates
            // For simplicity, we'll let context handle favorite status,
            // but vote counts/status ideally need a refresh mechanism
            // or the API should return the updated meme object.
            toast.success(`Vote ${voteType === 'upvote' ? 'recorded' : 'recorded'}!`, { theme: "dark" });
        } catch (err) {
            console.error(`Failed to ${voteType}:`, err);
            toast.error(`Failed to ${voteType}. Reverting UI.`, { theme: "dark" });
            // Revert optimistic update on error
            updateMemeState(memeId, { user_vote_status: originalVoteStatus });
        }
    };

     const handleFavoriteToggleInModal = async (memeId) => {
        const currentlyIsFavorite = isFavorite(memeId); // Check current status via context
         // Optimistic UI update for modal state (optional, context should handle source of truth)
        // setSelectedMeme(current => (current && current.id === memeId) ? { ...current, is_favorite: !currentlyIsFavorite } : current);

        const action = currentlyIsFavorite ? removeFavorite : addFavorite;
        const successMessage = currentlyIsFavorite ? "Removed from My List" : "Added to My List";
        const errorMessage = currentlyIsFavorite ? "Failed to remove" : "Failed to add";

        try {
            await action(memeId); // Call addFavorite or removeFavorite
            // Context state (favoriteIds) should update, triggering re-renders where isFavorite is used.
            toast.success(successMessage, { theme: "dark" });
        } catch (error) {
             console.error("Failed to toggle favorite in modal:", error);
             toast.error(`${errorMessage}. Please try again.`, { theme: "dark" });
             // Revert optimistic update if needed, though relying on context is better
            // setSelectedMeme(current => (current && current.id === memeId) ? { ...current, is_favorite: currentlyIsFavorite } : current);
        }
     };


    // Decide which tags rows to render based on fetched data
    const tagRowsToRender = popularTags
        .slice(0, 7) // Limit rows
        .filter(tagData => memesByTag[tagData.tag] && memesByTag[tagData.tag].length > 0); // Only show rows with memes


    return (
        <div className="home-page">
            {/* Show spinner only if loading featured AND it hasn't loaded yet */}
            {loading.featured && !featuredMeme && <Spinner text="Loading Featured Meme..." />}
            {error && <div className="error-message">{error}</div>}

            {/* Render Hero Banner only when featured meme is available */}
            {featuredMeme && (
                <HeroBanner
                    featuredMeme={featuredMeme}
                    onPlayClick={handleOpenModal}
                    onFavoriteToggle={handleFavoriteToggleInModal} // Use specific modal handler
                 />
            )}

            {/* Loading indicator for tags section */}
            {loading.tags && <Spinner text="Loading Tags..." />}

            {/* Render tag rows */}
            {!loading.tags && tagRowsToRender.length === 0 && !error && <p>No memes found for popular tags.</p>}
            {tagRowsToRender.map((tagData) => (
                <MemeRow
                    key={tagData.tag}
                    title={tagData.tag} // Use tag name as title
                    memes={memesByTag[tagData.tag] || []}
                    // Pass loading state specifically for this row
                    isLoading={loading.tagsLoading[tagData.tag] === true}
                    onMemeClick={handleOpenModal}
                    // Pass toggle handler - context will update favorite status
                    onFavoriteToggle={handleFavoriteToggleInModal}
                />
            ))}

            {/* Loading indicator specifically for shared meme */}
            {loading.sharedMeme && <Spinner text="Loading Shared Meme..." />}

            {/* Render Modal if a meme is selected */}
            {selectedMeme && (
                <MemeDetailModal
                    meme={selectedMeme}
                    onClose={handleCloseModal}
                    onVote={handleVoteInModal}
                    onFavoriteToggle={handleFavoriteToggleInModal}
                />
            )}
        </div>
    );
}

export default HomePage;