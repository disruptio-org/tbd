'use client';

import { useState } from 'react';
import { Search as SearchIcon, FileText, Brain, Loader2 } from 'lucide-react';
import '../knowledge.css';

interface SearchResult {
    id: string;
    documentId: string;
    filename: string;
    snippet: string;
    summary?: string;
    score: number;
}

export default function KnowledgeSearchPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        if (!query.trim()) return;

        setLoading(true);
        setSearched(true);
        try {
            // Use the existing /api/search endpoint (GET with ?q=)
            const res = await fetch(`/api/search?q=${encodeURIComponent(query.trim())}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.results || []);
            } else {
                setResults([]);
            }
        } catch {
            setResults([]);
        }
        setLoading(false);
    }

    return (
        <div className="knowledge-page">
            {/* Search Form */}
            <form onSubmit={handleSearch} style={{ marginBottom: 24 }}>
                <div style={{ display: 'flex', gap: 8 }}>
                    <div style={{ position: 'relative', flex: 1 }}>
                        <SearchIcon size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                        <input
                            className="knowledge-search"
                            placeholder="Ask a question or search your knowledge base..."
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            style={{ width: '100%' }}
                        />
                    </div>
                    <button
                        type="submit"
                        className="btn-brutalist btn-brutalist-primary"
                        disabled={loading || !query.trim()}
                        style={{ flexShrink: 0, display: 'flex', alignItems: 'center', gap: 6 }}
                    >
                        {loading ? <Loader2 size={14} className="spin" /> : <Brain size={14} />}
                        Search
                    </button>
                </div>
            </form>

            {/* Results */}
            {loading && (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--color-text-muted)' }}>
                    <Loader2 size={24} className="spin" style={{ marginBottom: 8 }} />
                    <p style={{ fontSize: 13 }}>Searching knowledge base...</p>
                </div>
            )}

            {!loading && searched && results.length === 0 && (
                <div className="knowledge-empty">
                    <div className="knowledge-empty-icon">
                        <SearchIcon size={40} strokeWidth={1.2} />
                    </div>
                    <h3>No results found</h3>
                    <p>Try rephrasing your query or uploading more documents.</p>
                </div>
            )}

            {!loading && results.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 4 }}>
                        {results.length} result{results.length !== 1 ? 's' : ''} found
                    </div>
                    {results.map((r, i) => (
                        <div key={r.id || i} style={{
                            background: '#1c1b1b',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: 10,
                            padding: '14px 18px',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                                <FileText size={14} style={{ color: 'var(--color-accent-primary)', flexShrink: 0 }} />
                                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                    {r.filename}
                                </span>
                                <span style={{ fontSize: 10, color: 'var(--color-text-muted)', marginLeft: 'auto' }}>
                                    {Math.round(r.score * 100)}% match
                                </span>
                            </div>
                            {r.summary && (
                                <p style={{ fontSize: 12, color: 'var(--color-text-primary)', lineHeight: 1.6, margin: '0 0 8px 0', fontStyle: 'italic' }}>
                                    {r.summary}
                                </p>
                            )}
                            <p style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5, margin: 0 }}>
                                {r.snippet?.substring(0, 300)}{r.snippet?.length > 300 ? '...' : ''}
                            </p>
                        </div>
                    ))}
                </div>
            )}

            {!loading && !searched && (
                <div className="knowledge-empty">
                    <div className="knowledge-empty-icon">
                        <Brain size={40} strokeWidth={1.2} />
                    </div>
                    <h3>Semantic Search</h3>
                    <p>Search across all your documents using AI-powered semantic understanding.</p>
                </div>
            )}
        </div>
    );
}
