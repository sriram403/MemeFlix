// frontend/src/App.jsx
// Wrap content in Routes, define paths for Login/Register/Home
// You can copy-paste the whole file content below

import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useLocation, useSearchParams } from 'react-router-dom'; // Import routing components
import axios from 'axios'; // Keep axios for non-authed instance if needed? Or rely on AuthContext's instance
import './App.css';
import Navbar from './components/Navbar';
import MemeGrid from './components/MemeGrid';
import MemeDetailModal from './components/MemeDetailModal';
import PaginationControls from './components/PaginationControls';
import HeroBanner from './components/HeroBanner';
import LoginPage from './pages/LoginPage'; // Import Login Page
import RegisterPage from './pages/RegisterPage'; // Import Register Page
import { useAuth, axiosInstance } from './contexts/AuthContext'; // Import useAuth and axiosInstance

const API_BASE_URL = 'http://localhost:3001'; // Keep for non-authed calls if any
const MEMES_PER_PAGE = 12;

// --- Main App Component with Routing ---
function App() {
    // We'll move state needed only for the Home page inside a new component
    const { user, loading: authLoading, isAuthenticated } = useAuth(); // Get auth state

    // If initial auth check is still loading, show a simple loader
    if (authLoading) {
        return <div className="loading-fullscreen">Loading Authentication...</div>;
    }

    return (
        <div className="App">
            {/* Navbar is outside Routes to be persistent */}
            <Navbar />

            <main>
                <Routes>
                    {/* Route for the main meme browsing page */}
                    <Route path="/" element={<HomePage />} />

                    {/* Route for the Login page */}
                    <Route path="/login" element={<LoginPage />} />

                    {/* Route for the Registration page */}
                    <Route path="/register" element={<RegisterPage />} />

                    {/* Add other routes here later (e.g., /profile, /my-list) */}

                    {/* Catch-all route for 404? */}
                    {/* <Route path="*" element={<h2>Page Not Found</h2>} /> */}
                </Routes>
            </main>

            <footer>
                <p>Memeflix Footer - All Rights Reserved (locally)</p>
            </footer>
        </div>
    );
}


// --- NEW: Component for the Home Page Content ---
function HomePage() {
    // State variables moved here from App
    const [memes, setMemes] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedMeme, setSelectedMeme] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalPages, setTotalPages] = useState(0);

    const { isAuthenticated } = useAuth(); // Use auth state if needed

    // Get search query from URL
    const [searchParams, setSearchParams] = useSearchParams();
    const searchTerm = searchParams.get('search') || ''; // Read search term from URL query param


    // --- Data Fetching Effect (similar to before, uses searchTerm from URL) ---
     const fetchMemes = useCallback(async () => {
        setLoading(true);
        setError(null);
        let url = '';
        const params = {};

        if (searchTerm) {
            url = `${API_BASE_URL}/api/memes/search?q=${encodeURIComponent(searchTerm)}`;
            if (currentPage !== 1) setCurrentPage(1);
            setTotalPages(0);
        } else {
            url = `${API_BASE_URL}/api/memes`;
            params.page = currentPage;
            params.limit = MEMES_PER_PAGE;
        }

        try {
            // Use the axiosInstance from AuthContext if requests need auth later
            // For public meme list, regular axios or the instance is fine
            const response = await axiosInstance.get(url, { params });
            setMemes(response.data.memes || []);

            if (!searchTerm && response.data.pagination) {
                setTotalPages(response.data.pagination.totalPages);
                 if (response.data.pagination.currentPage !== currentPage && currentPage > response.data.pagination.totalPages) {
                    setCurrentPage(response.data.pagination.totalPages || 1);
                 }
            } else if (searchTerm) {
                 setTotalPages(0);
            }
        } catch (err) {
            console.error("Error fetching memes:", err);
            setError(searchTerm ? `Failed to search memes for "${searchTerm}".` : 'Failed to load memes.');
            setTotalPages(0);
            setMemes([]);
        } finally {
            setLoading(false);
        }
    }, [searchTerm, currentPage]); // Depend on searchTerm from URL and currentPage state

    useEffect(() => {
        fetchMemes();
    }, [fetchMemes]);


    // --- Modal Handlers ---
    const openModal = (meme) => {
        setSelectedMeme(meme);
        setIsModalOpen(true);
    };
    const closeModal = () => {
        setIsModalOpen(false);
        setSelectedMeme(null);
    };

     // --- Page Change Handler ---
    const handlePageChange = (newPage) => {
        if (newPage >= 1 && (!totalPages || newPage <= totalPages)) {
            setCurrentPage(newPage);
            window.scrollTo(0, 0);
        }
    };

    // --- Vote Handler (using axiosInstance potentially) ---
    const handleVote = useCallback(async (memeId, voteType) => {
        // Check if user is authenticated before allowing vote (optional)
        if (!isAuthenticated) {
            alert("Please log in to vote.");
            // Optionally redirect to login: navigate('/login');
            return;
        }

        const originalMemes = [...memes];
        let updatedMemeData = null;

        setMemes(prevMemes => prevMemes.map(meme => {
            if (meme.id === memeId) {
                updatedMemeData = {
                    ...meme,
                    upvotes: voteType === 'upvote' ? meme.upvotes + 1 : meme.upvotes,
                    downvotes: voteType === 'downvote' ? meme.downvotes + 1 : meme.downvotes,
                };
                 if (selectedMeme && selectedMeme.id === memeId) {
                    setSelectedMeme(updatedMemeData);
                 }
                return updatedMemeData;
            }
            return meme;
        }));

        try {
            const voteUrl = `/api/memes/${memeId}/${voteType}`; // Relative URL uses axiosInstance base
            await axiosInstance.post(voteUrl); // Use authed instance if needed
            console.log(`Successfully ${voteType}d meme ${memeId} on backend.`);
        } catch (error) {
            console.error(`Error ${voteType}ing meme ${memeId}:`, error);
            alert(`Failed to register ${voteType}. Please try again.`);
            setMemes(originalMemes);
             if (selectedMeme && selectedMeme.id === memeId) {
                 const originalMemeInList = originalMemes.find(m => m.id === memeId);
                 if(originalMemeInList) setSelectedMeme(originalMemeInList);
             }
        }
    }, [memes, selectedMeme, isAuthenticated /* Add dependencies */]);

    // Determine featured meme for banner
    const featuredMeme = !loading && !error && memes.length > 0 ? memes[0] : null;


    return (
        <> {/* Use Fragment as we don't need an extra div */}
             {!searchTerm && <HeroBanner featuredMeme={featuredMeme} onPlayClick={openModal}/>}

            <MemeGrid
                memes={memes}
                loading={loading}
                error={error}
                onMemeClick={openModal}
                onVote={handleVote}
            />

            {!loading && !error && totalPages > 1 && !searchTerm && (
               <PaginationControls
                   currentPage={currentPage}
                   totalPages={totalPages}
                   onPageChange={handlePageChange}
               />
            )}

            {/* Modal rendering remains the same */}
             {isModalOpen && (
                <MemeDetailModal
                    meme={selectedMeme}
                    onClose={closeModal}
                    onVote={handleVote}
                />
            )}
        </>
    );
}


export default App;