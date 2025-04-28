// frontend/src/components/PaginationControls.jsx
import React from 'react';
import './PaginationControls.css';

// Props: currentPage, totalPages, onPageChange
function PaginationControls({ currentPage, totalPages, onPageChange }) {

  const handlePrevious = () => {
    onPageChange(currentPage - 1); // Call handler from App
  };

  const handleNext = () => {
    onPageChange(currentPage + 1); // Call handler from App
  };

  // Basic rendering - could add page numbers later
  return (
    <div className="pagination-controls">
      <button
        onClick={handlePrevious}
        disabled={currentPage <= 1} // Disable if on first page
      >
        « Previous
      </button>
      <span className="page-info">
        Page {currentPage} of {totalPages}
      </span>
      <button
        onClick={handleNext}
        disabled={currentPage >= totalPages} // Disable if on last page
      >
        Next »
      </button>
    </div>
  );
}

export default PaginationControls;