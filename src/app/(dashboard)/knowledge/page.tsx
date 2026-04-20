'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    FileText, Search, Brain, FolderOpen, BookOpen,
} from 'lucide-react';
import './knowledge.css';

interface DocItem {
    id: string;
    filename: string;
    size: number;
    ocrStatus: string;
    isKnowledge: boolean;
    category?: string;
    folderId?: string;
    folderName?: string;
    createdAt: string;
}

function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString('pt-PT', { day: '2-digit', month: 'short' });
}

type Tab = 'all' | 'knowledge' | 'pending';

export default function KnowledgePage() {
    const [docs, setDocs] = useState<DocItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [tab, setTab] = useState<Tab>('all');
    const [searchInput, setSearchInput] = useState('');
    const [search, setSearch] = useState('');

    // Stats
    const [stats, setStats] = useState({
        totalDocs: 0,
        knowledgeDocs: 0,
        pendingDocs: 0,
        totalSize: 0,
    });

    const fetchDocs = useCallback(async () => {
        setLoading(true);
        try {
            // Use /api/documents/upload (GET) — the same endpoint the Documents page uses
            const res = await fetch('/api/documents/upload');
            if (!res.ok) {
                console.error('[Knowledge] Failed to fetch documents:', res.status);
                setDocs([]);
                return;
            }

            const raw = await res.json();
            // /api/documents/upload returns a flat array of documents
            const docsArray = Array.isArray(raw) ? raw : (raw.documents || []);
            
            const allDocs: DocItem[] = docsArray.map((d: Record<string, unknown>) => ({
                id: d.id as string,
                filename: d.filename as string,
                size: (d.size as number) || 0,
                ocrStatus: (d.ocrStatus as string) || 'PENDING',
                isKnowledge: (d.useAsKnowledgeSource as boolean) || false,
                category: d.category as string | undefined,
                folderId: d.folderId as string | undefined,
                folderName: undefined,
                createdAt: d.createdAt as string,
            }));

            // Apply client-side search if needed
            const filtered = search
                ? allDocs.filter(d => d.filename.toLowerCase().includes(search.toLowerCase()))
                : allDocs;

            setDocs(filtered);
            setStats({
                totalDocs: allDocs.length,
                knowledgeDocs: allDocs.filter((d) => d.isKnowledge).length,
                pendingDocs: allDocs.filter((d) => d.ocrStatus === 'PENDING' || d.ocrStatus === 'PROCESSING').length,
                totalSize: allDocs.reduce((sum, d) => sum + (d.size || 0), 0),
            });
        } catch (err) {
            console.error('[Knowledge] Fetch error:', err);
            setDocs([]);
        } finally {
            setLoading(false);
        }
    }, [search]);

    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    // Debounced search
    useEffect(() => {
        const timer = setTimeout(() => setSearch(searchInput), 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    // Filter by tab
    const filteredDocs = docs.filter((d) => {
        if (tab === 'knowledge') return d.isKnowledge;
        if (tab === 'pending') return d.ocrStatus === 'PENDING' || d.ocrStatus === 'PROCESSING';
        return true;
    });

    if (loading && docs.length === 0) {
        return (
            <div className="knowledge-page">
                <div className="knowledge-loading"><div className="spinner" /></div>
            </div>
        );
    }

    return (
        <div className="knowledge-page">


            {/* ─── Stats ───────────────────────────────────── */}
            <div className="knowledge-stats">
                <div className="knowledge-stat-card">
                    <div className="knowledge-stat-value">{stats.totalDocs}</div>
                    <div className="knowledge-stat-label">Documents</div>
                </div>
                <div className="knowledge-stat-card">
                    <div className="knowledge-stat-value">{stats.knowledgeDocs}</div>
                    <div className="knowledge-stat-label">Knowledge Sources</div>
                </div>
                <div className="knowledge-stat-card">
                    <div className="knowledge-stat-value">{stats.pendingDocs}</div>
                    <div className="knowledge-stat-label">Processing</div>
                </div>
                <div className="knowledge-stat-card">
                    <div className="knowledge-stat-value">{formatSize(stats.totalSize)}</div>
                    <div className="knowledge-stat-label">Total Size</div>
                </div>
            </div>

            {/* ─── Toolbar ─────────────────────────────────── */}
            <div className="knowledge-toolbar">
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                    <input
                        className="knowledge-search"
                        placeholder="Search documents..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </div>
            </div>

            {/* ─── Tabs ────────────────────────────────────── */}
            <div className="knowledge-tabs">
                <button
                    className={`knowledge-tab ${tab === 'all' ? 'active' : ''}`}
                    onClick={() => setTab('all')}
                >
                    <FolderOpen size={14} style={{ verticalAlign: -2 }} /> All
                    <span className="knowledge-tab-count">{stats.totalDocs}</span>
                </button>
                <button
                    className={`knowledge-tab ${tab === 'knowledge' ? 'active' : ''}`}
                    onClick={() => setTab('knowledge')}
                >
                    <Brain size={14} style={{ verticalAlign: -2 }} /> Knowledge
                    <span className="knowledge-tab-count">{stats.knowledgeDocs}</span>
                </button>
                <button
                    className={`knowledge-tab ${tab === 'pending' ? 'active' : ''}`}
                    onClick={() => setTab('pending')}
                >
                    <BookOpen size={14} style={{ verticalAlign: -2 }} /> Processing
                    <span className="knowledge-tab-count">{stats.pendingDocs}</span>
                </button>
            </div>

            {/* ─── Document List ────────────────────────────── */}
            {filteredDocs.length === 0 ? (
                <div className="knowledge-empty">
                    <div className="knowledge-empty-icon">
                        <FileText size={40} strokeWidth={1.2} />
                    </div>
                    <h3>
                        {tab === 'knowledge' ? 'No knowledge sources' :
                            tab === 'pending' ? 'No documents processing' :
                                'No documents'}
                    </h3>
                    <p>
                        {search
                            ? 'No documents found matching your search.'
                            : 'Upload documents to build your company knowledge base.'
                        }
                    </p>
                </div>
            ) : (
                <div className="knowledge-list">
                    {filteredDocs.map((doc) => {
                        const ocrLabel = doc.ocrStatus === 'PROCESSED' ? 'Processed' :
                            doc.ocrStatus === 'PENDING' ? 'Pending' :
                                doc.ocrStatus === 'PROCESSING' ? 'Processing' : 'Error';
                        const ocrClass = doc.ocrStatus === 'PROCESSED' ? 'processed' :
                            doc.ocrStatus === 'FAILED' ? 'failed' : 'pending';

                        return (
                            <div key={doc.id} className="knowledge-doc-item">
                                <div className="knowledge-doc-icon">
                                    <FileText size={18} strokeWidth={1.8} />
                                </div>
                                <div className="knowledge-doc-info">
                                    <div className="knowledge-doc-name">{doc.filename}</div>
                                    <div className="knowledge-doc-meta">
                                        {doc.folderName && <span>📁 {doc.folderName}</span>}
                                        {doc.category && <span>{doc.category}</span>}
                                    </div>
                                </div>
                                {doc.isKnowledge && (
                                    <span className="knowledge-doc-badge knowledge">Knowledge</span>
                                )}
                                <span className={`knowledge-doc-badge ${ocrClass}`}>{ocrLabel}</span>
                                <span className="knowledge-doc-size">{formatSize(doc.size)}</span>
                                <span className="knowledge-doc-date">{formatDate(doc.createdAt)}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}
