'use client';

import React, { useState, useCallback, useRef } from 'react';
import {
    X, Eye, FileText, MessageSquare, History, ChevronRight,
    RefreshCw, Download, Printer, Share2, Copy, Wand2,
    MousePointer, Loader, Layers, Search, Clock, Check,
    ExternalLink,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './artifacts.css';

// ─── Types ───────────────────────────────────────────────

type ViewerTab = 'preview' | 'spec' | 'annotations' | 'history';

interface Section {
    id: string;
    label: string;
    type: string;
    headline: string;
    subtext: string;
    ctas: string[];
    items: string[];
}

interface Spec {
    objective: string;
    primaryUser: string;
    threadBehavior: string;
    outputModel: string;
    iterationModel: string;
    versioning: string;
}

interface Annotation {
    title: string;
    note: string;
}

interface Version {
    id: string;
    versionNumber: number;
    prompt?: string;
    scopeType?: string;
    selectedArea?: string | null;
    status: string;
    createdAt: string;
    summary?: string;
    outputPayload?: {
        type?: 'text' | 'wireframe';
        content?: string;
        contentStructured?: Record<string, string>;
        title?: string;
        summary?: string;
        platform?: string;
        sections?: Section[];
        spec?: Spec;
        annotations?: Annotation[];
    } | null;
}

interface ArtifactData {
    id: string;
    title: string;
    summary?: string;
    artifactType: string;
    status: string;
    metadata?: Record<string, unknown>;
    currentVersionId?: string;
}

export interface ArtifactViewerProps {
    artifact: ArtifactData;
    versions: Version[];
    onClose: () => void;
    onIterate: (prompt: string, scopeType: string, selectedArea?: string) => void;
    onRegenerate: () => void;
    onExport: () => void;
    isIterating: boolean;
}

// ─── Helpers ─────────────────────────────────────────────

function getArtifactUrl(id: string) {
    return `${window.location.origin}/artifacts/${id}`;
}

function buildMarkdownExport(artifact: ArtifactData, output: Version['outputPayload']): string {
    const lines: string[] = [`# ${artifact.title}`, ''];
    if (artifact.summary) lines.push(`> ${artifact.summary}\n`);
    if (output?.content) {
        lines.push(output.content);
    } else if (output?.contentStructured) {
        for (const [key, val] of Object.entries(output.contentStructured)) {
            lines.push(`## ${key.replace(/([A-Z])/g, ' $1').trim()}\n`, val, '');
        }
    } else if (output?.sections) {
        for (const s of output.sections) {
            lines.push(`## ${s.label}\n`, `**${s.headline}**\n`, s.subtext);
            if (s.ctas.length > 0) lines.push(`\nCTAs: ${s.ctas.join(' | ')}`);
            if (s.items.length > 0) lines.push(`\nItems: ${s.items.join(', ')}`);
            lines.push('');
        }
    }
    return lines.join('\n');
}

function openLivePreview(artifact: ArtifactData, output: Version['outputPayload'], meta: Record<string, string>) {
    const preview = window.open('', '_blank', 'width=1200,height=800');
    if (!preview) return;

    const content = output?.content || '';
    const sections = output?.sections || [];
    const isText = output?.type === 'text' || (!sections.length && content);

    let bodyHtml = '';
    if (isText) {
        bodyHtml = `<article style="max-width:800px;margin:0 auto;padding:40px 24px;font-size:15px;line-height:1.8;white-space:pre-wrap;">${
            content.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br/>')
        }</article>`;
    } else {
        bodyHtml = `<div style="max-width:960px;margin:0 auto;padding:40px 24px;">
            <nav style="display:flex;justify-content:space-between;align-items:center;padding:16px 0;border-bottom:2px solid #1e293b;margin-bottom:32px;">
                <strong style="font-size:18px;">[Logo]</strong>
                <div style="display:flex;gap:24px;font-size:14px;">Services &nbsp; About &nbsp; Contact</div>
                <strong>[CTA]</strong>
            </nav>
            ${sections.map(s => `
                <section style="margin-bottom:32px;padding:24px;border:2px solid #e2e8f0;border-radius:12px;">
                    <div style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;opacity:0.5;margin-bottom:8px;">${s.label}</div>
                    <h2 style="font-size:22px;font-weight:900;margin:0 0 8px;">${s.headline}</h2>
                    <p style="opacity:0.7;">${s.subtext}</p>
                    ${s.ctas.length > 0 ? `<div style="margin-top:12px;display:flex;gap:8px;">${s.ctas.map(c => `<button style="padding:8px 16px;background:#1e293b;color:#fff;border:none;border-radius:6px;font-weight:700;font-size:13px;cursor:pointer;">${c}</button>`).join('')}</div>` : ''}
                </section>
            `).join('')}
        </div>`;
    }

    preview.document.write(`<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><title>${artifact.title} — Live Preview</title>
<style>*{box-sizing:border-box;margin:0}body{font-family:'Inter',system-ui,sans-serif;background:#fff;color:#1e293b}
.bar{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;padding:10px 20px;background:#0f172a;color:#fff;font-size:12px}
.bar strong{font-weight:900;text-transform:uppercase;letter-spacing:.04em}.bar span{opacity:.6}</style>
</head><body><div class="bar"><strong>${artifact.title}</strong><span>${artifact.artifactType} · ${meta.audience || 'General'}</span></div>${bodyHtml}</body></html>`);
    preview.document.close();
}

// ─── Component ───────────────────────────────────────────

export function ArtifactViewer({
    artifact, versions, onClose, onIterate, onRegenerate, onExport, isIterating,
}: ArtifactViewerProps) {
    const [tab, setTab] = useState<ViewerTab>('preview');
    const [selectionMode, setSelectionMode] = useState(false);
    const [selectedArea, setSelectedArea] = useState<string | null>(null);
    const [iterationPrompt, setIterationPrompt] = useState('');
    const [scopedPrompt, setScopedPrompt] = useState('');
    const [feedback, setFeedback] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [exportMenuOpen, setExportMenuOpen] = useState(false);
    const feedbackRef = useRef<NodeJS.Timeout | null>(null);
    const copyRef = useRef<NodeJS.Timeout | null>(null);

    const currentVersion = versions.length > 0 ? versions[versions.length - 1] : null;
    const output = currentVersion?.outputPayload;
    const isTextArtifact = output?.type === 'text' || (!output?.sections?.length && output?.content);
    const sections = output?.sections || [];
    const spec = output?.spec;
    const annotations = output?.annotations || [];
    const meta = (artifact.metadata || {}) as Record<string, string>;

    const showFeedback = useCallback((msg: string) => {
        setFeedback(msg);
        if (feedbackRef.current) clearTimeout(feedbackRef.current);
        feedbackRef.current = setTimeout(() => setFeedback(null), 2500);
    }, []);

    const copyText = useCallback(async (text: string) => {
        try { await navigator.clipboard.writeText(text); } catch {
            const ta = document.createElement('textarea'); ta.value = text; ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
        }
        setCopied(true);
        if (copyRef.current) clearTimeout(copyRef.current);
        copyRef.current = setTimeout(() => setCopied(false), 2000);
    }, []);

    // ── Handlers ──────────────────────────────────────────
    const handleGlobalIterate = useCallback(() => {
        if (!iterationPrompt.trim() || isIterating) return;
        onIterate(iterationPrompt.trim(), 'global');
        setIterationPrompt('');
        setTab('history');
    }, [iterationPrompt, isIterating, onIterate]);

    const handleViewLive = useCallback(() => {
        openLivePreview(artifact, output, meta);
    }, [artifact, output, meta]);

    const handleCopyLink = useCallback(() => {
        copyText(getArtifactUrl(artifact.id));
        showFeedback('Link copied to clipboard');
    }, [artifact.id, copyText, showFeedback]);

    const handleCopyContent = useCallback(() => {
        const text = output?.content
            || (output?.contentStructured ? Object.values(output.contentStructured).join('\n\n') : '')
            || sections.map(s => `${s.label}\n${s.headline}\n${s.subtext}`).join('\n\n')
            || artifact.title;
        copyText(text);
        showFeedback('Content copied');
    }, [output, sections, artifact.title, copyText, showFeedback]);

    const handleShare = useCallback(async () => {
        const url = getArtifactUrl(artifact.id);
        if (navigator.share) {
            try { await navigator.share({ title: artifact.title, text: artifact.summary || artifact.artifactType, url }); return; } catch { /* cancelled */ }
        }
        copyText(url);
        showFeedback('Link copied to clipboard');
    }, [artifact, copyText, showFeedback]);

    const handleDuplicate = useCallback(async () => {
        try {
            const res = await fetch(`/api/artifacts/${artifact.id}/duplicate`, { method: 'POST' });
            showFeedback(res.ok ? 'Artifact duplicated' : 'Duplicate failed');
        } catch { showFeedback('Duplicate failed'); }
    }, [artifact.id, showFeedback]);

    const handleExportMd = useCallback(() => {
        const md = buildMarkdownExport(artifact, output);
        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${artifact.title.replace(/[^a-zA-Z0-9]/g, '_')}.md`; a.click();
        URL.revokeObjectURL(url);
        showFeedback('Exported as Markdown');
    }, [artifact, output, showFeedback]);

    const handleExportPng = useCallback(async () => {
        const canvas = document.querySelector('.av-canvas') as HTMLElement;
        if (!canvas) { showFeedback('No preview to export'); return; }
        try {
            const { default: html2canvas } = await import('html2canvas');
            const c = await html2canvas(canvas, { backgroundColor: '#0f172a', scale: 2 });
            const url = c.toDataURL('image/png');
            const a = document.createElement('a'); a.href = url; a.download = `${artifact.title.replace(/[^a-zA-Z0-9]/g, '_')}.png`; a.click();
            showFeedback('Exported as PNG');
        } catch { onExport(); showFeedback('Exported as JSON (PNG unavailable)'); }
    }, [artifact.title, onExport, showFeedback]);

    const tabConfig = [
        { id: 'preview', label: 'Preview', icon: Eye },
        { id: 'spec', label: 'Spec', icon: FileText },
        { id: 'annotations', label: 'Annotations', icon: MessageSquare },
        { id: 'history', label: 'History', icon: History },
    ];

    return (
        <div className="av-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
            <div className="av-modal">
                {/* Toast feedback */}
                {feedback && (
                    <div className="av-toast"><Check size={14} /> {feedback}</div>
                )}

                {/* Header */}
                <div className="av-header">
                    <div>
                        <div className="av-header-chips">
                            <span className="av-chip type">{artifact.artifactType}</span>
                            <span className="av-chip version">{currentVersion ? `v${currentVersion.versionNumber}` : 'Draft'}</span>
                            <span className="av-chip version">{new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
                        </div>
                        <div className="av-header-title">{artifact.title}</div>
                        <div className="av-header-subtitle">Full artifact viewer for preview, spec, annotations, and version history</div>
                    </div>
                    <button className="av-close-btn" onClick={onClose}>
                        <X size={16} />
                    </button>
                </div>

                {/* Tabs */}
                <div className="av-tabs">
                    {tabConfig.map(t => {
                        const Icon = t.icon;
                        return (
                            <button key={t.id} className={`av-tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id as ViewerTab)}>
                                <Icon size={13} /> {t.label}
                            </button>
                        );
                    })}
                </div>

                {/* Content */}
                <div className="av-content">
                    <div className="av-main">
                        {/* ── PREVIEW TAB ── */}
                        {tab === 'preview' && (
                            <div>
                                {isTextArtifact ? (
                                    <div className="av-canvas">
                                        <div className="av-canvas-header">
                                            <span>{artifact.artifactType}</span>
                                            <span>{meta.audience || 'General'}</span>
                                        </div>
                                        <div className="md-content" style={{ padding: '24px 28px', lineHeight: 1.7, fontSize: 14 }}>
                                            {output?.content ? (
                                                /^\s*<table/i.test(output.content.trim()) ? (
                                                    <div dangerouslySetInnerHTML={{ __html: output.content }} />
                                                ) : (
                                                    <ReactMarkdown>{output.content}</ReactMarkdown>
                                                )
                                            ) : output?.contentStructured ? (
                                                <div>
                                                    {Object.entries(output.contentStructured).map(([key, val]) => (
                                                        <div key={key} style={{ marginBottom: 16 }}>
                                                            <h4 style={{ fontWeight: 900, textTransform: 'uppercase', fontSize: 12, letterSpacing: '0.06em', marginBottom: 6 }}>
                                                                {key.replace(/([A-Z])/g, ' $1').trim()}
                                                            </h4>
                                                            <ReactMarkdown>{val}</ReactMarkdown>
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <div style={{ textAlign: 'center', padding: 40, opacity: 0.4 }}>No preview data available</div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="av-canvas">
                                        <div className="av-canvas-header">
                                            <span>{output?.platform || 'Desktop'} wireframe</span>
                                            <span>{artifact.artifactType} · {meta.audience || 'General'}</span>
                                        </div>
                                        <div className="av-canvas-nav">
                                            <div style={{ fontWeight: 900 }}>[Logo]</div>
                                            <div className="av-canvas-nav-links">
                                                <span>Services</span><span>About</span><span>Contact</span>
                                            </div>
                                            <div style={{ fontWeight: 900, textAlign: 'right' }}>[CTA]</div>
                                        </div>
                                        {sections.map(section => (
                                            <div key={section.id} className="av-canvas-section" style={{ position: 'relative' }}>
                                                <div className="av-canvas-section-title">{section.label}</div>
                                                <div className="av-canvas-headline">{section.headline}</div>
                                                <div className="av-canvas-subtext">{section.subtext}</div>
                                                {section.ctas.length > 0 && (
                                                    <div className="av-canvas-ctas">
                                                        {section.ctas.map(cta => (<span key={cta} className="av-canvas-cta">{cta}</span>))}
                                                    </div>
                                                )}
                                                {section.items.length > 0 && (
                                                    <div className="av-canvas-grid" style={{ marginTop: 10 }}>
                                                        {section.items.map(item => (
                                                            <div key={item} className="av-canvas-section" style={{ margin: 0 }}>
                                                                <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 4 }}>{item}</div>
                                                                <div className="av-canvas-subtext">Description for {item.toLowerCase()}</div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                                {selectionMode && (
                                                    <button
                                                        onClick={() => {
                                                            setSelectedArea(section.id);
                                                            if (!scopedPrompt) setScopedPrompt(`Improve ${section.label.toLowerCase()} clarity and strengthen the CTA.`);
                                                        }}
                                                        className={`av-select-overlay ${selectedArea === section.id ? 'selected' : ''}`}
                                                        style={{ position: 'absolute', inset: 0 }}
                                                    >
                                                        <span className="av-select-label">{section.label}</span>
                                                    </button>
                                                )}
                                            </div>
                                        ))}
                                        {sections.length === 0 && (
                                            <div style={{ textAlign: 'center', padding: 40, opacity: 0.4 }}>No preview data available</div>
                                        )}
                                    </div>
                                )}
                                <div className="av-canvas-actions">
                                    {!isTextArtifact && (
                                        <div className="av-canvas-actions-row">
                                            <button className="ab-btn" style={selectionMode ? { background: '#fde68a' } : {}} onClick={() => { setSelectionMode(!selectionMode); setSelectedArea(null); }}>
                                                <MousePointer size={13} /> {selectionMode ? 'Selection mode on' : 'Select area'}
                                            </button>
                                        </div>
                                    )}
                                    {isTextArtifact && (
                                        <div className="av-canvas-actions-row">
                                            <button className="ab-btn" onClick={handleCopyContent}>
                                                {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied!' : 'Copy content'}
                                            </button>
                                            <button className="ab-btn" onClick={() => setTab('history')}>
                                                <Wand2 size={13} /> Iterate
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* ── SPEC TAB ── */}
                        {tab === 'spec' && spec && (
                            <div><div className="av-spec-card">
                                <div className="av-spec-title">Structured spec</div>
                                <div className="av-spec-grid">
                                    {Object.entries(spec).map(([key, value]) => (
                                        <div key={key} className="av-spec-item">
                                            <div className="av-spec-item-label">{key.replace(/([A-Z])/g, ' $1').trim()}</div>
                                            <div className="av-spec-item-value">{value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div></div>
                        )}
                        {tab === 'spec' && !spec && (
                            <div className="av-spec-card">
                                <div className="av-spec-title">No spec data</div>
                                <div className="av-spec-item-value">Generate the artifact first to see its specification.</div>
                            </div>
                        )}

                        {/* ── ANNOTATIONS TAB ── */}
                        {tab === 'annotations' && (
                            <div>
                                {annotations.length > 0 ? annotations.map((ann, idx) => (
                                    <div key={ann.title} className="av-annotation">
                                        <div className="av-annotation-header">
                                            <div className="av-annotation-num">{idx + 1}</div>
                                            <div className="av-annotation-title">{ann.title}</div>
                                        </div>
                                        <div className="av-annotation-body">{ann.note}</div>
                                    </div>
                                )) : (
                                    <div className="av-annotation">
                                        <div className="av-annotation-title">No annotations yet</div>
                                        <div className="av-annotation-body">Generate the artifact first to see design annotations.</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* ── HISTORY TAB ── */}
                        {tab === 'history' && (
                            <div>
                                <div className="av-spec-card">
                                    <div className="av-history-header">
                                        <div>
                                            <div className="av-history-title">Version history</div>
                                            <div className="av-history-subtitle">Every refinement becomes a persistent version.</div>
                                        </div>
                                        <button className="ab-btn"><Clock size={13} /> Compare versions</button>
                                    </div>
                                    {[...versions].reverse().map((ver, idx) => (
                                        <div key={ver.id} className="av-version-card">
                                            <div className="av-version-chips">
                                                <span className="av-version-chip">v{ver.versionNumber}</span>
                                                <span className="av-version-chip">{ver.scopeType}</span>
                                                {idx === 0 && <span className="av-version-chip current">Current</span>}
                                                <span className="av-version-time">
                                                    {new Date(ver.createdAt).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="av-version-title">{ver.outputPayload?.summary || ver.summary || `Version ${ver.versionNumber}`}</div>
                                            {ver.outputPayload?.content && (
                                                <div className="av-version-content" style={{ fontSize: 12, opacity: 0.8, marginTop: 4 }}>
                                                    <ReactMarkdown>{ver.outputPayload.content.slice(0, 100) + '...'}</ReactMarkdown>
                                                </div>
                                            )}
                                            {ver.prompt && <div className="av-version-prompt">Prompt: {ver.prompt}</div>}
                                            {ver.selectedArea && <div className="av-version-area">Selected area: {ver.selectedArea}</div>}
                                        </div>
                                    ))}
                                    {versions.length === 0 && (
                                        <div className="av-version-card">
                                            <div className="av-version-title">No versions yet</div>
                                            <div className="av-version-prompt">Generate the first version to start.</div>
                                        </div>
                                    )}
                                </div>

                                <div className="av-iterate-card">
                                    <div className="av-iterate-title">Global iteration</div>
                                    <div className="av-iterate-desc">Create the next version from the existing output instead of restarting the conversation.</div>
                                    <textarea className="av-iterate-textarea" value={iterationPrompt} onChange={e => setIterationPrompt(e.target.value)} placeholder="Example: Make hero clearer and add a stronger CTA" />
                                    <div className="av-iterate-actions">
                                        <button className={`ab-btn ${!iterationPrompt.trim() ? '' : 'primary'}`} disabled={!iterationPrompt.trim() || isIterating} onClick={handleGlobalIterate}>
                                            {isIterating ? <Loader size={13} className="ab-spin" /> : <MessageSquare size={13} />} Create next version
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Sidebar */}
                    <div className="av-sidebar">
                        <div className="av-sidebar-card">
                            <div className="av-sidebar-card-title"><Search size={12} /> Quick actions</div>
                            {[
                                { icon: ExternalLink, label: 'View live artifact', action: handleViewLive },
                                { icon: RefreshCw, label: 'Regenerate', action: onRegenerate },
                                { icon: Wand2, label: 'Iterate from current', action: () => setTab('history') },
                                { icon: MousePointer, label: 'Scoped redesign', action: () => { setTab('preview'); setSelectionMode(true); } },
                                { icon: Download, label: 'Export md, png', action: () => setExportMenuOpen(!exportMenuOpen) },
                                { icon: Printer, label: 'Print viewer', action: () => window.print() },
                                { icon: Share2, label: 'Share output', action: handleShare },
                            ].map(item => {
                                const Icon = item.icon;
                                return (
                                    <button key={item.label} className="av-sidebar-action" onClick={item.action}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={12} /> {item.label}</span>
                                        <ChevronRight size={12} />
                                    </button>
                                );
                            })}
                            {exportMenuOpen && (
                                <div style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 2 }}>
                                    <button className="av-sidebar-action" onClick={() => { handleExportMd(); setExportMenuOpen(false); }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><FileText size={11} /> Markdown (.md)</span>
                                    </button>
                                    <button className="av-sidebar-action" onClick={() => { handleExportPng(); setExportMenuOpen(false); }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Download size={11} /> Image (.png)</span>
                                    </button>
                                    <button className="av-sidebar-action" onClick={() => { onExport(); setExportMenuOpen(false); }}>
                                        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Layers size={11} /> JSON (.json)</span>
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="av-sidebar-card">
                            <div className="av-sidebar-card-title">Artifact summary</div>
                            <div className="av-sidebar-field"><strong>Title:</strong> {artifact.title}</div>
                            <div className="av-sidebar-field"><strong>Goal:</strong> {meta.goal || '—'}</div>
                            <div className="av-sidebar-field"><strong>Audience:</strong> {meta.audience || '—'}</div>
                            <div className="av-sidebar-field"><strong>Status:</strong> {artifact.status}</div>
                            <div className="av-sidebar-field"><strong>Version:</strong> {currentVersion ? `v${currentVersion.versionNumber}` : '—'}</div>
                        </div>

                        <div className="av-sidebar-card">
                            <div className="av-sidebar-card-title">Overflow</div>
                            <button className="av-sidebar-action" onClick={handleCopyLink}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Copy size={12} /> {copied ? 'Copied!' : 'Copy link'}</span>
                            </button>
                            <button className="av-sidebar-action" onClick={handleShare}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Share2 size={12} /> Share</span>
                            </button>
                            <button className="av-sidebar-action" onClick={handleDuplicate}>
                                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Layers size={12} /> Duplicate</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Footer */}
                <div className="av-footer">
                    <div className="av-footer-group">
                        <button className="ab-btn primary" onClick={() => setTab('history')}><Wand2 size={13} /> Iterate</button>
                        <button className="ab-btn" onClick={handleExportMd}><Download size={13} /> Export</button>
                        <button className="ab-btn" onClick={() => window.print()}><Printer size={13} /> Print</button>
                    </div>
                    <div className="av-footer-group">
                        <button className="ab-btn" onClick={handleCopyContent}>
                            {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copied!' : 'Copy'}
                        </button>
                        <button className="ab-btn" onClick={handleShare}><Share2 size={13} /> Share</button>
                        <button className="ab-btn" onClick={onClose}><X size={13} /> Close</button>
                    </div>
                </div>
            </div>
        </div>
    );
}
