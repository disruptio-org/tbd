'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useUIFeedback } from '@/components/UIFeedback';
import {
    Building2, ArrowLeft, ArrowRight, FolderKanban, Plus, Loader2, Globe,
    Mail, User, Dna, ExternalLink, Link, FileText, Upload, X, Trash2,
} from 'lucide-react';
import '../customers.css';

/* ─── Types ───────────────────────────────────────────── */

interface ProjectItem {
    id: string;
    name: string;
    description: string | null;
    status: string;
    createdAt: string;
    customerId?: string | null;
}

interface DocItem {
    id: string;
    filename: string;
    projectId: string | null;
    createdAt: string;
}

interface CustomerDetail {
    id: string;
    name: string;
    description: string | null;
    industry: string | null;
    website: string | null;
    contactName: string | null;
    contactEmail: string | null;
    contextText: string | null;
    status: string;
    createdAt: string;
    projects: ProjectItem[];
    dnaStats: {
        nodeCount: number;
        nodesByType: Record<string, number>;
    };
}

/* ─── Helper: Initials ────────────────────────────────── */

function getInitials(name: string): string {
    return name.split(/[\s\-_]+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/* ─── Main Component ──────────────────────────────────── */

export default function CustomerDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const { showToast, showConfirm } = useUIFeedback();
    const [customer, setCustomer] = useState<CustomerDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [deleting, setDeleting] = useState(false);
    const [showNewProject, setShowNewProject] = useState(false);
    const [projectName, setProjectName] = useState('');
    const [projectDesc, setProjectDesc] = useState('');
    const [creating, setCreating] = useState(false);

    // Link existing project
    const [showLinkDropdown, setShowLinkDropdown] = useState(false);
    const [unlinkedProjects, setUnlinkedProjects] = useState<ProjectItem[]>([]);
    const [linking, setLinking] = useState(false);

    // Import documents
    const [showImportModal, setShowImportModal] = useState(false);
    const [importTargetProject, setImportTargetProject] = useState<ProjectItem | null>(null);
    const [availableDocs, setAvailableDocs] = useState<DocItem[]>([]);
    const [selectedDocIds, setSelectedDocIds] = useState<Set<string>>(new Set());
    const [importing, setImporting] = useState(false);
    const [loadingDocs, setLoadingDocs] = useState(false);

    /* ─── Load Customer ───────────────────────────────── */

    const loadCustomer = useCallback(async () => {
        try {
            const res = await fetch(`/api/customers/${id}`);
            if (res.ok) setCustomer(await res.json());
        } catch (err) {
            console.error('[customer] Failed to load:', err);
        } finally {
            setLoading(false);
        }
    }, [id]);

    useEffect(() => { loadCustomer(); }, [loadCustomer]);

    /* ─── Load Unlinked Projects ──────────────────────── */

    const loadUnlinkedProjects = useCallback(async () => {
        try {
            const res = await fetch('/api/projects');
            if (res.ok) {
                const data = await res.json();
                const projects: ProjectItem[] = data.projects || data || [];
                setUnlinkedProjects(projects.filter(p => !p.customerId));
            }
        } catch (err) {
            console.error('[customer] Failed to load projects:', err);
        }
    }, []);

    /* ─── Link Project to Customer ────────────────────── */

    const handleLinkProject = async (projectId: string) => {
        setLinking(true);
        try {
            const res = await fetch(`/api/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ customerId: id }),
            });
            if (res.ok) {
                setShowLinkDropdown(false);
                await loadCustomer();
            }
        } catch (err) {
            console.error('[customer] Failed to link project:', err);
        } finally {
            setLinking(false);
        }
    };

    /* ─── Import Documents ────────────────────────────── */

    const openImportModal = async (project: ProjectItem) => {
        setImportTargetProject(project);
        setSelectedDocIds(new Set());
        setShowImportModal(true);
        setLoadingDocs(true);
        try {
            const res = await fetch('/api/documents/upload');
            if (res.ok) {
                const data = await res.json();
                const docs: DocItem[] = (data.documents || data || []);
                setAvailableDocs(docs.filter((d: DocItem) => d.projectId === project.id));
            }
        } catch (err) {
            console.error('[customer] Failed to load docs:', err);
        } finally {
            setLoadingDocs(false);
        }
    };

    const toggleDocSelection = (docId: string) => {
        setSelectedDocIds(prev => {
            const next = new Set(prev);
            if (next.has(docId)) next.delete(docId);
            else next.add(docId);
            return next;
        });
    };

    const handleImportDocs = async () => {
        if (!importTargetProject || selectedDocIds.size === 0) return;
        setImporting(true);
        try {
            const promises = Array.from(selectedDocIds).map(docId =>
                fetch(`/api/documents/${docId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId: importTargetProject.id }),
                })
            );
            await Promise.all(promises);
            setShowImportModal(false);
            setImportTargetProject(null);
            await loadCustomer();
        } catch (err) {
            console.error('[customer] Failed to import docs:', err);
        } finally {
            setImporting(false);
        }
    };

    /* ─── Create Project ──────────────────────────────── */

    const handleCreateProject = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!projectName.trim()) return;
        setCreating(true);

        try {
            const res = await fetch('/api/projects', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: projectName.trim(),
                    description: projectDesc || null,
                    customerId: id,
                }),
            });
            if (res.ok) {
                setShowNewProject(false);
                setProjectName('');
                setProjectDesc('');
                await loadCustomer();
            }
        } catch (err) {
            console.error('[customer] Failed to create project:', err);
        } finally {
            setCreating(false);
        }
    };

    /* ─── Delete Customer ─────────────────────────────── */

    const handleDeleteCustomer = () => {
        if (!customer) return;
        showConfirm(
            `Delete "${customer.name}"? This will archive the customer and hide them from the active list. Their projects will remain accessible.`,
            async () => {
                setDeleting(true);
                try {
                    const res = await fetch(`/api/customers/${id}`, { method: 'DELETE' });
                    if (res.ok) {
                        showToast(`"${customer.name}" has been deleted`, 'success');
                        router.push('/customers');
                    } else {
                        showToast('Failed to delete customer', 'error');
                    }
                } catch {
                    showToast('Error deleting customer', 'error');
                } finally {
                    setDeleting(false);
                }
            }
        );
    };

    /* ─── Render ──────────────────────────────────────── */

    if (loading) {
        return (
            <div className="cu-root">
                <div className="cu-loading">
                    <Loader2 size={24} className="cu-spin" />
                    <span>Loading customer...</span>
                </div>
            </div>
        );
    }

    if (!customer) {
        return (
            <div className="cu-root">
                <div className="cu-empty">
                    <Building2 size={48} strokeWidth={1.2} className="cu-empty-icon" />
                    <h3>Customer Not Found</h3>
                    <button className="cud-back" onClick={() => router.push('/customers')}>
                        <ArrowLeft size={14} /> Back to Customers
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="cu-root">
            {/* ── Header ── */}
            <header className="cud-header">
                <button className="cud-back" onClick={() => router.push('/customers')}>
                    <ArrowLeft size={14} /> Back to Customers
                </button>
                <div className="cud-header-row">
                    <div className="cud-header-left">
                        <div className="cud-header-title-row">
                            <div className="cud-icon">{getInitials(customer.name)}</div>
                            <div>
                                <h1 className="cud-title">{customer.name}</h1>
                                {customer.industry && (
                                    <span className="cud-industry">{customer.industry}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <div className="cud-header-actions">
                        <button
                            className="cud-btn-danger"
                            onClick={handleDeleteCustomer}
                            disabled={deleting}
                            title="Delete this customer"
                        >
                            {deleting ? <Loader2 size={14} className="cu-spin" /> : <Trash2 size={14} />}
                            {deleting ? 'Deleting...' : 'Delete'}
                        </button>
                        <div style={{ position: 'relative' }}>
                            <button
                                className="cud-btn-outline"
                                onClick={() => { setShowLinkDropdown(!showLinkDropdown); if (!showLinkDropdown) loadUnlinkedProjects(); }}
                            >
                                <Link size={14} /> Link Existing
                            </button>
                            {showLinkDropdown && (
                                <div className="cud-dropdown">
                                    {linking ? (
                                        <div className="cud-dropdown-empty">
                                            <Loader2 size={14} className="cu-spin" /> Linking...
                                        </div>
                                    ) : unlinkedProjects.length === 0 ? (
                                        <div className="cud-dropdown-empty">No unlinked projects available</div>
                                    ) : (
                                        unlinkedProjects.map(p => (
                                            <button
                                                key={p.id}
                                                className="cud-dropdown-item"
                                                onClick={() => handleLinkProject(p.id)}
                                            >
                                                <FolderKanban size={12} /> {p.name}
                                            </button>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>
                        <button className="cu-create-btn" onClick={() => setShowNewProject(true)}>
                            <Plus size={14} /> New Project
                        </button>
                    </div>
                </div>
            </header>

            {/* ── Detail Grid ── */}
            <div className="cud-grid">
                {/* Customer Info Card */}
                <div className="cud-card">
                    <div className="cud-card-label">CUSTOMER DETAILS</div>
                    {customer.description && (
                        <p className="cud-card-desc">{customer.description}</p>
                    )}
                    <div className="cud-fields">
                        {customer.contactName && (
                            <div className="cud-field">
                                <User size={14} className="cud-field-icon" />
                                <span>{customer.contactName}</span>
                            </div>
                        )}
                        {customer.contactEmail && (
                            <div className="cud-field">
                                <Mail size={14} className="cud-field-icon" />
                                <a href={`mailto:${customer.contactEmail}`}>{customer.contactEmail}</a>
                            </div>
                        )}
                        {customer.website && (
                            <div className="cud-field">
                                <Globe size={14} className="cud-field-icon" />
                                <a href={customer.website} target="_blank" rel="noopener noreferrer">
                                    {customer.website} <ExternalLink size={10} />
                                </a>
                            </div>
                        )}
                        {!customer.contactName && !customer.contactEmail && !customer.website && (
                            <p className="cud-card-empty-hint">No contact info added yet.</p>
                        )}
                    </div>
                </div>

                {/* DNA Coverage Card */}
                <div className="cud-card cud-card-dna">
                    <div className="cud-card-label">DNA COVERAGE</div>
                    {customer.dnaStats.nodeCount === 0 ? (
                        <div className="cud-dna-empty">
                            <Dna size={24} strokeWidth={1.2} />
                            <p>No knowledge nodes yet. Process project documents to build customer DNA.</p>
                        </div>
                    ) : (
                        <div className="cud-dna-stats">
                            <div className="cud-dna-total">
                                <span className="cud-dna-num">{customer.dnaStats.nodeCount}</span>
                                <span className="cud-dna-label">Knowledge Nodes</span>
                            </div>
                            {Object.entries(customer.dnaStats.nodesByType).map(([type, count]) => (
                                <div key={type} className="cud-dna-row">
                                    <span className="cud-dna-type">{type}</span>
                                    <span className="cud-dna-count">{count}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* ── Projects Section ── */}
            <section className="cud-projects">
                <div className="cud-projects-header">
                    <h3><FolderKanban size={16} /> Projects ({customer.projects.length})</h3>
                </div>

                {customer.projects.length === 0 ? (
                    <div className="cu-empty" style={{ padding: '48px 24px' }}>
                        <FolderKanban size={36} strokeWidth={1.2} className="cu-empty-icon" />
                        <h3>No Projects Yet</h3>
                        <p>Create a new project or link an existing one to this customer.</p>
                        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                            <button className="cud-btn-outline" onClick={() => { setShowLinkDropdown(true); loadUnlinkedProjects(); }}>
                                <Link size={14} /> Link Existing
                            </button>
                            <button className="cu-create-btn" onClick={() => setShowNewProject(true)}>
                                <Plus size={14} /> Create New
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="cud-projects-grid">
                        {customer.projects.map(project => (
                            <div key={project.id} className="cud-project-card">
                                <div className="cud-project-top">
                                    <FolderKanban size={14} className="cud-project-icon" />
                                    <span className={`cud-status cud-status-${project.status}`}>
                                        {project.status}
                                    </span>
                                </div>
                                <h4 className="cud-project-name">{project.name}</h4>
                                {project.description && (
                                    <p className="cud-project-desc">{project.description}</p>
                                )}
                                <div className="cud-project-footer">
                                    <button
                                        className="cud-project-action"
                                        onClick={(e) => { e.stopPropagation(); openImportModal(project); }}
                                    >
                                        <Upload size={11} /> Import Docs
                                    </button>
                                    <button
                                        className="cud-project-open"
                                        onClick={() => router.push(`/projects/${project.id}`)}
                                    >
                                        Open <ArrowRight size={12} />
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* ── New Project Modal ── */}
            {showNewProject && (
                <div className="cu-modal-overlay" onClick={() => setShowNewProject(false)}>
                    <div className="cu-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="cu-modal-header">
                            <h2><FolderKanban size={18} /> New Project for {customer.name}</h2>
                            <button className="cu-modal-close" onClick={() => setShowNewProject(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateProject} className="cu-form">
                            <div className="cu-form-group">
                                <label>Project Name *</label>
                                <input
                                    type="text"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    placeholder="e.g., Invoice Processing, CRM Integration"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="cu-form-group">
                                <label>Description</label>
                                <textarea
                                    value={projectDesc}
                                    onChange={(e) => setProjectDesc(e.target.value)}
                                    placeholder="Brief project description..."
                                    rows={3}
                                />
                            </div>
                            <div className="cu-form-actions">
                                <button type="button" className="cu-btn-cancel" onClick={() => setShowNewProject(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="cu-btn-save" disabled={creating || !projectName.trim()}>
                                    {creating ? (
                                        <><Loader2 size={14} className="cu-spin" /> Creating...</>
                                    ) : (
                                        <><Plus size={14} /> Create Project</>
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Import Documents Modal ── */}
            {showImportModal && importTargetProject && (
                <div className="cu-modal-overlay" onClick={() => setShowImportModal(false)}>
                    <div className="cu-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="cu-modal-header">
                            <h2><Upload size={18} /> Import Documents → {importTargetProject.name}</h2>
                            <button className="cu-modal-close" onClick={() => setShowImportModal(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className="cud-import-body">
                            {loadingDocs ? (
                                <div className="cu-loading" style={{ padding: 40 }}>
                                    <Loader2 size={24} className="cu-spin" />
                                    <span>Loading documents...</span>
                                </div>
                            ) : availableDocs.length === 0 ? (
                                <div className="cu-empty" style={{ padding: '30px 20px', border: 'none' }}>
                                    <FileText size={32} strokeWidth={1.2} />
                                    <h3>No Unassigned Documents</h3>
                                    <p>All company documents are already assigned to projects.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="cud-import-info">
                                        <span>{selectedDocIds.size} selected</span>
                                        <button
                                            className="cud-project-action"
                                            onClick={() => {
                                                if (selectedDocIds.size === availableDocs.length) setSelectedDocIds(new Set());
                                                else setSelectedDocIds(new Set(availableDocs.map(d => d.id)));
                                            }}
                                        >
                                            {selectedDocIds.size === availableDocs.length ? 'Deselect All' : 'Select All'}
                                        </button>
                                    </div>
                                    <div className="cud-import-list">
                                        {availableDocs.map(doc => (
                                            <label key={doc.id} className="cud-import-item">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedDocIds.has(doc.id)}
                                                    onChange={() => toggleDocSelection(doc.id)}
                                                />
                                                <FileText size={14} />
                                                <span className="cud-import-name">{doc.filename}</span>
                                            </label>
                                        ))}
                                    </div>
                                </>
                            )}
                        </div>
                        {availableDocs.length > 0 && (
                            <div className="cu-form-actions" style={{ padding: '12px 24px' }}>
                                <button className="cu-btn-cancel" onClick={() => setShowImportModal(false)}>
                                    Cancel
                                </button>
                                <button
                                    className="cu-btn-save"
                                    onClick={handleImportDocs}
                                    disabled={importing || selectedDocIds.size === 0}
                                >
                                    {importing ? (
                                        <><Loader2 size={14} className="cu-spin" /> Importing...</>
                                    ) : (
                                        <><Upload size={14} /> Import {selectedDocIds.size} Document{selectedDocIds.size !== 1 ? 's' : ''}</>
                                    )}
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
