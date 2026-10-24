import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import './Pagination.css';

export interface PaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
  totalItems?: number;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalPages,
  onPageChange,
  hasNext,
  hasPrevious,
  totalItems
}) => {
  const canGoPrev = hasPrevious !== undefined ? hasPrevious : currentPage > 1;
  const canGoNext = hasNext !== undefined ? hasNext : currentPage < totalPages;

  return (
    <div className="pagination-container">
      {totalItems !== undefined && (
        <span className="pagination-info">
          Page {currentPage} of {totalPages || 1} ({totalItems} total)
        </span>
      )}
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn"
          disabled={!canGoPrev}
          onClick={() => onPageChange(currentPage - 1)}
          aria-label="Previous page"
        >
          <ChevronLeft size={16} />
          <span>Previous</span>
        </button>
        <span className="pagination-badge">
          {currentPage}
        </span>
        <button
          type="button"
          className="pagination-btn"
          disabled={!canGoNext}
          onClick={() => onPageChange(currentPage + 1)}
          aria-label="Next page"
        >
          <span>Next</span>
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
};
