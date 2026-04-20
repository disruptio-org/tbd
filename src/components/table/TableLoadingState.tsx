'use client';
import React from 'react';

interface TableLoadingStateProps {
    /** Number of skeleton rows to render */
    rows?: number;
    /** Number of cells per row */
    columns?: number;
}

/**
 * TableLoadingState — skeleton rows while table data loads.
 * Preserves table-like structure with shimmer animation.
 */
export default function TableLoadingState({
    rows = 5,
    columns = 4,
}: TableLoadingStateProps) {
    const cellWidths = ['40%', '20%', '15%', '25%', '18%', '12%'];

    return (
        <div className="nousio-loading-state">
            {Array.from({ length: rows }).map((_, rowIdx) => (
                <div key={rowIdx} className="nousio-skeleton-row">
                    {Array.from({ length: columns }).map((_, colIdx) => (
                        <div
                            key={colIdx}
                            className="nousio-skeleton-cell"
                            style={{
                                width: cellWidths[colIdx % cellWidths.length],
                                animationDelay: `${(rowIdx * 0.1) + (colIdx * 0.05)}s`,
                            }}
                        />
                    ))}
                </div>
            ))}
        </div>
    );
}
