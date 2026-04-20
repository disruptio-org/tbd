'use client';
import React, { useState, useRef, useEffect } from 'react';
import { MoreVertical } from 'lucide-react';

interface ActionItem {
    label: string;
    icon?: React.ReactNode;
    onClick: () => void;
    danger?: boolean;
}

interface RowActionMenuProps {
    /** Primary inline action (always visible) */
    primaryAction?: {
        icon: React.ReactNode;
        title: string;
        onClick: () => void;
        variant?: 'default' | 'primary' | 'danger';
    };
    /** Overflow menu items */
    items: ActionItem[];
}

/**
 * RowActionMenu — standardized row action pattern.
 * Shows one inline action + overflow menu for secondary actions.
 */
export default function RowActionMenu({ primaryAction, items }: RowActionMenuProps) {
    const [open, setOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        }
        if (open) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [open]);

    const dangerIdx = items.findIndex(i => i.danger);

    return (
        <div className="nousio-row-actions" ref={menuRef} style={{ position: 'relative' }}>
            {primaryAction && (
                <button
                    className={`nousio-action-btn${primaryAction.variant === 'danger' ? ' nousio-action-btn--danger' : primaryAction.variant === 'primary' ? ' nousio-action-btn--primary' : ''}`}
                    onClick={primaryAction.onClick}
                    title={primaryAction.title}
                >
                    {primaryAction.icon}
                </button>
            )}
            {items.length > 0 && (
                <>
                    <button
                        className="nousio-action-btn"
                        onClick={() => setOpen(o => !o)}
                        title="More actions"
                    >
                        <MoreVertical size={14} />
                    </button>
                    {open && (
                        <div className="nousio-overflow-menu">
                            {items.map((item, idx) => (
                                <React.Fragment key={idx}>
                                    {dangerIdx === idx && idx > 0 && <hr className="nousio-overflow-divider" />}
                                    <button
                                        className={`nousio-overflow-item${item.danger ? ' nousio-overflow-item--danger' : ''}`}
                                        onClick={() => { item.onClick(); setOpen(false); }}
                                    >
                                        {item.icon}
                                        {item.label}
                                    </button>
                                </React.Fragment>
                            ))}
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
