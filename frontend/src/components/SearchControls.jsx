// frontend/src/components/SearchControls.jsx
import React from 'react';
import './SearchControls.css';

// Props:
// - currentFilterType: The currently selected type ('', 'image', 'gif', 'video')
// - currentSortBy: The currently selected sort order ('newest', 'oldest', 'score')
// - onFilterChange: Function to call when filter changes (passes new type)
// - onSortChange: Function to call when sort changes (passes new sort value)
function SearchControls({ currentFilterType, currentSortBy, onFilterChange, onSortChange }) {

    const handleFilter = (event) => {
        onFilterChange(event.target.value); // Pass selected value ('', 'image', etc.)
    };

    const handleSort = (event) => {
        onSortChange(event.target.value); // Pass selected value ('newest', etc.)
    };

    return (
        <div className="search-controls">
            <div className="control-group">
                <label htmlFor="filter-type">Filter by Type:</label>
                <select id="filter-type" value={currentFilterType} onChange={handleFilter}>
                    <option value="">All Types</option>
                    <option value="image">Images</option>
                    <option value="gif">GIFs</option>
                    <option value="video">Videos</option>
                </select>
            </div>
            <div className="control-group">
                <label htmlFor="sort-by">Sort by:</label>
                <select id="sort-by" value={currentSortBy} onChange={handleSort}>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="score">Highest Score</option>
                    {/* Add more sort options later? */}
                </select>
            </div>
        </div>
    );
}

export default SearchControls;