'use client';
import React from 'react';

interface TableEmptyStateProps {
    icon?: React.ReactNode;
    title: string;
    description?: string;
    action?: React.ReactNode;
}

/**
 * TableEmptyState — standardized empty state for tables.
 * Shows icon, title, description, and optional primary action.
 */
export default function TableEmptyState({
    icon,
    title,
    description,
    action,
}: TableEmptyStateProps) {
    return (
        <div className="nousio-empty-state">
            {icon && <div className="nousio-empty-icon">{icon}</div>}
            <h3>{title}</h3>
            {description && <p>{description}</p>}
            {action}
        </div>
    );
}
