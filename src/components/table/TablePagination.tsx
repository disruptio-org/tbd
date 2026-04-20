'use client';
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface TablePaginationProps {
    /** Current page (1-indexed) */
    page: number;
    /** Total number of items */
    totalItems: number;
    /** Items per page */
    pageSize: number;
    /** Page change handler */
    onPageChange: (page: number) => void;
    /** Optional page size change handler */
    onPageSizeChange?: (size: number) => void;
    /** Available page size options */
    pageSizeOptions?: number[];
}

/**
 * TablePagination — standard footer with page info, prev/next, and optional page size selector.
 */
export default function TablePagination({
    page,
    totalItems,
    pageSize,
    onPageChange,
    onPageSizeChange,
    pageSizeOptions = [10, 25, 50, 100],
}: TablePaginationProps) {
    const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
    const start = (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, totalItems);

    return (
        <div className="nousio-pagination">
            <div className="nousio-pagination-info">
                {totalItems === 0 ? 'No results' : `${start}–${end} of ${totalItems}`}
            </div>
            <div className="nousio-pagination-controls">
                {onPageSizeChange && (
                    <select
                        className="nousio-pagination-select"
                        value={pageSize}
                        onChange={(e) => onPageSizeChange(Number(e.target.value))}
                    >
                        {pageSizeOptions.map(opt => (
                            <option key={opt} value={opt}>{opt} / page</option>
                        ))}
                    </select>
                )}
                <button
                    className="nousio-pagination-btn"
                    onClick={() => onPageChange(page - 1)}
                    disabled={page <= 1}
                    title="Previous page"
                >
                    <ChevronLeft size={14} />
                </button>
                <span className="nousio-pagination-info" style={{ padding: '0 4px' }}>
                    {page} / {totalPages}
                </span>
                <button
                    className="nousio-pagination-btn"
                    onClick={() => onPageChange(page + 1)}
                    disabled={page >= totalPages}
                    title="Next page"
                >
                    <ChevronRight size={14} />
                </button>
            </div>
        </div>
    );
}
