// frontend/src/components/SearchControls.jsx
import React from 'react';
import './SearchControls.css';

function SearchControls({
    currentFilterType,
    currentSortBy,
    currentTag,
    availableTags,
    onFilterChange,
    onSortChange,
    onTagChange,
    showTagFilter = true // <-- New prop with default value
}) {

    const handleFilter = (event) => {
        onFilterChange(event.target.value);
    };

    const handleSort = (event) => {
        onSortChange(event.target.value);
    };

    const handleTag = (event) => {
        // Ensure onTagChange exists before calling
        if (onTagChange) {
            onTagChange(event.target.value);
        }
    };

    return (
        <div className="search-controls">
            {/* Type Filter */}
            <div className="control-group">
                <label htmlFor="filter-type">Type:</label>
                <select id="filter-type" value={currentFilterType} onChange={handleFilter}>
                    <option value="">All Types</option>
                    <option value="image">Images</option>
                    <option value="gif">GIFs</option>
                    <option value="video">Videos</option>
                </select>
            </div>

            {/* Tag Filter - Conditionally Rendered */}
            {showTagFilter && ( // <-- Wrap in conditional render
                <div className="control-group">
                    <label htmlFor="filter-tag">Tag:</label>
                    <select
                        id="filter-tag"
                        value={currentTag}
                        onChange={handleTag}
                        // Disable only if explicitly told OR if tags aren't ready/available
                        disabled={!onTagChange || !availableTags || availableTags.length === 0}
                    >
                        <option value="">All Tags</option>
                        {/* Ensure availableTags is an array before mapping */}
                        {Array.isArray(availableTags) && availableTags.map(tag => (
                            <option key={tag} value={tag}>{tag}</option>
                        ))}
                    </select>
                </div>
            )}

            {/* Sort Order */}
            <div className="control-group">
                <label htmlFor="sort-by">Sort by:</label>
                <select id="sort-by" value={currentSortBy} onChange={handleSort}>
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="score">Highest Score</option>
                </select>
            </div>
        </div>
    );
}

export default SearchControls;