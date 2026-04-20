'use client';

import React from 'react';

interface PageHeaderProps {
    section?: string;
    title: string;
    description?: string;
    actions?: React.ReactNode;
    children?: React.ReactNode;
}

export default function PageHeader({ section, title, description, actions, children }: PageHeaderProps) {
    return (
        <div className="page-header">
            <div className="page-header-left">
                {section && <div className="page-header-section">{section}</div>}
                <h1>{title}</h1>
                {description && <p>{description}</p>}
            </div>
            {children}
            {actions && (
                <div className="page-header-actions">
                    {actions}
                </div>
            )}
        </div>
    );
}
