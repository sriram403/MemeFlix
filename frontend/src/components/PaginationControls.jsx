import React from 'react';
import './PaginationControls.css';

function PaginationControls({ currentPage, totalPages, onPageChange }) {

  if(totalPages <= 1) return null; // Don't render if only one page or less

  const handlePrevious = () => {
    if(currentPage > 1) onPageChange(currentPage - 1);
  };

  const handleNext = () => {
    if(currentPage < totalPages) onPageChange(currentPage + 1);
  };

  return (
    <div className="pagination-controls">
      <button onClick={handlePrevious} disabled={currentPage <= 1} aria-label="Go to previous page">
        « Previous
      </button>
      <span className="page-info" aria-live="polite" aria-atomic="true">
        Page {currentPage} of {totalPages}
      </span>
      <button onClick={handleNext} disabled={currentPage >= totalPages} aria-label="Go to next page">
        Next »
      </button>
    </div>
  );
}

export default PaginationControls;