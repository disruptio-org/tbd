'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Brain, ChevronLeft, ChevronRight, Crosshair, Loader2, Plus, Send, X, ZoomIn, Layers } from 'lucide-react';

interface ImageArtifact {
    id: string;
    title: string;
    contentUrl: string | null;
    content: string | null;
    artifactType: string;
}

interface Selection {
    x: number;
    y: number;
    width: number;
    height: number;
}

interface ParsedPage {
    title: string;
    description: string;
}

interface Props {
    artifacts: ImageArtifact[];
    initiativeId: string;
    taskId: string;
    taskTitle: string;
    taskDescription: string | null;
    onRefresh: () => void;
}

/**
 * Parse wireframe specification text to extract individual page definitions.
 * Handles numbered lists like "1. **Homepage**:" or "1. Homepage:" etc.
 */
function parsePages(text: string): ParsedPage[] {
    const pages: ParsedPage[] = [];

    // Split by numbered entries like "1. **Homepage**:" or "1. Homepage:"
    const pageRegex = /\d+\.\s+\*{0,2}([^*:\n]+?)\*{0,2}\s*(?:Page)?\s*:/gi;
    const matches = [...text.matchAll(pageRegex)];

    for (let i = 0; i < matches.length; i++) {
        const match = matches[i];
        const title = match[1].trim().replace(/\*{1,2}/g, '');
        const startIdx = match.index! + match[0].length;
        const endIdx = i + 1 < matches.length ? matches[i + 1].index! : text.length;
        const sectionText = text.substring(startIdx, endIdx).trim();

        // Extract bullet points as layout description
        const bullets = sectionText
            .split('\n')
            .map(line => line.replace(/^\s*[-–•*]+\s*/, '').replace(/\*{1,2}/g, '').trim())
            .filter(line => line.length > 5)
            .join('. ');

        if (title && bullets) {
            pages.push({
                title: title.replace(/\s*Page$/i, ''),
                description: bullets.substring(0, 500),
            });
        }
    }

    return pages;
}

