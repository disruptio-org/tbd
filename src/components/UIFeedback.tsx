'use client';

import { useState, useEffect, useCallback, createContext, useContext } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import './ui-feedback.css';

/* ═══════════════════════════════════════════════════════
   TOAST (replaces alert())
   ═══════════════════════════════════════════════════════ */
interface Toast {
    id: number;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
}

interface UIFeedbackContextType {
    showToast: (message: string, type?: Toast['type']) => void;
    showConfirm: (message: string, onConfirm: () => void) => void;
}

const UIFeedbackContext = createContext<UIFeedbackContextType>({
    showToast: () => { },
    showConfirm: () => { },
});

export function useUIFeedback() {
    return useContext(UIFeedbackContext);
}

let _toastId = 0;

export function UIFeedbackProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const [confirm, setConfirm] = useState<{ message: string; onConfirm: () => void } | null>(null);

    // Toasts disabled — showToast is a no-op
    const showToast = useCallback((_message: string, _type: Toast['type'] = 'info') => {
        // No-op: toasters removed from the solution
    }, []);

    const showConfirm = useCallback((message: string, onConfirm: () => void) => {
        setConfirm({ message, onConfirm });
    }, []);

    // Close confirm on Escape
    useEffect(() => {
        if (!confirm) return;
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') setConfirm(null);
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [confirm]);

    return (
        <UIFeedbackContext.Provider value={{ showToast, showConfirm }}>
            {children}

            {/* Toasts removed from the solution */}

            {/* ── Confirm Modal ── */}
            {confirm && (
                <div className="confirm-overlay" onClick={() => setConfirm(null)}>
                    <div className="confirm-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="confirm-header">
                            <div className="confirm-header-left">
                                <span className="confirm-icon-wrap"><AlertTriangle size={18} strokeWidth={2} /></span>
                                <span className="confirm-title">Confirm Action</span>
                            </div>
                            <button className="confirm-close" onClick={() => setConfirm(null)}>
                                <X size={16} strokeWidth={2} />
                            </button>
                        </div>
                        <div className="confirm-body">
                            <p className="confirm-message">{confirm.message}</p>
                        </div>
                        <div className="confirm-actions">
                            <button
                                className="confirm-btn confirm-btn-cancel"
                                onClick={() => setConfirm(null)}
                            >
                                Cancel
                            </button>
                            <button
                                className="confirm-btn confirm-btn-ok"
                                onClick={() => {
                                    confirm.onConfirm();
                                    setConfirm(null);
                                }}
                            >
                                Confirm
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </UIFeedbackContext.Provider>
    );
}
