import React, { useState, useEffect, useCallback } from 'react';
import { Routes, Route, useLocation, useSearchParams, useNavigate } from 'react-router-dom'; // Added useNavigate
import axios from 'axios';
// --- React Toastify Imports ---
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
// --- End React Toastify Imports ---
import './App.css';
import Navbar from './components/Navbar';
import MemeGrid from './components/MemeGrid';
import MemeDetailModal from './components/MemeDetailModal';
import PaginationControls from './components/PaginationControls';
import HeroBanner from './components/HeroBanner';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import { useAuth, axiosInstance } from './contexts/AuthContext';

const API_BASE_URL = 'http://localhost:3001';
const MEMES_PER_PAGE = 12;

function App() {
  const { user, loading: authLoading, isAuthenticated } = useAuth();
  const location = useLocation(); // Hook to get current route location

  // Determine if we are on an auth page
  const onAuthPage = location.pathname === '/login' || location.pathname === '/register';

  if (authLoading) {
      return <div className="loading-fullscreen">Loading Authentication...</div>;
  }

  return (
      <div className="App">
           {/* --- Add Toast Container --- */}
           <ToastContainer
              position="top-right"
              autoClose={4000} // Close after 4 seconds
              hideProgressBar={false}
              newestOnTop={false}
              closeOnClick
              rtl={false}
              pauseOnFocusLoss
              draggable
              pauseOnHover
              theme="dark" // Use dark theme
           />
           {/* --- End Toast Container --- */}

          {/* Pass onAuthPage prop to Navbar */}
          <Navbar onAuthPage={onAuthPage} />

          <main>
              <Routes>
                  {/* Pass onAuthPage prop to HomePage as well if needed */}
                  <Route path="/" element={<HomePage onAuthPage={onAuthPage}/>} />
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/register" element={<RegisterPage />} />
                  {/* Other routes */}
              </Routes>
          </main>

          <footer>
              <p>Memeflix Footer - All Rights Reserved (locally)</p>
          </footer>
      </div>
  );
}


// --- NEW: Component for the Home Page Content ---
function HomePage({ onAuthPage }) {
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedMeme, setSelectedMeme] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);

  const { isAuthenticated } = useAuth();
  const navigate = useNavigate(); // Hook for navigation

  const [searchParams] = useSearchParams();
  const searchTerm = searchParams.get('search') || '';


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
    // --- Vote Handler (Updated to use Toast) ---
    const handleVote = useCallback(async (memeId, voteType) => {
      if (!isAuthenticated) {
          // Use toast for login prompt
          toast.info("Please log in to vote.", {
              position: "top-right",
              autoClose: 3000,
              hideProgressBar: false,
              closeOnClick: true,
              pauseOnHover: true,
              draggable: true,
              progress: undefined,
              theme: "dark",
              onClick: () => navigate('/login') // Optional: navigate on click
          });
          return; // Stop vote execution
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
          const voteUrl = `/api/memes/${memeId}/${voteType}`;
          await axiosInstance.post(voteUrl);
           // Use toast for success feedback (optional, maybe too noisy)
          // toast.success(`Vote registered!`);
      } catch (error) {
          console.error(`Error ${voteType}ing meme ${memeId}:`, error);
          // Use toast for error feedback
          toast.error(`Failed to register ${voteType}. Please try again.`);
          // Rollback UI
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
        <>
             {/* Only show Hero Banner if NOT on an auth page AND not searching */}
             {!onAuthPage && !searchTerm && <HeroBanner featuredMeme={featuredMeme} onPlayClick={openModal}/>}

            <MemeGrid
                memes={memes}
                loading={loading}
                error={error}
                onMemeClick={openModal}
                onVote={handleVote}
            />

            {/* Only show Pagination if NOT on auth page AND other conditions met */}
            {!onAuthPage && !loading && !error && totalPages > 1 && !searchTerm && (
               <PaginationControls
                   currentPage={currentPage}
                   totalPages={totalPages}
                   onPageChange={handlePageChange}
               />
            )}

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