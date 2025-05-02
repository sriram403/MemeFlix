import React from 'react';
import { Routes, Route } from 'react-router-dom';
import './App.css';
import Navbar from './components/Navbar';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import HomePage from './pages/HomePage';
import MyListPage from './pages/MyListPage';
import { useAuth } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

function App() {
    const { loading: authLoading } = useAuth();

    if (authLoading) {
        return <div className="loading-fullscreen">Loading Authentication...</div>;
    }

    return (
        <div className="App">
            <Navbar />
            <main>
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route path="/register" element={<RegisterPage />} />
                    <Route
                        path="/my-list"
                        element={
                            <ProtectedRoute>
                                <MyListPage />
                            </ProtectedRoute>
                        }
                    />
                    {/* Fallback Route Example */}
                    <Route path="*" element={<div style={{ padding: '50px', textAlign: 'center' }}><h2>404 - Page Not Found</h2></div>} />
                </Routes>
            </main>
            <footer>
                <p>Memeflix Footer - All Rights Reserved (locally)</p>
            </footer>
        </div>
    );
}

export default App;