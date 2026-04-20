'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, Search } from 'lucide-react';
import './deliverables.css';

interface DeliverableItem {
    id: string;
    title: string;
    artifactType: string;
    status: string;
    content?: string;
    projectId?: string;
    projectName?: string;
    customerName?: string;
    initiativeTitle?: string;
    createdAt: string;
    updatedAt: string;
}

interface TypeCount {
    type: string;
    count: number;
}

interface ProjectOption {
    id: string;
    name: string;
}

const ARTIFACT_ICONS: Record<string, string> = {
    prd: '📄',
    wireframe: '🖼️',
    content_draft: '✏️',
    lead_list: '📋',
    campaign_plan: '📢',
    technical_plan: '⚙️',
    website_structure: '🌐',
    implementation_plan: '🗺️',
    code: '💻',
    custom: '📎',
    proposal: '📝',
    report: '📊',
    presentation: '🎯',
    email: '📧',
};

function formatDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-PT', { day: '2-digit', month: 'short', year: 'numeric' });
}

function formatTypeName(type: string): string {
    return type
        .replace(/_/g, ' ')
        .replace(/\b\w/g, (l) => l.toUpperCase());
}

export default function DeliverablesPage() {
    const [items, setItems] = useState<DeliverableItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [typeCounts, setTypeCounts] = useState<TypeCount[]>([]);
    const [projects, setProjects] = useState<ProjectOption[]>([]);
    const [loading, setLoading] = useState(true);

    // Filters
    const [search, setSearch] = useState('');
    const [selectedType, setSelectedType] = useState<string | null>(null);
    const [selectedProject, setSelectedProject] = useState('');

    const fetchData = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        params.set('page', String(page));
        params.set('limit', '20');
        if (search) params.set('search', search);
        if (selectedType) params.set('type', selectedType);
        if (selectedProject) params.set('projectId', selectedProject);

        try {
            const res = await fetch(`/api/deliverables?${params.toString()}`);
            const data = await res.json();
            setItems(data.items || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
            setTypeCounts(data.typeCounts || []);
            setProjects(data.projects || []);
        } catch {
            setItems([]);
        } finally {
            setLoading(false);
        }
    }, [page, search, selectedType, selectedProject]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    // Debounced search
    const [searchInput, setSearchInput] = useState('');
    useEffect(() => {
        const timer = setTimeout(() => {
            setSearch(searchInput);
            setPage(1);
        }, 400);
        return () => clearTimeout(timer);
    }, [searchInput]);

    const totalAll = typeCounts.reduce((sum, tc) => sum + tc.count, 0);

    if (loading && items.length === 0) {
        return (
            <div className="deliverables-page">
                <div className="deliverables-loading"><div className="spinner" /></div>
            </div>
        );
    }

    return (
        <div className="deliverables-page">
            {/* ─── Header ──────────────────────────────────── */}
            <div className="deliverables-header">
                <h1>Entregas</h1>
                <p className="deliverables-header-sub">
                    Todos os artefactos e documentos gerados pela equipa AI
                </p>
            </div>

            {/* ─── Toolbar ─────────────────────────────────── */}
            <div className="deliverables-toolbar">
                <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
                    <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                    <input
                        className="deliverables-search"
                        style={{ paddingLeft: 34 }}
                        placeholder="Pesquisar entregas..."
                        value={searchInput}
                        onChange={(e) => setSearchInput(e.target.value)}
                    />
                </div>
                {projects.length > 0 && (
                    <select
                        className="deliverables-filter-select"
                        value={selectedProject}
                        onChange={(e) => { setSelectedProject(e.target.value); setPage(1); }}
                    >
                        <option value="">Todos os projetos</option>
                        {projects.map((p) => (
                            <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                    </select>
                )}
            </div>

            {/* ─── Type Chips ──────────────────────────────── */}
            {typeCounts.length > 0 && (
                <div className="deliverables-type-chips">
                    <button
                        className={`deliverables-type-chip ${!selectedType ? 'active' : ''}`}
                        onClick={() => { setSelectedType(null); setPage(1); }}
                    >
                        Todas <span className="deliverables-type-chip-count">{totalAll}</span>
                    </button>
                    {typeCounts.map((tc) => (
                        <button
                            key={tc.type}
                            className={`deliverables-type-chip ${selectedType === tc.type ? 'active' : ''}`}
                            onClick={() => { setSelectedType(selectedType === tc.type ? null : tc.type); setPage(1); }}
                        >
                            {ARTIFACT_ICONS[tc.type] || '📎'} {formatTypeName(tc.type)}
                            <span className="deliverables-type-chip-count">{tc.count}</span>
                        </button>
                    ))}
                </div>
            )}

            {/* ─── Grid ────────────────────────────────────── */}
            {items.length === 0 ? (
                <div className="deliverables-empty">
                    <div className="deliverables-empty-icon">
                        <FileText size={40} strokeWidth={1.2} />
                    </div>
                    <h3>Sem entregas</h3>
                    <p>
                        {search || selectedType || selectedProject
                            ? 'Nenhuma entrega encontrada com os filtros selecionados.'
                            : 'Inicie uma iniciativa no Boardroom para começar a gerar entregas.'
                        }
                    </p>
                </div>
            ) : (
                <>
                    <div className="deliverables-grid">
                        {items.map((item) => (
                            <div key={item.id} className="deliverable-card">
                                <div className="deliverable-card-top">
                                    <div className="deliverable-card-icon">
                                        {ARTIFACT_ICONS[item.artifactType] || '📎'}
                                    </div>
                                    <div className="deliverable-card-info">
                                        <div className="deliverable-card-title">{item.title}</div>
                                        <span className="deliverable-card-type">{formatTypeName(item.artifactType)}</span>
                                    </div>
                                </div>

                                {item.content && (
                                    <div className="deliverable-card-preview">{item.content}</div>
                                )}

                                <div className="deliverable-card-meta">
                                    <span className="deliverable-card-project">
                                        {item.projectName || item.initiativeTitle || '—'}
                                    </span>
                                    <span className="deliverable-card-date">{formatDate(item.createdAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* ─── Pagination ───────────────────────── */}
                    {totalPages > 1 && (
                        <div className="deliverables-pagination">
                            <button
                                className="deliverables-page-btn"
                                disabled={page <= 1}
                                onClick={() => setPage((p) => Math.max(1, p - 1))}
                            >
                                ← Anterior
                            </button>
                            <span className="deliverables-page-info">
                                {page} de {totalPages} ({total} entregas)
                            </span>
                            <button
                                className="deliverables-page-btn"
                                disabled={page >= totalPages}
                                onClick={() => setPage((p) => p + 1)}
                            >
                                Próxima →
                            </button>
                        </div>
                    )}
                </>
            )}
        </div>
    );
}