export default function ImageViewer({ artifacts, initiativeId, taskId, taskTitle, taskDescription, onRefresh }: Props) {
    const imageArtifacts = artifacts.filter(a => a.artifactType === 'image' && a.contentUrl);
    const textArtifacts = artifacts.filter(a => a.artifactType !== 'image' && a.content);
    
    const [activeIndex, setActiveIndex] = useState(0);
    const [selectMode, setSelectMode] = useState(false);
    const [selection, setSelection] = useState<Selection | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [editPrompt, setEditPrompt] = useState('');
    const [isEditing, setIsEditing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatePrompt, setGeneratePrompt] = useState('');
    const [generateTitle, setGenerateTitle] = useState('');
    const [showGenerateForm, setShowGenerateForm] = useState(false);

    // Auto-generate state
    const [isAutoGenerating, setIsAutoGenerating] = useState(false);
    const [autoProgress, setAutoProgress] = useState({ current: 0, total: 0, pageName: '' });

    const imageRef = useRef<HTMLImageElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const currentArtifact = imageArtifacts[activeIndex];

    // Parse pages from artifact text
    const parsedPages: ParsedPage[] = [];
    for (const art of textArtifacts) {
        if (art.content) {
            parsedPages.push(...parsePages(art.content));
        }
    }
    // Also try parsing from taskDescription if no text artifacts
    if (parsedPages.length === 0 && taskDescription) {
        parsedPages.push(...parsePages(taskDescription));
    }

    // Find which pages haven't been generated yet
    const existingTitles = new Set(imageArtifacts.map(a => a.title.toLowerCase()));
    const pendingPages = parsedPages.filter(p => !existingTitles.has(p.title.toLowerCase()));
    const hasUngenerated = pendingPages.length > 0;

    // Mouse handlers for area selection
    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        if (!selectMode || !imageRef.current) return;
        
        const rect = imageRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        setDragStart({ x, y });
        setIsDragging(true);
        setSelection(null);
    }, [selectMode]);

    const handleMouseMove = useCallback((e: React.MouseEvent) => {
        if (!isDragging || !dragStart || !imageRef.current) return;
        
        const rect = imageRef.current.getBoundingClientRect();
        const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
        const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height));

        setSelection({
            x: Math.min(dragStart.x, x),
            y: Math.min(dragStart.y, y),
            width: Math.abs(x - dragStart.x),
            height: Math.abs(y - dragStart.y),
        });
    }, [isDragging, dragStart]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setDragStart(null);
    }, []);

    // Generate a single wireframe
    async function generateSinglePage(title: string, description: string): Promise<boolean> {
        try {
            const res = await fetch(`/api/boardroom/initiatives/${initiativeId}/tasks/${taskId}/generate-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: description, pageTitle: title }),
            });
            return res.ok;
        } catch {
            return false;
        }
    }

    // Manual single page generation
    async function handleGenerate() {
        if (!generatePrompt.trim() || isGenerating) return;
        setIsGenerating(true);

        const ok = await generateSinglePage(
            generateTitle || generatePrompt.substring(0, 40),
            generatePrompt,
        );

        if (ok) {
            await onRefresh();
            setGeneratePrompt('');
            setGenerateTitle('');
            setShowGenerateForm(false);
            setTimeout(() => setActiveIndex(imageArtifacts.length), 100);
        }
        setIsGenerating(false);
    }

    // Auto-generate ALL parsed pages sequentially
    async function handleAutoGenerateAll() {
        if (isAutoGenerating || pendingPages.length === 0) return;
        setIsAutoGenerating(true);
        setAutoProgress({ current: 0, total: pendingPages.length, pageName: '' });

        for (let i = 0; i < pendingPages.length; i++) {
            const page = pendingPages[i];
            setAutoProgress({ current: i + 1, total: pendingPages.length, pageName: page.title });
            await generateSinglePage(page.title, page.description);
            // Refresh after each to show progress
            await onRefresh();
        }

        setIsAutoGenerating(false);
        setAutoProgress({ current: 0, total: 0, pageName: '' });
        setActiveIndex(0);
    }

    // Edit selected area
    async function handleEdit() {
        if (!selection || !editPrompt.trim() || !currentArtifact || isEditing) return;
        setIsEditing(true);

        const imgEl = imageRef.current;
        const imgWidth = imgEl?.clientWidth || 1024;
        const imgHeight = imgEl?.clientHeight || 1024;

        try {
            const res = await fetch(`/api/boardroom/initiatives/${initiativeId}/tasks/${taskId}/edit-image`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    artifactId: currentArtifact.id,
                    selection,
                    prompt: editPrompt,
                    imageWidth: imgWidth,
                    imageHeight: imgHeight,
                }),
            });

            if (res.ok) {
                await onRefresh();
                setSelection(null);
                setEditPrompt('');
                setSelectMode(false);
            }
        } catch { /* ignore */ }
        setIsEditing(false);
    }

    return (
        <div className="boardroom-img-viewer">
            {/* Toolbar */}
            <div className="boardroom-img-toolbar">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {imageArtifacts.length > 0 && (
                        <>
                            <button
                                className="boardroom-img-btn"
                                onClick={() => setActiveIndex(Math.max(0, activeIndex - 1))}
                                disabled={activeIndex === 0}
                            >
                                <ChevronLeft size={14} />
                            </button>
                            <span className="boardroom-img-counter">
                                {activeIndex + 1} / {imageArtifacts.length}
                            </span>
                            <button
                                className="boardroom-img-btn"
                                onClick={() => setActiveIndex(Math.min(imageArtifacts.length - 1, activeIndex + 1))}
                                disabled={activeIndex >= imageArtifacts.length - 1}
                            >
                                <ChevronRight size={14} />
                            </button>
                        </>
                    )}
                    {currentArtifact && (
                        <span className="boardroom-img-title">{currentArtifact.title}</span>
                    )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    {imageArtifacts.length > 0 && (
                        <button
                            className={`boardroom-img-btn ${selectMode ? 'active' : ''}`}
                            onClick={() => { setSelectMode(!selectMode); setSelection(null); }}
                        >
                            <Crosshair size={13} />
                            {selectMode ? 'Cancel Select' : 'Select Area'}
                        </button>
                    )}
                    <button
                        className="boardroom-img-btn generate"
                        onClick={() => setShowGenerateForm(!showGenerateForm)}
                    >
                        <Plus size={13} /> Generate Page
                    </button>
                </div>
            </div>

            {/* Auto-Generate Banner (when text artifact has pages that haven't been generated) */}
            {hasUngenerated && !isAutoGenerating && (
                <div className="boardroom-img-auto-banner">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1 }}>
                        <Layers size={16} />
                        <div>
                            <div style={{ fontSize: 11, fontWeight: 800 }}>
                                {pendingPages.length} page{pendingPages.length > 1 ? 's' : ''} detected from wireframe spec
                            </div>
                            <div style={{ fontSize: 10, opacity: 0.8, marginTop: 2 }}>
                                {pendingPages.map(p => p.title).join(' · ')}
                            </div>
                        </div>
                    </div>
                    <button
                        className="btn-brutalist btn-brutalist-primary"
                        style={{ padding: '6px 14px', fontSize: 10, boxShadow: '2px 2px 0px #000' }}
                        onClick={handleAutoGenerateAll}
                    >
                        <Brain size={12} /> Generate All Wireframes
                    </button>
                </div>
            )}

            {/* Auto-Generate Progress */}
            {isAutoGenerating && (
                <div className="boardroom-img-auto-progress">
                    <Loader2 size={16} className="spin" />
                    <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 11, fontWeight: 800 }}>
                            Generating {autoProgress.pageName}... ({autoProgress.current}/{autoProgress.total})
                        </div>
                        <div style={{
                            height: 4,
                            background: 'rgba(255,255,255,0.15)',
                            marginTop: 6,
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                height: '100%',
                                background: 'var(--color-accent-primary)',
                                width: `${(autoProgress.current / autoProgress.total) * 100}%`,
                                transition: 'width 0.5s ease',
                            }} />
                        </div>
                    </div>
                </div>
            )}

            {/* Generate Form (manual single page) */}
            {showGenerateForm && (
                <div className="boardroom-img-generate-form">
                    <input
                        className="boardroom-img-input"
                        type="text"
                        placeholder="Page title (e.g. Homepage, About Us, Contact)"
                        value={generateTitle}
                        onChange={e => setGenerateTitle(e.target.value)}
                    />
                    <input
                        className="boardroom-img-input"
                        type="text"
                        placeholder="Describe the page layout and content..."
                        value={generatePrompt}
                        onChange={e => setGeneratePrompt(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleGenerate(); }}
                    />
                    <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                        <button
                            className="btn-brutalist btn-brutalist-outline"
                            style={{ padding: '6px 12px', fontSize: 10 }}
                            onClick={() => setShowGenerateForm(false)}
                        >
                            Cancel
                        </button>
                        <button
                            className="btn-brutalist btn-brutalist-primary"
                            style={{ padding: '6px 12px', fontSize: 10 }}
                            onClick={handleGenerate}
                            disabled={isGenerating || !generatePrompt.trim()}
                        >
                            {isGenerating ? <Loader2 size={12} className="spin" /> : <Brain size={12} />}
                            {isGenerating ? 'Generating...' : 'Generate Wireframe'}
                        </button>
                    </div>
                </div>
            )}

            {/* Image Viewer */}
            {imageArtifacts.length === 0 && !isAutoGenerating ? (
                <div className="boardroom-img-empty">
                    <ZoomIn size={28} style={{ opacity: 0.3, marginBottom: 8 }} />
                    <div>No wireframe images yet.</div>
                    {hasUngenerated ? (
                        <div style={{ fontSize: 11, marginTop: 4 }}>
                            Click <strong>&ldquo;Generate All Wireframes&rdquo;</strong> above to auto-create all pages.
                        </div>
                    ) : (
                        <div style={{ fontSize: 11, marginTop: 4 }}>
                            Click <strong>&ldquo;Generate Page&rdquo;</strong> to create wireframe mockups.
                        </div>
                    )}
                </div>
            ) : currentArtifact?.contentUrl ? (
                <div
                    ref={containerRef}
                    className={`boardroom-img-canvas ${selectMode ? 'select-mode' : ''}`}
                    onMouseDown={handleMouseDown}
                    onMouseMove={handleMouseMove}
                    onMouseUp={handleMouseUp}
                    onMouseLeave={handleMouseUp}
                >
                    <img
                        ref={imageRef}
                        src={currentArtifact.contentUrl}
                        alt={currentArtifact.title}
                        className="boardroom-img-image"
                        draggable={false}
                    />

                    {/* Selection Rectangle */}
                    {selection && selection.width > 5 && selection.height > 5 && (
                        <div
                            className="boardroom-img-selection"
                            style={{
                                left: selection.x,
                                top: selection.y,
                                width: selection.width,
                                height: selection.height,
                            }}
                        />
                    )}

                    {/* Loading overlay */}
                    {isEditing && (
                        <div className="boardroom-img-loading">
                            <Loader2 size={32} className="spin" />
                            <span>Editing wireframe...</span>
                        </div>
                    )}
                </div>
            ) : null}

            {/* Edit Prompt (visible when area selected) */}
            {selection && selection.width > 5 && selection.height > 5 && !isEditing && (
                <div className="boardroom-img-edit-bar">
                    <div className="boardroom-img-edit-info">
                        <Crosshair size={12} />
                        <span>Area selected ({Math.round(selection.width)}×{Math.round(selection.height)}px)</span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flex: 1 }}>
                        <input
                            className="boardroom-img-input"
                            type="text"
                            placeholder="Describe what to change in this area..."
                            value={editPrompt}
                            onChange={e => setEditPrompt(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Enter') handleEdit(); }}
                            autoFocus
                        />
                        <button
                            className="btn-brutalist btn-brutalist-primary"
                            style={{ padding: '6px 12px', fontSize: 10, whiteSpace: 'nowrap' }}
                            onClick={handleEdit}
                            disabled={!editPrompt.trim()}
                        >
                            <Send size={12} /> Apply Edit
                        </button>
                        <button
                            className="boardroom-img-btn"
                            onClick={() => { setSelection(null); setEditPrompt(''); }}
                        >
                            <X size={12} />
                        </button>
                    </div>
                </div>
            )}

            {/* Thumbnail Strip */}
            {imageArtifacts.length > 1 && (
                <div className="boardroom-img-thumbs">
                    {imageArtifacts.map((art, i) => (
                        <div
                            key={art.id}
                            className={`boardroom-img-thumb ${i === activeIndex ? 'active' : ''}`}
                            onClick={() => { setActiveIndex(i); setSelection(null); setSelectMode(false); }}
                        >
                            {art.contentUrl && (
                                <img src={art.contentUrl} alt={art.title} />
                            )}
                            <span>{art.title}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
