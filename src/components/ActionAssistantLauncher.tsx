'use client';

import { useState, useEffect, useCallback } from 'react';
import { Sparkles } from 'lucide-react';
import ActionAssistantPanel from './ActionAssistantPanel';
import './ActionAssistant.css';

/**
 * ActionAssistantLauncher — Global FAB + Panel.
 * Rendered inside the dashboard layout, available on all pages.
 */
export default function ActionAssistantLauncher() {
    const [isOpen, setIsOpen] = useState(false);
    const [assistantName, setAssistantName] = useState('Nousio');

    // Load user's assistant name preference
    useEffect(() => {
        fetch('/api/assistant/preferences')
            .then(r => r.json())
            .then(data => {
                if (data.preferences?.displayName) {
                    setAssistantName(data.preferences.displayName);
                }
            })
            .catch(() => { /* use default */ });
    }, []);

    // Keyboard shortcut: Ctrl+K / Cmd+K
    useEffect(() => {
        const handler = (e: KeyboardEvent) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
                e.preventDefault();
                setIsOpen(prev => !prev);
            }
            if (e.key === 'Escape' && isOpen) {
                setIsOpen(false);
            }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [isOpen]);

    const toggle = useCallback(() => setIsOpen(prev => !prev), []);
    const close = useCallback(() => setIsOpen(false), []);

    return (
        <>
            {/* Floating Action Button */}
            <button
                className={`action-assistant-fab ${isOpen ? 'panel-open' : ''}`}
                onClick={toggle}
                aria-label={`Open ${assistantName}`}
                id="action-assistant-fab"
            >
                <Sparkles size={22} />
                <span className="action-assistant-fab-hint">
                    {navigator.platform?.includes('Mac') ? '⌘K' : 'Ctrl+K'}
                </span>
            </button>

            {/* Panel */}
            <ActionAssistantPanel
                isOpen={isOpen}
                onClose={close}
                assistantName={assistantName}
            />
        </>
    );
}
