'use client';
import React from 'react';

interface TableShellProps {
    children: React.ReactNode;
    variant?: 'standard' | 'compact' | 'workflow';
    primary?: boolean;
    flush?: boolean;
    fixed?: boolean;
    className?: string;
}

/**
 * TableShell — outer container wrapper for tables.
 * Renders `.nousio-table-card` (border, shadow) around children.
 * Children should include `<table className="nousio-table">` and/or `<TableToolbar>`.
 */
export default function TableShell({
    children,
    variant = 'standard',
    primary = false,
    flush = false,
    className = '',
}: TableShellProps) {
    const cardClasses = [
        'nousio-table-card',
        variant === 'compact' && 'nousio-table-card--compact',
        variant === 'workflow' && 'nousio-table-card--workflow',
        primary && 'nousio-table-card--primary',
        flush && 'nousio-table-card--flush',
        className,
    ].filter(Boolean).join(' ');

    return (
        <div className={cardClasses}>
            {children}
        </div>
    );
}
