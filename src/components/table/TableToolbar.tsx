'use client';
import React from 'react';
import { Search } from 'lucide-react';

interface TableToolbarProps {
    /** Search input value */
    searchValue?: string;
    /** Search input placeholder */
    searchPlaceholder?: string;
    /** Search change handler */
    onSearchChange?: (value: string) => void;
    /** Filter buttons / chips (left side) */
    filters?: React.ReactNode;
    /** Action buttons (right side) */
    actions?: React.ReactNode;
    /** Result count string e.g. "42 results" */
    resultCount?: string;
    /** Bulk selection bar */
    bulkBar?: React.ReactNode;
    /** Children for custom content */
    children?: React.ReactNode;
}

/**
 * TableToolbar — standardized toolbar above the table.
 * Slots: search, filters (left), actions (right), result count, bulk bar.
 */
export default function TableToolbar({
    searchValue,
    searchPlaceholder = 'Search…',
    onSearchChange,
    filters,
    actions,
    resultCount,
    bulkBar,
    children,
}: TableToolbarProps) {
    return (
        <>
            {bulkBar && <div className="nousio-toolbar-bulk">{bulkBar}</div>}
            <div className="nousio-table-toolbar">
                <div className="nousio-toolbar-left">
                    {onSearchChange !== undefined && (
                        <div className="nousio-toolbar-search">
                            <Search size={14} className="search-icon" />
                            <input
                                type="text"
                                value={searchValue ?? ''}
                                onChange={(e) => onSearchChange?.(e.target.value)}
                                placeholder={searchPlaceholder}
                            />
                        </div>
                    )}
                    {filters}
                    {resultCount && (
                        <span className="nousio-toolbar-count">{resultCount}</span>
                    )}
                    {children}
                </div>
                {actions && (
                    <div className="nousio-toolbar-right">
                        {actions}
                    </div>
                )}
            </div>
        </>
    );
}
