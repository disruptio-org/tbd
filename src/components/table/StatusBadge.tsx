'use client';
import React from 'react';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
    variant?: BadgeVariant;
    children: React.ReactNode;
    className?: string;
}

/**
 * StatusBadge — semantic badge for table status cells.
 * Variants: success (green), warning (amber), error (red), info (blue), neutral (gray).
 */
export default function StatusBadge({
    variant = 'neutral',
    children,
    className = '',
}: StatusBadgeProps) {
    return (
        <span className={`nousio-badge nousio-badge--${variant} ${className}`.trim()}>
            {children}
        </span>
    );
}
