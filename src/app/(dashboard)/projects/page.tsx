'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUIFeedback } from '@/components/UIFeedback';
import VoiceRantBrief from '@/components/VoiceRantBrief';
import {
    FolderKanban, Plus, Search, ArrowRight, Loader2,
    FileText, Building2, Calendar, LayoutGrid, X,
} from 'lucide-react';
import './projects.css';

const PROJECT_VOICE_SCHEMA = {
    name: "A short, catchy name for the project (e.g., 'Acme Corp Rebranding', 'Q4 Marketing Push', 'New Website Launch').",
    description: "A very brief 1-2 sentence description summarizing what the project is about.",
    contextText: "Detailed instructions, context, target audience, and specific rules the AI should follow when generating content for this project.",
};

/* ─── Types ───────────────────────────────────────────── */

interface Project {
    id: string;
    name: string;
    description: string | null;
    contextText: string | null;
    customerId: string | null;
    customerName: string | null;
    status: string;
    documentCount: number;
    createdAt: string;
}

/* ─── Helper: Project Initials ────────────────────────── */

function getInitials(name: string): string {
    return name.split(/[\s\-_]+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/* ─── Main Component ──────────────────────────────────── */

export default function ProjectsPage() {
    const router = useRouter();
    const { showToast } = useUIFeedback();

    const [projects, setProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [customerFilter, setCustomerFilter] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [saving, setSaving] = useState(false);
    const [formParams, setFormParams] = useState({ name: '', description: '', contextText: '' });
    const [statusFilter, setStatusFilter] = useState<'active' | 'archived'>('active');
    const searchParams = useSearchParams();

    // Sync header tab with statusFilter
    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab === 'archived') setStatusFilter('archived');
        else setStatusFilter('active');
    }, [searchParams]);

    /* ─── Load Projects ──────────────────────────────── */

    const loadProjects = useCallback(async () => {
        try {
            const res = await fetch('/api/projects');
            const data = await res.json();
            if (data.projects) setProjects(data.projects);
        } catch (err) {
            console.error('[projects] Failed to load:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadProjects(); }, [loadProjects]);

    /* ─── Create / Edit Project ──────────────────────── */

    function openCreate() {
        setEditId(null);
        setFormParams({ name: '', description: '', contextText: '' });
        setShowModal(true);
    }

    async function handleSave(e: React.FormEvent) {
        e.preventDefault();
        if (!formParams.name.trim()) return;

        setSaving(true);
        try {
            const url = editId ? `/api/projects/${editId}` : '/api/projects';
            const method = editId ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formParams),
            });

            if (res.ok) {
                showToast(`Project ${editId ? 'updated' : 'created'} successfully`, 'success');
                setShowModal(false);
                loadProjects();
            } else {
                const data = await res.json();
                showToast(data.error || 'Failed to save project', 'error');
            }
        } catch {
            showToast('Connection error while saving', 'error');
        } finally {
            setSaving(false);
        }
    }

    /* ─── Derive unique customers for filter ────────── */

    const customerOptions = Array.from(
        new Map(
            projects
                .filter(p => p.customerId && p.customerName)
                .map(p => [p.customerId!, p.customerName!])
        ).entries()
    ).sort((a, b) => a[1].localeCompare(b[1]));

    /* ─── Filter ──────────────────────────────────────── */

    const activeProjects = projects.filter(p => statusFilter === 'active' ? p.status !== 'archived' : p.status === 'archived');
    const filtered = activeProjects.filter(p => {
        if (customerFilter && p.customerId !== customerFilter) return false;
        if (!searchQuery) return true;
        const q = searchQuery.toLowerCase();
        return p.name.toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q) ||
            (p.customerName || '').toLowerCase().includes(q);
    });

    /* ─── Stats ───────────────────────────────────────── */

    const totalActive = projects.filter(p => p.status !== 'archived').length;
    const totalDocs = projects.reduce((sum, p) => sum + p.documentCount, 0);
    const archivedCount = projects.filter(p => p.status === 'archived').length;
    const uniqueCustomers = new Set(projects.filter(p => p.customerId).map(p => p.customerId)).size;

    /* ─── Render ──────────────────────────────────────── */

    if (loading) {
        return (
            <div className="pj-root">
                <div className="pj-loading">
                    <Loader2 size={24} className="pj-spin" />
                    <span>Loading projects...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="pj-root">
            {/* ── Header ── */}
            <header className="pj-header">
                <div className="pj-header-left">
                    <h1 className="pj-title">Projects</h1>
                    <p className="pj-subtitle">Manage your workspaces and project contexts</p>
                </div>
                <button className="pj-create-btn" onClick={openCreate}>
                    <Plus size={16} /> New Project
                </button>
            </header>

            {/* ── Stats ── */}
            <div className="pj-stats">
                <div className="pj-stat-card">
                    <div className="pj-stat-value accent">{totalActive}</div>
                    <div className="pj-stat-label">Active Projects</div>
                </div>
                <div className="pj-stat-card">
                    <div className="pj-stat-value">{totalDocs}</div>
                    <div className="pj-stat-label">Documents</div>
                </div>
                <div className="pj-stat-card">
                    <div className="pj-stat-value">{uniqueCustomers}</div>
                    <div className="pj-stat-label">Customers</div>
                </div>
                <div className="pj-stat-card">
                    <div className="pj-stat-value">{archivedCount}</div>
                    <div className="pj-stat-label">Archived</div>
                </div>
            </div>

            {/* ── Toolbar ── */}
            <div className="pj-toolbar">
                <div className="pj-tab-toggle">
                    <button
                        className={`pj-tab-btn ${statusFilter === 'active' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('active')}
                    >Active</button>
                    <button
                        className={`pj-tab-btn ${statusFilter === 'archived' ? 'active' : ''}`}
                        onClick={() => setStatusFilter('archived')}
                    >Archived</button>
                </div>

                {customerOptions.length > 0 && (
                    <div className="pj-filters">
                        <button
                            className={`pj-filter-chip ${customerFilter === null ? 'active' : ''}`}
                            onClick={() => setCustomerFilter(null)}
                        >All</button>
                        {customerOptions.map(([id, name]) => (
                            <button
                                key={id}
                                className={`pj-filter-chip ${customerFilter === id ? 'active' : ''}`}
                                onClick={() => setCustomerFilter(customerFilter === id ? null : id)}
                            >{name}</button>
                        ))}
                    </div>
                )}

                <div className="pj-search">
                    <Search size={14} />
                    <input
                        type="text"
                        placeholder="Search projects..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* ── Grid ── */}
            {filtered.length === 0 ? (
                <div className="pj-empty">
                    <FolderKanban size={48} strokeWidth={1.2} className="pj-empty-icon" />
                    <h3>{projects.length === 0 ? 'No Projects Yet' : 'No Results'}</h3>
                    <p>
                        {projects.length === 0
                            ? 'Create your first project to give the AI specific context tailored to your work.'
                            : 'Try adjusting your search or filter criteria.'}
                    </p>
                    {projects.length === 0 && (
                        <button className="pj-create-btn" onClick={openCreate} style={{ marginTop: 8 }}>
                            <Plus size={14} /> Create First Project
                        </button>
                    )}
                </div>
            ) : (
                <div className="pj-grid">
                    {filtered.map(project => (
                        <div
                            key={project.id}
                            className="pj-card"
                            onClick={() => router.push(`/projects/${project.id}`)}
                        >
                            {/* Header */}
                            <div className="pj-card-header">
                                <div className="pj-card-icon">
                                    {getInitials(project.name)}
                                </div>
                                <div className="pj-card-info">
                                    <h3 className="pj-card-name">{project.name}</h3>
                                    {project.customerName && (
                                        <div className="pj-card-client">
                                            <Building2 size={11} /> {project.customerName}
                                        </div>
                                    )}
                                </div>
                                {project.documentCount > 0 && (
                                    <span className="pj-card-docs">
                                        <FileText size={13} /> {project.documentCount}
                                    </span>
                                )}
                            </div>

                            {/* Description */}
                            {project.description && (
                                <p className="pj-card-desc">{project.description}</p>
                            )}

                            {/* Footer */}
                            <div className="pj-card-footer">
                                <div className="pj-card-meta">
                                    {project.customerName && (
                                        <span><Building2 size={11} /> {project.customerName}</span>
                                    )}
                                    <span>
                                        <Calendar size={11} /> {new Date(project.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                    </span>
                                </div>
                                <ArrowRight size={14} className="pj-card-arrow" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Create / Edit Modal ── */}
            {showModal && (
                <div className="pj-modal-overlay" onClick={() => setShowModal(false)}>
                    <div className="pj-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="pj-modal-header">
                            <h2>
                                <FolderKanban size={18} />
                                {editId ? 'Edit Project' : 'New Project'}
                            </h2>
                            <button className="pj-modal-close" onClick={() => setShowModal(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="pj-form">
                            {/* Voice Brief */}
                            <div style={{ marginBottom: 4 }}>
                                <VoiceRantBrief
                                    assistantType="COMPANY"
                                    fieldSchema={PROJECT_VOICE_SCHEMA}
                                    onAutoFill={(fields) => {
                                        setFormParams(p => ({
                                            ...p,
                                            name: fields.name || p.name,
                                            description: fields.description || p.description,
                                            contextText: fields.contextText || p.contextText,
                                        }));
                                    }}
                                />
                            </div>

                            <div className="pj-form-group">
                                <label>Project Name *</label>
                                <input
                                    type="text"
                                    value={formParams.name}
                                    onChange={(e) => setFormParams(p => ({ ...p, name: e.target.value }))}
                                    placeholder="e.g. Acme Corp Rebranding"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="pj-form-group">
                                <label>Short Description</label>
                                <input
                                    type="text"
                                    value={formParams.description}
                                    onChange={(e) => setFormParams(p => ({ ...p, description: e.target.value }))}
                                    placeholder="What is this project about?"
                                />
                            </div>
                            <div className="pj-form-group">
                                <label>Project Context for AI</label>
                                <textarea
                                    value={formParams.contextText}
                                    onChange={(e) => setFormParams(p => ({ ...p, contextText: e.target.value }))}
                                    placeholder="Paste specific details, target audience, brand tone, or instructions that the AI should follow..."
                                    rows={5}
                                />
                            </div>

                            <div className="pj-form-actions">
                                <button type="button" className="pj-btn-cancel" onClick={() => setShowModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="pj-btn-save" disabled={saving || !formParams.name.trim()}>
                                    {saving ? (
                                        <><Loader2 size={14} className="pj-spin" /> Saving...</>
                                    ) : (
                                        <><Plus size={14} /> {editId ? 'Save' : 'Create'}</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
