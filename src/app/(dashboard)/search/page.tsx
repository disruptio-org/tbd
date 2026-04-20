'use client';

import { useState } from 'react';
import { Search, FileText, BookOpen } from 'lucide-react';

import DocumentViewerModal from '../documents/[id]/DocumentViewerModal';

interface SearchResult {
    id: string;
    documentId: string;
    filename: string;
    snippet: string;
    summary?: string;
    score: number;
}

interface SelectedDoc {
    documentId: string;
    filename: string;
    mimeType: string;
}

export default function SearchPage() {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<SearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [searched, setSearched] = useState(false);
    const [selectedDoc, setSelectedDoc] = useState<SelectedDoc | null>(null);
    const [filters, setFilters] = useState({
        type: '',
        dateFrom: '',
        dateTo: '',
    });

    async function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        if (!query.trim()) return;
        setLoading(true);
        setSearched(true);

        try {
            const params = new URLSearchParams({ q: query });
            if (filters.type) params.set('type', filters.type);
            if (filters.dateFrom) params.set('from', filters.dateFrom);
            if (filters.dateTo) params.set('to', filters.dateTo);

            const res = await fetch(`/api/search?${params.toString()}`);
            if (res.ok) {
                const data = await res.json();
                setResults(data.results || []);
            }
        } catch (err) {
            console.error('Search failed:', err);
        }

        setLoading(false);
    }

    function highlightText(text: string, searchQuery: string): React.ReactNode {
        if (!searchQuery.trim()) return text;
        const words = searchQuery.toLowerCase().split(/\s+/).filter(w => w.length > 2);
        if (words.length === 0) return text;

        const regex = new RegExp(`(${words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
        const parts = text.split(regex);

        return parts.map((part, i) =>
            words.some(w => part.toLowerCase() === w)
                ? <mark key={i} style={{ background: 'rgba(215, 58, 58, 0.15)', color: 'inherit', padding: '1px 2px', borderRadius: '2px' }}>{part}</mark>
                : part
        );
    }

    /** Clean up raw extracted text for display */
    function formatSnippet(raw: string): string {
        let text = raw
            .replace(/\*\*/g, '')                    // remove markdown bold markers
            .replace(/---/g, '\n')                   // convert markdown hr to newline
            .replace(/ {2,}/g, ' ')                  // collapse multiple spaces
            .replace(/\n{3,}/g, '\n\n')              // limit consecutive newlines
            .trim();

        // Convert " - " at the start of phrases to bullet-style lines
        text = text.replace(/ - /g, '\n• ');

        return text;
    }

    /** Convert basic markdown to HTML for summary display */
    function renderMarkdown(text: string): string {
        let html = text
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')  // escape HTML
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');                    // bold

        // Convert numbered lists to proper <ol><li> structure
        const lines = html.split('\n');
        let inList = false;
        const processed: string[] = [];
        for (const line of lines) {
            const listMatch = line.match(/^\d+\.\s+(.+)/);
            if (listMatch) {
                if (!inList) { processed.push('<ol style="margin:8px 0;padding-left:20px">'); inList = true; }
                processed.push(`<li style="margin-bottom:4px">${listMatch[1]}</li>`);
            } else {
                if (inList) { processed.push('</ol>'); inList = false; }
                if (line.trim()) processed.push(`<p style="margin:6px 0">${line}</p>`);
            }
        }
        if (inList) processed.push('</ol>');
        return processed.join('');
    }

    return (
        <div>
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><Search size={20} strokeWidth={2} /></span>
                    <h1>Search</h1>
                </div>
            </div>

            {/* Search bar */}
            <form onSubmit={handleSearch} className="mb-lg">
                <div className="flex gap-sm">
                    <input
                        className="input"
                        type="text"
                        placeholder="Ex: qual é a política de devolução?"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        style={{ flex: 1 }}
                    />
                    <button className="btn btn-primary" type="submit" disabled={loading}>
                        {loading ? 'A pesquisar…' : 'Pesquisar'}
                    </button>
                </div>
            </form>

            {/* Filters */}
            <div className="card mb-lg" style={{ padding: 'var(--space-sm) var(--space-md)' }}>
                <div className="flex gap-md items-center" style={{ flexWrap: 'wrap' }}>
                    <span className="section-label">Filtros</span>
                    <select
                        className="select"
                        style={{ width: 'auto', minWidth: 160 }}
                        value={filters.type}
                        onChange={(e) => setFilters((f) => ({ ...f, type: e.target.value }))}
                    >
                        <option value="">Todos os tipos</option>
                        <option value="pdf">PDF</option>
                        <option value="docx">DOCX</option>
                        <option value="image">Imagens</option>
                    </select>
                    <div className="flex gap-xs items-center">
                        <label className="text-muted" style={{ fontSize: 'var(--font-size-caption)' }}>De:</label>
                        <input
                            className="input"
                            type="date"
                            style={{ width: 'auto' }}
                            value={filters.dateFrom}
                            onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value }))}
                        />
                    </div>
                    <div className="flex gap-xs items-center">
                        <label className="text-muted" style={{ fontSize: 'var(--font-size-caption)' }}>Até:</label>
                        <input
                            className="input"
                            type="date"
                            style={{ width: 'auto' }}
                            value={filters.dateTo}
                            onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value }))}
                        />
                    </div>
                </div>
            </div>

            {/* Results */}
            {loading && (
                <div className="flex justify-center" style={{ padding: 'var(--space-xl)' }}>
                    <div className="spinner" />
                </div>
            )}

            {!loading && searched && results.length === 0 && (
                <div className="empty-state">
                    <div className="empty-state-icon"><Search size={32} /></div>
                    <h3>Sem resultados</h3>
                    <p className="text-secondary mt-xs">
                        Tente reformular a sua pesquisa ou ajustar os filtros.
                        Certifique-se de que os documentos foram processados por OCR.
                    </p>
                </div>
            )}

            {!loading && results.length > 0 && (
                <div className="flex flex-col gap-sm">
                    <p className="text-muted" style={{ fontSize: 'var(--font-size-caption)' }}>
                        {results.length} documento{results.length !== 1 ? 's' : ''} encontrado{results.length !== 1 ? 's' : ''}
                    </p>
                    {results.map((result) => (
                        <div key={result.id} className="card card-elevated" style={{ padding: 'var(--space-md)' }}>
                            {/* Header */}
                            <div className="flex justify-between items-center" style={{ marginBottom: 'var(--space-sm)' }}>
                                <div className="flex items-center" style={{ gap: 'var(--space-xs)' }}>
                                    <span style={{ fontSize: 20 }}><FileText size={20} /></span>
                                    <h3 style={{ fontSize: 'var(--font-size-body)', fontWeight: 600, margin: 0 }}>
                                        {result.filename}
                                    </h3>
                                </div>
                                <span style={{
                                    fontSize: 'var(--font-size-caption)',
                                    color: 'var(--color-text-muted)',
                                    background: 'var(--color-bg-surface)',
                                    padding: '2px 8px',
                                    borderRadius: 'var(--radius-sm)',
                                }}>
                                    {(result.score * 100).toFixed(0)}% relevante
                                </span>
                            </div>

                            {/* AI Summary */}
                            {result.summary && (
                                <div
                                    style={{
                                        fontSize: 'var(--font-size-small)',
                                        lineHeight: 1.65,
                                        color: 'var(--color-text-primary)',
                                        padding: 'var(--space-sm) var(--space-md)',
                                        background: 'var(--color-bg-surface)',
                                        borderRadius: 'var(--radius-md)',
                                        borderLeft: '3px solid var(--color-accent-red)',
                                        marginBottom: 'var(--space-sm)',
                                    }}
                                    dangerouslySetInnerHTML={{ __html: renderMarkdown(result.summary) }}
                                />
                            )}

                            {/* View document button */}
                            <button
                                onClick={() => setSelectedDoc({
                                    documentId: result.documentId,
                                    filename: result.filename,
                                    mimeType: '',
                                })}
                                style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    gap: 'var(--space-xs)',
                                    fontSize: 'var(--font-size-small)',
                                    color: 'var(--color-accent-red)',
                                    background: 'none',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontWeight: 500,
                                    padding: '4px 0',
                                    transition: 'opacity 150ms ease',
                                }}
                            >
                                <BookOpen size={14} strokeWidth={2} /> Ver documento e conversar com IA →
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Document Viewer Modal */}
            {selectedDoc && (
                <DocumentViewerModal
                    documentId={selectedDoc.documentId}
                    filename={selectedDoc.filename}
                    mimeType={selectedDoc.mimeType}
                    onClose={() => setSelectedDoc(null)}
                />
            )}
        </div>
    );
}
