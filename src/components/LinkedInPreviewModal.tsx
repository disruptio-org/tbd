'use client';

import { useEffect, useRef } from 'react';
import { X, ThumbsUp, MessageCircle, Repeat2, Send } from 'lucide-react';
import './LinkedInPreviewModal.css';

/* ─── helpers ────────────────────────────────────────── */

/**
 * Parse the structured post text into sections the preview
 * can render correctly as a LinkedIn-style card.
 *
 * The AI generates content with markdown-like section headers
 * (e.g. "# CALL TO ACTION", "# HASHTAGS"). We strip those for
 * the preview and join the body text into a single block.
 */
function parsePostContent(raw: string): { body: string; hashtags: string } {
    // Split into lines and classify
    const lines = raw.split('\n');
    const bodyLines: string[] = [];
    const hashtagLines: string[] = [];

    let inHashtags = false;
    let inSections = false;

    for (const line of lines) {
        const trimmed = line.trim();

        // Detect section headers
        if (/^#{1,3}\s*(HASHTAGS|hashtags|#\s*hashtags)/i.test(trimmed) || /^#\s+HASHTAGS/i.test(trimmed)) {
            inHashtags = true;
            inSections = false;
            continue;
        }
        if (/^#{1,3}\s*(SECTIONS|sections)/i.test(trimmed)) {
            inSections = true;
            inHashtags = false;
            continue;
        }
        if (/^#{1,3}\s/.test(trimmed)) {
            // Any other section header — treat as label, not content
            inHashtags = false;
            inSections = false;
            continue;
        }

        if (inHashtags) {
            if (trimmed) hashtagLines.push(trimmed);
        } else if (!inSections) {
            bodyLines.push(line);
        }
    }

    // Extract inline hashtags from body lines too
    const bodyText = bodyLines.join('\n').trim();
    const inlineHashtags = (bodyText.match(/#\w+/g) || []).join(' ');

    return {
        body: bodyText,
        hashtags: [hashtagLines.join(' '), inlineHashtags].filter(Boolean).join(' ').replace(/\s+#/g, ' #').trim(),
    };
}

/** Render body text: blank lines → paragraph breaks, **bold** → <strong> */
function renderBody(text: string): string {
    return text
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\n{2,}/g, '</p><p class="li-para">')
        .replace(/\n/g, '<br />');
}

/* ═══════════════════════════════════════════════════════
   Props
   ═══════════════════════════════════════════════════════ */

interface LinkedInPreviewModalProps {
    content: string;
    title?: string;
    onClose: () => void;
}

/* ═══════════════════════════════════════════════════════
   Component
   ═══════════════════════════════════════════════════════ */

export default function LinkedInPreviewModal({ content, title, onClose }: LinkedInPreviewModalProps) {
    const backdropRef = useRef<HTMLDivElement>(null);
    const { body, hashtags } = parsePostContent(content);

    // Close on Escape
    useEffect(() => {
        function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
        document.addEventListener('keydown', onKey);
        return () => document.removeEventListener('keydown', onKey);
    }, [onClose]);

    return (
        <div className="li-backdrop" ref={backdropRef} onClick={(e) => { if (e.target === backdropRef.current) onClose(); }}>
            <div className="li-modal">

                {/* ── Modal header ───────────────────── */}
                <div className="li-modal-header">
                    <span className="li-modal-title">
                        <svg className="li-logo" viewBox="0 0 24 24" fill="#0A66C2" xmlns="http://www.w3.org/2000/svg"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                        LinkedIn Post Preview
                    </span>
                    <button className="li-modal-close" onClick={onClose} title="Close"><X size={14} strokeWidth={2} /></button>
                </div>

                {/* ── Scrollable content ─────────────── */}
                <div className="li-modal-body">

                    {/* LinkedIn card mockup */}
                    <div className="li-card">

                        {/* Author row */}
                        <div className="li-author-row">
                            <div className="li-avatar">
                                <svg viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/></svg>
                            </div>
                            <div className="li-author-info">
                                <div className="li-author-name">Your Name <span className="li-author-badge">• 1st</span></div>
                                <div className="li-author-headline">Your headline · {title || 'LinkedIn Post'}</div>
                                <div className="li-author-meta">Just now · 🌐</div>
                            </div>
                            <button className="li-follow-btn">+ Follow</button>
                        </div>

                        {/* Post body */}
                        <div
                            className="li-post-body"
                            dangerouslySetInnerHTML={{ __html: `<p class="li-para">${renderBody(body)}</p>` }}
                        />

                        {/* Hashtags */}
                        {hashtags && (
                            <div className="li-hashtags">
                                {hashtags.split(/\s+/).filter(h => h.startsWith('#')).map((h, i) => (
                                    <span key={i} className="li-hashtag">{h}</span>
                                ))}
                            </div>
                        )}

                        {/* Reactions bar */}
                        <div className="li-reactions-bar">
                            <div className="li-reaction-icons">
                                <span title="Like">👍</span>
                                <span title="Celebrate">🎉</span>
                                <span title="Insightful">💡</span>
                            </div>
                            <span className="li-reaction-count">Be the first to react</span>
                        </div>

                        {/* Action buttons */}
                        <div className="li-actions">
                            <button className="li-action-btn"><ThumbsUp size={14} strokeWidth={2} /> Like</button>
                            <button className="li-action-btn"><MessageCircle size={14} strokeWidth={2} /> Comment</button>
                            <button className="li-action-btn"><Repeat2 size={14} strokeWidth={2} /> Repost</button>
                            <button className="li-action-btn"><Send size={14} strokeWidth={2} /> Send</button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
