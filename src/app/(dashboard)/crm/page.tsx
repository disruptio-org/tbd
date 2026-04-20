'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Users, Settings, Plus, UserSearch } from 'lucide-react';
import '../settings/users/users.css';
import './crm.css';

// ─── Types ────────────────────────────────
interface PipelineStage {
    id: string;
    name: string;
    color: string | null;
    position: number;
    isDefault: boolean;
}

interface CrmLead {
    id: string;
    companyId: string;
    ownerUserId: string | null;
    createdByUserId: string;
    pipelineStageId: string;
    sourceType: string;
    sourceReference: string | null;
    leadName: string;
    companyName: string | null;
    website: string | null;
    industry: string | null;
    location: string | null;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
    lifecycleStatus: string;
    lostReason: string | null;
    notes: string | null;
    tags: string[] | null;
    lastActivityAt: string | null;
    createdAt: string;
    updatedAt: string;
    pipelineStage?: PipelineStage;
    owner?: { id: string; name: string; email: string; avatarUrl: string | null };
    createdBy?: { id: string; name: string; email: string };
}

interface LeadActivity {
    id: string;
    crmLeadId: string;
    actorId: string;
    action: string;
    content: string | null;
    metadata: Record<string, unknown> | null;
    createdAt: string;
    actor?: { id: string; name: string; avatarUrl: string | null };
}

interface LeadContact {
    id: string;
    crmLeadId: string;
    name: string;
    email: string | null;
    phone: string | null;
    jobTitle: string | null;
    isPrimary: boolean;
}

// ─── Main CRM Page ───────────────────────
export default function CrmPage() {
    // State
    const [leads, setLeads] = useState<CrmLead[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [pageSize] = useState(25);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [stages, setStages] = useState<PipelineStage[]>([]);
    const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

    // Filters
    const [search, setSearch] = useState('');
    const [stageFilter, setStageFilter] = useState('');
    const [ownerFilter, setOwnerFilter] = useState('');
    const [sourceFilter, setSourceFilter] = useState('');
    const [lifecycleFilter, setLifecycleFilter] = useState('ACTIVE');
    const [sortBy, setSortBy] = useState('createdAt');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

    // Detail/Modal state
    const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPipelineSettings, setShowPipelineSettings] = useState(false);

    const searchTimeout = useRef<NodeJS.Timeout | null>(null);

    // ─── Init: Ensure pipeline stages exist ──
    const ensurePipelineStages = useCallback(async () => {
        const res = await fetch('/api/crm/pipeline');
        const data = await res.json();
        if (!data.stages || data.stages.length === 0) {
            // Seed defaults
            await fetch('/api/crm/pipeline', { method: 'POST' });
            const res2 = await fetch('/api/crm/pipeline');
            const data2 = await res2.json();
            setStages(data2.stages || []);
        } else {
            setStages(data.stages);
        }
    }, []);

    // ─── Fetch leads ──────────────────────────
    const fetchLeads = useCallback(async () => {
        setLoading(true);
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (stageFilter) params.set('stageId', stageFilter);
        if (ownerFilter) params.set('ownerUserId', ownerFilter);
        if (sourceFilter) params.set('sourceType', sourceFilter);
        if (lifecycleFilter) params.set('lifecycleStatus', lifecycleFilter);
        params.set('sortBy', sortBy);
        params.set('sortOrder', sortOrder);
        params.set('page', String(page));
        params.set('pageSize', String(pageSize));

        try {
            const res = await fetch(`/api/crm/leads?${params.toString()}`);
            const data = await res.json();
            setLeads(data.leads || []);
            setTotal(data.total || 0);
            setTotalPages(data.totalPages || 1);
        } catch (err) {
            console.error('Failed to fetch leads:', err);
        } finally {
            setLoading(false);
        }
    }, [search, stageFilter, ownerFilter, sourceFilter, lifecycleFilter, sortBy, sortOrder, page, pageSize]);

    // ─── Fetch users (for filter dropdown + owner assignment) ──
    const fetchUsers = useCallback(async () => {
        try {
            const res = await fetch('/api/company');
            const data = await res.json();
            if (data.users) setUsers(data.users.map((u: { id: string; name: string }) => ({ id: u.id, name: u.name })));
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        ensurePipelineStages();
        fetchUsers();
    }, [ensurePipelineStages, fetchUsers]);

    useEffect(() => {
        fetchLeads();
    }, [fetchLeads]);

    // Debounced search
    const handleSearchChange = (val: string) => {
        if (searchTimeout.current) clearTimeout(searchTimeout.current);
        searchTimeout.current = setTimeout(() => {
            setSearch(val);
            setPage(1);
        }, 350);
    };

    // Sort toggle
    const handleSort = (field: string) => {
        if (sortBy === field) {
            setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(field);
            setSortOrder('desc');
        }
        setPage(1);
    };

    // ─── Inline stage change ──────────────────
    const handleStageChange = async (leadId: string, newStageId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        try {
            await fetch(`/api/crm/leads/${leadId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pipelineStageId: newStageId }),
            });
            fetchLeads();
        } catch (err) {
            console.error('Failed to update stage:', err);
        }
    };

    // ─── Format date ──────────────────────────
    const formatDate = (date: string | null) => {
        if (!date) return '—';
        return new Date(date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    };

    const getInitials = (name: string) => name?.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase() || '?';

    return (
        <div className="crm-page">
            {/* ── Standard Page Header ────────────── */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><Users size={20} strokeWidth={2} /></span>
                    <h1>CRM</h1>
                </div>
                <div className="assistant-page-workspace">
                    <button
                        className="btn btn-secondary"
                        onClick={() => setShowPipelineSettings(true)}
                    >
                        <Settings size={14} strokeWidth={2} />
                        Pipeline
                    </button>
                    <button
                        className="btn btn-primary"
                        onClick={() => setShowAddModal(true)}
                    >
                        + Add Lead
                    </button>
                </div>
            </div>

            {/* ── Filter Bar ───────────────────────── */}
            <div className="crm-filter-bar">
                <input
                    type="text"
                    placeholder="Search leads..."
                    className="crm-search-input"
                    onChange={e => handleSearchChange(e.target.value)}
                />
                <select className="crm-filter-select" value={stageFilter} onChange={e => { setStageFilter(e.target.value); setPage(1); }}>
                    <option value="">All Stages</option>
                    {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
                <select className="crm-filter-select" value={ownerFilter} onChange={e => { setOwnerFilter(e.target.value); setPage(1); }}>
                    <option value="">All Owners</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
                <select className="crm-filter-select" value={sourceFilter} onChange={e => { setSourceFilter(e.target.value); setPage(1); }}>
                    <option value="">All Sources</option>
                    <option value="MANUAL">Manual</option>
                    <option value="LEAD_DISCOVERY">Lead Discovery</option>
                    <option value="API">API</option>
                    <option value="IMPORT">Import</option>
                </select>
                <select className="crm-filter-select" value={lifecycleFilter} onChange={e => { setLifecycleFilter(e.target.value); setPage(1); }}>
                    <option value="ACTIVE">Active</option>
                    <option value="CONVERTED">Converted</option>
                    <option value="LOST">Lost</option>
                    <option value="ARCHIVED">Archived</option>
                    <option value="ALL">All</option>
                </select>
                <span className="crm-filter-count">{total} lead{total !== 1 ? 's' : ''}</span>
            </div>

            {/* ── Table ─────────────────────────────── */}
            {loading && leads.length === 0 ? (
                <div className="crm-empty">
                    <div className="spinner" />
                </div>
            ) : leads.length === 0 ? (
                <div className="crm-empty">
                    <div className="crm-empty-icon">
                        <UserSearch size={48} strokeWidth={1} style={{ opacity: 0.3 }} />
                    </div>
                    <h3>No leads yet</h3>
                    <p>Get started by adding your first lead or importing from Lead Discovery.</p>
                    <button className="btn btn-primary" onClick={() => setShowAddModal(true)}>
                        + Add Your First Lead
                    </button>
                </div>
            ) : (
                <>
                    <p className="docs-count-label">{total} lead{total !== 1 ? 's' : ''}</p>
                    <div className="docs-table-card">
                        <table className="docs-table crm-table">
                            <thead>
                                <tr>
                                    <th className={sortBy === 'leadName' ? 'active' : ''} onClick={() => handleSort('leadName')}>
                                        Lead {sortBy === 'leadName' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                                    </th>
                                    <th>Contact</th>
                                    <th className={sortBy === 'pipelineStageId' ? 'active' : ''} onClick={() => handleSort('pipelineStageId')}>
                                        Stage {sortBy === 'pipelineStageId' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                                    </th>
                                    <th>Owner</th>
                                    <th>Source</th>
                                    <th className={sortBy === 'lastActivityAt' ? 'active' : ''} onClick={() => handleSort('lastActivityAt')}>
                                        Last Activity {sortBy === 'lastActivityAt' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                                    </th>
                                    <th className={sortBy === 'createdAt' ? 'active' : ''} onClick={() => handleSort('createdAt')}>
                                        Created {sortBy === 'createdAt' && <span className="sort-arrow">{sortOrder === 'asc' ? '▲' : '▼'}</span>}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {leads.map(lead => (
                                    <tr key={lead.id} onClick={() => setSelectedLeadId(lead.id)}>
                                        <td>
                                            <div className="crm-lead-name">{lead.leadName}</div>
                                            {lead.companyName && <div className="crm-company-name">{lead.companyName}</div>}
                                        </td>
                                        <td>
                                            {lead.email && <div>{lead.email}</div>}
                                            {lead.phone && <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>{lead.phone}</div>}
                                            {!lead.email && !lead.phone && <span style={{ color: 'var(--color-text-tertiary)' }}>—</span>}
                                        </td>
                                        <td>
                                            <select
                                                className="crm-inline-stage-select"
                                                value={lead.pipelineStageId}
                                                onClick={e => e.stopPropagation()}
                                                onChange={e => handleStageChange(lead.id, e.target.value, e as unknown as React.MouseEvent)}
                                                style={{ borderLeft: `3px solid ${lead.pipelineStage?.color || '#666'}` }}
                                            >
                                                {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                            </select>
                                        </td>
                                        <td>
                                            {lead.owner ? (
                                                <div className="crm-owner-cell">
                                                    <div className="crm-owner-avatar">
                                                        {lead.owner.avatarUrl ? (
                                                            <img src={lead.owner.avatarUrl} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                                                        ) : getInitials(lead.owner.name)}
                                                    </div>
                                                    <span>{lead.owner.name?.split(' ')[0]}</span>
                                                </div>
                                            ) : <span style={{ color: 'var(--color-text-tertiary)' }}>Unassigned</span>}
                                        </td>
                                        <td>
                                            <span className="crm-source-badge">{lead.sourceType.replace('_', ' ')}</span>
                                        </td>
                                        <td className="crm-date-cell">{formatDate(lead.lastActivityAt)}</td>
                                        <td className="crm-date-cell">{formatDate(lead.createdAt)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination */}
                    <div className="crm-pagination">
                        <span className="crm-pagination-info">
                            Showing {((page - 1) * pageSize) + 1}–{Math.min(page * pageSize, total)} of {total}
                        </span>
                        <div className="crm-pagination-controls">
                            <button className="crm-pagination-btn" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                                ← PREV
                            </button>
                            <span className="crm-pagination-current">Page {page} of {totalPages}</span>
                            <button className="crm-pagination-btn" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>
                                NEXT →
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ── Detail Panel (Slide-Over) ─────────── */}
            {selectedLeadId && (
                <LeadDetailPanel
                    leadId={selectedLeadId}
                    stages={stages}
                    users={users}
                    onClose={() => {
                        setSelectedLeadId(null);
                        fetchLeads();
                    }}
                />
            )}

            {/* ── Add Lead Modal ─────────────────────── */}
            {showAddModal && (
                <AddLeadModal
                    stages={stages}
                    users={users}
                    onClose={() => setShowAddModal(false)}
                    onCreated={() => {
                        setShowAddModal(false);
                        fetchLeads();
                    }}
                />
            )}

            {/* ── Pipeline Settings Modal ────────────── */}
            {showPipelineSettings && (
                <PipelineSettingsModal
                    stages={stages}
                    onClose={() => setShowPipelineSettings(false)}
                    onSaved={(updated) => {
                        setStages(updated);
                        setShowPipelineSettings(false);
                    }}
                />
            )}
        </div>
    );
}

// ═══════════════════════════════════════════
// Lead Detail Panel (Slide-Over)
// ═══════════════════════════════════════════
function LeadDetailPanel({ leadId, stages, users, onClose }: {
    leadId: string;
    stages: PipelineStage[];
    users: { id: string; name: string }[];
    onClose: () => void;
}) {
    const [lead, setLead] = useState<CrmLead | null>(null);
    const [activities, setActivities] = useState<LeadActivity[]>([]);
    const [contacts, setContacts] = useState<LeadContact[]>([]);
    const [loading, setLoading] = useState(true);
    const [noteText, setNoteText] = useState('');
    const [editing, setEditing] = useState(false);
    const [editForm, setEditForm] = useState<Partial<CrmLead>>({});

    const fetchDetail = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/crm/leads/${leadId}`);
            const data = await res.json();
            setLead(data.lead);
            setActivities(data.activities || []);
            setContacts(data.contacts || []);
            if (data.lead) {
                setEditForm({
                    leadName: data.lead.leadName,
                    companyName: data.lead.companyName,
                    email: data.lead.email,
                    phone: data.lead.phone,
                    jobTitle: data.lead.jobTitle,
                    website: data.lead.website,
                    industry: data.lead.industry,
                    location: data.lead.location,
                    notes: data.lead.notes,
                    pipelineStageId: data.lead.pipelineStageId,
                    ownerUserId: data.lead.ownerUserId,
                });
            }
        } catch (err) {
            console.error('Failed to fetch lead detail:', err);
        } finally {
            setLoading(false);
        }
    }, [leadId]);

    useEffect(() => { fetchDetail(); }, [fetchDetail]);

    const handleSave = async () => {
        try {
            await fetch(`/api/crm/leads/${leadId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(editForm),
            });
            setEditing(false);
            fetchDetail();
        } catch (err) {
            console.error('Failed to save:', err);
        }
    };

    const handleAddNote = async () => {
        if (!noteText.trim()) return;
        try {
            await fetch(`/api/crm/leads/${leadId}/activities`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ content: noteText }),
            });
            setNoteText('');
            fetchDetail();
        } catch (err) {
            console.error('Failed to add note:', err);
        }
    };

    const handleLifecycleChange = async (status: string) => {
        const body: Record<string, string> = { lifecycleStatus: status };
        if (status === 'LOST') {
            const reason = prompt('Reason for losing this lead (optional):');
            if (reason) body.lostReason = reason;
        }
        try {
            await fetch(`/api/crm/leads/${leadId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            fetchDetail();
        } catch (err) {
            console.error('Failed to update lifecycle:', err);
        }
    };

    const getActivityDotClass = (action: string) => {
        if (action === 'note_added') return 'note';
        if (action === 'stage_changed') return 'stage';
        if (action === 'owner_changed') return 'owner';
        if (action === 'imported' || action === 'created') return 'created';
        if (action === 'converted') return 'converted';
        if (action === 'lost') return 'lost';
        return '';
    };

    const formatDateTime = (d: string) => new Date(d).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

    if (loading) return (
        <div className="crm-detail-backdrop" onClick={onClose}>
            <div className="crm-detail-panel" onClick={e => e.stopPropagation()}>
                <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-tertiary)' }}>Loading...</div>
            </div>
        </div>
    );

    if (!lead) return null;

    return (
        <div className="crm-detail-backdrop" onClick={onClose}>
            <div className="crm-detail-panel" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="crm-detail-header">
                    <div>
                        <h2 className="crm-detail-title">{lead.leadName}</h2>
                        {lead.companyName && <div className="crm-detail-subtitle">{lead.companyName}</div>}
                        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
                            <span className="crm-stage-badge">
                                <span className="crm-stage-dot" style={{ background: lead.pipelineStage?.color || '#666' }} />
                                {lead.pipelineStage?.name}
                            </span>
                            <span className="crm-source-badge">{lead.sourceType.replace('_', ' ')}</span>
                        </div>
                    </div>
                    <button className="crm-detail-close" onClick={onClose}>✕</button>
                </div>

                {/* Body */}
                <div className="crm-detail-body">
                    {/* ── Core Info ──────────────────── */}
                    <div className="crm-detail-section">
                        <h4 className="crm-detail-section-title">
                            Lead Information
                            <button
                                onClick={() => setEditing(!editing)}
                                style={{ float: 'right', fontSize: 10, border: '1px solid var(--color-border)', padding: '2px 8px', cursor: 'pointer', background: 'transparent', color: 'var(--color-text-secondary)', fontWeight: 700, textTransform: 'uppercase' }}
                            >
                                {editing ? 'CANCEL' : 'EDIT'}
                            </button>
                        </h4>
                        {editing ? (
                            <div className="crm-detail-grid">
                                <div className="crm-detail-field">
                                    <label>Lead Name</label>
                                    <input value={editForm.leadName || ''} onChange={e => setEditForm(p => ({ ...p, leadName: e.target.value }))} />
                                </div>
                                <div className="crm-detail-field">
                                    <label>Company</label>
                                    <input value={editForm.companyName || ''} onChange={e => setEditForm(p => ({ ...p, companyName: e.target.value }))} />
                                </div>
                                <div className="crm-detail-field">
                                    <label>Email</label>
                                    <input value={editForm.email || ''} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
                                </div>
                                <div className="crm-detail-field">
                                    <label>Phone</label>
                                    <input value={editForm.phone || ''} onChange={e => setEditForm(p => ({ ...p, phone: e.target.value }))} />
                                </div>
                                <div className="crm-detail-field">
                                    <label>Job Title</label>
                                    <input value={editForm.jobTitle || ''} onChange={e => setEditForm(p => ({ ...p, jobTitle: e.target.value }))} />
                                </div>
                                <div className="crm-detail-field">
                                    <label>Website</label>
                                    <input value={editForm.website || ''} onChange={e => setEditForm(p => ({ ...p, website: e.target.value }))} />
                                </div>
                                <div className="crm-detail-field">
                                    <label>Industry</label>
                                    <input value={editForm.industry || ''} onChange={e => setEditForm(p => ({ ...p, industry: e.target.value }))} />
                                </div>
                                <div className="crm-detail-field">
                                    <label>Location</label>
                                    <input value={editForm.location || ''} onChange={e => setEditForm(p => ({ ...p, location: e.target.value }))} />
                                </div>
                                <div className="crm-detail-field">
                                    <label>Stage</label>
                                    <select value={editForm.pipelineStageId || ''} onChange={e => setEditForm(p => ({ ...p, pipelineStageId: e.target.value }))}>
                                        {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                    </select>
                                </div>
                                <div className="crm-detail-field">
                                    <label>Owner</label>
                                    <select value={editForm.ownerUserId || ''} onChange={e => setEditForm(p => ({ ...p, ownerUserId: e.target.value || null }))}>
                                        <option value="">Unassigned</option>
                                        {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                                    </select>
                                </div>
                                <div className="crm-detail-field full-width">
                                    <label>Notes</label>
                                    <textarea rows={3} value={editForm.notes || ''} onChange={e => setEditForm(p => ({ ...p, notes: e.target.value }))} />
                                </div>
                                <div className="crm-detail-field full-width" style={{ display: 'flex', flexDirection: 'row', gap: 8, justifyContent: 'flex-end' }}>
                                    <button className="btn btn-primary" onClick={handleSave} style={{ padding: '6px 20px', fontSize: 11, fontWeight: 800 }}>SAVE</button>
                                </div>
                            </div>
                        ) : (
                            <div className="crm-detail-grid">
                                <div className="crm-detail-field">
                                    <label>Email</label>
                                    <span className="crm-detail-field-value">{lead.email || '—'}</span>
                                </div>
                                <div className="crm-detail-field">
                                    <label>Phone</label>
                                    <span className="crm-detail-field-value">{lead.phone || '—'}</span>
                                </div>
                                <div className="crm-detail-field">
                                    <label>Job Title</label>
                                    <span className="crm-detail-field-value">{lead.jobTitle || '—'}</span>
                                </div>
                                <div className="crm-detail-field">
                                    <label>Website</label>
                                    <span className="crm-detail-field-value">
                                        {lead.website ? <a href={lead.website.startsWith('http') ? lead.website : `https://${lead.website}`} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent)' }}>{lead.website}</a> : '—'}
                                    </span>
                                </div>
                                <div className="crm-detail-field">
                                    <label>Industry</label>
                                    <span className="crm-detail-field-value">{lead.industry || '—'}</span>
                                </div>
                                <div className="crm-detail-field">
                                    <label>Location</label>
                                    <span className="crm-detail-field-value">{lead.location || '—'}</span>
                                </div>
                                <div className="crm-detail-field">
                                    <label>Owner</label>
                                    <span className="crm-detail-field-value">{lead.owner?.name || 'Unassigned'}</span>
                                </div>
                                <div className="crm-detail-field">
                                    <label>Created</label>
                                    <span className="crm-detail-field-value">{formatDateTime(lead.createdAt)}</span>
                                </div>
                                {lead.notes && (
                                    <div className="crm-detail-field full-width">
                                        <label>Notes</label>
                                        <span className="crm-detail-field-value" style={{ whiteSpace: 'pre-wrap' }}>{lead.notes}</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* ── Contacts ───────────────────── */}
                    {contacts.length > 0 && (
                        <div className="crm-detail-section">
                            <h4 className="crm-detail-section-title">Contacts</h4>
                            {contacts.map(c => (
                                <div key={c.id} style={{ padding: '6px 0', borderBottom: '1px solid var(--color-border-light)', fontSize: 13 }}>
                                    <strong>{c.name}</strong>
                                    {c.isPrimary && <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--color-accent)' }}>PRIMARY</span>}
                                    {c.jobTitle && <span style={{ color: 'var(--color-text-secondary)', marginLeft: 6 }}>· {c.jobTitle}</span>}
                                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)' }}>
                                        {c.email && <span>{c.email}</span>} {c.phone && <span>· {c.phone}</span>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* ── Actions ────────────────────── */}
                    <div className="crm-detail-section">
                        <h4 className="crm-detail-section-title">Actions</h4>
                        <div className="crm-detail-actions">
                            <button
                                className="btn btn-primary"
                                style={{ padding: '6px 16px', fontSize: 11 }}
                                onClick={() => {
                                    const params = new URLSearchParams();
                                    if (lead.companyName) params.set('prospectCompanyName', lead.companyName);
                                    if (lead.website) params.set('prospectWebsite', lead.website);
                                    if (lead.jobTitle) params.set('buyerRole', lead.jobTitle);
                                    window.location.href = `/sales?${params.toString()}`;
                                }}
                            >
                                📧 GENERATE OUTREACH
                            </button>
                            {lead.lifecycleStatus === 'ACTIVE' && (
                                <>
                                    <button className="btn btn-secondary" style={{ padding: '6px 16px', fontSize: 11 }} onClick={() => handleLifecycleChange('CONVERTED')}>
                                        ✓ MARK CUSTOMER
                                    </button>
                                    <button className="btn btn-secondary" style={{ padding: '6px 16px', fontSize: 11, color: '#EF4444' }} onClick={() => handleLifecycleChange('LOST')}>
                                        ✕ MARK LOST
                                    </button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* ── Activity Timeline ──────────── */}
                    <div className="crm-detail-section">
                        <h4 className="crm-detail-section-title">Activity ({activities.length})</h4>
                        <div className="crm-note-form">
                            <textarea
                                className="crm-note-input"
                                placeholder="Add a note..."
                                value={noteText}
                                onChange={e => setNoteText(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddNote(); } }}
                            />
                            <button className="btn btn-primary" onClick={handleAddNote} style={{ padding: '6px 14px', fontSize: 11 }}>ADD</button>
                        </div>
                        <div className="crm-activity-list" style={{ marginTop: 16 }}>
                            {activities.map(a => (
                                <div key={a.id} className="crm-activity-item">
                                    <div className={`crm-activity-dot ${getActivityDotClass(a.action)}`} />
                                    <div className="crm-activity-content">
                                        <div className="crm-activity-text">{a.content}</div>
                                        <div className="crm-activity-meta">
                                            {a.actor?.name} · {formatDateTime(a.createdAt)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {activities.length === 0 && (
                                <div style={{ color: 'var(--color-text-tertiary)', fontSize: 13 }}>No activity yet</div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// Add Lead Modal
// ═══════════════════════════════════════════
function AddLeadModal({ stages, users, onClose, onCreated }: {
    stages: PipelineStage[];
    users: { id: string; name: string }[];
    onClose: () => void;
    onCreated: () => void;
}) {
    const [form, setForm] = useState({
        leadName: '', companyName: '', email: '', phone: '', jobTitle: '',
        website: '', industry: '', location: '', pipelineStageId: '', ownerUserId: '', notes: '',
    });
    const [saving, setSaving] = useState(false);

    const handleSubmit = async () => {
        if (!form.leadName.trim()) return alert('Lead name is required');
        setSaving(true);
        try {
            const res = await fetch('/api/crm/leads', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                onCreated();
            } else {
                const data = await res.json();
                alert(data.error || 'Failed to create lead');
            }
        } catch {
            alert('Failed to create lead');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="users-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 620 }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Users size={18} strokeWidth={2} /> Add New Lead</h3>
                <div className="users-form-group">
                    <label>Lead Name *</label>
                    <input value={form.leadName} onChange={e => setForm(p => ({ ...p, leadName: e.target.value }))} autoFocus />
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div className="users-form-group">
                        <label>Company</label>
                        <input value={form.companyName} onChange={e => setForm(p => ({ ...p, companyName: e.target.value }))} />
                    </div>
                    <div className="users-form-group">
                        <label>Website</label>
                        <input value={form.website} onChange={e => setForm(p => ({ ...p, website: e.target.value }))} placeholder="https://" />
                    </div>
                    <div className="users-form-group">
                        <label>Email</label>
                        <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} type="email" />
                    </div>
                    <div className="users-form-group">
                        <label>Phone</label>
                        <input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                    </div>
                    <div className="users-form-group">
                        <label>Job Title</label>
                        <input value={form.jobTitle} onChange={e => setForm(p => ({ ...p, jobTitle: e.target.value }))} />
                    </div>
                    <div className="users-form-group">
                        <label>Industry</label>
                        <input value={form.industry} onChange={e => setForm(p => ({ ...p, industry: e.target.value }))} />
                    </div>
                    <div className="users-form-group">
                        <label>Location</label>
                        <input value={form.location} onChange={e => setForm(p => ({ ...p, location: e.target.value }))} />
                    </div>
                    <div className="users-form-group">
                        <label>Pipeline Stage</label>
                        <select value={form.pipelineStageId} onChange={e => setForm(p => ({ ...p, pipelineStageId: e.target.value }))}>
                            <option value="">Default (New Lead)</option>
                            {stages.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                    </div>
                    <div className="users-form-group">
                        <label>Owner</label>
                        <select value={form.ownerUserId} onChange={e => setForm(p => ({ ...p, ownerUserId: e.target.value }))}>
                            <option value="">Assign to me</option>
                            {users.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                        </select>
                    </div>
                </div>
                <div className="users-form-group">
                    <label>Notes</label>
                    <textarea rows={3} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ width: '100%', padding: '10px 14px', border: '2px solid var(--color-stroke-subtle)', borderRadius: 0, background: 'var(--color-bg-base)', color: 'var(--color-text-primary)', fontSize: 14, resize: 'vertical', minHeight: 80, fontFamily: 'inherit' }} />
                </div>
                <div className="users-modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSubmit} disabled={saving}>
                        {saving ? 'Saving…' : 'Create Lead'}
                    </button>
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════
// Pipeline Settings Modal
// ═══════════════════════════════════════════
function PipelineSettingsModal({ stages, onClose, onSaved }: {
    stages: PipelineStage[];
    onClose: () => void;
    onSaved: (stages: PipelineStage[]) => void;
}) {
    const [localStages, setLocalStages] = useState(stages.map(s => ({ ...s })));
    const [saving, setSaving] = useState(false);
    const [newStageName, setNewStageName] = useState('');

    const addStage = () => {
        if (!newStageName.trim()) return;
        setLocalStages(prev => [...prev, {
            id: '',
            name: newStageName.trim(),
            position: prev.length,
            color: '#6B7280',
            isDefault: false,
        } as PipelineStage]);
        setNewStageName('');
    };

    const moveStage = (index: number, direction: -1 | 1) => {
        const newIdx = index + direction;
        if (newIdx < 0 || newIdx >= localStages.length) return;
        const updated = [...localStages];
        [updated[index], updated[newIdx]] = [updated[newIdx], updated[index]];
        setLocalStages(updated.map((s, i) => ({ ...s, position: i })));
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/crm/pipeline', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stages: localStages.map((s, i) => ({ ...s, position: i })) }),
            });
            const data = await res.json();
            if (res.ok) onSaved(data.stages);
        } catch {
            alert('Failed to save pipeline');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="users-modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 480 }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Settings size={18} strokeWidth={2} /> Pipeline Stages</h3>
                <div className="crm-pipeline-list">
                    {localStages.map((s, i) => (
                        <div key={s.id || `new-${i}`} className="crm-pipeline-item">
                            <span className="crm-stage-dot" style={{ background: s.color || '#666', width: 12, height: 12 }} />
                            <input
                                value={s.name}
                                onChange={e => {
                                    const updated = [...localStages];
                                    updated[i] = { ...updated[i], name: e.target.value };
                                    setLocalStages(updated);
                                }}
                                style={{ flex: 1, padding: '10px 14px', border: '2px solid var(--color-stroke-subtle)', borderRadius: 0, background: 'var(--color-bg-base)', fontSize: 14, fontWeight: 600, color: 'var(--color-text-primary)' }}
                            />
                            <input
                                type="color"
                                value={s.color || '#6B7280'}
                                onChange={e => {
                                    const updated = [...localStages];
                                    updated[i] = { ...updated[i], color: e.target.value };
                                    setLocalStages(updated);
                                }}
                                style={{ width: 24, height: 24, border: 'none', cursor: 'pointer' }}
                            />
                            <span className="crm-pipeline-item-pos">#{i + 1}</span>
                            <button onClick={() => moveStage(i, -1)} disabled={i === 0} style={{ padding: '0 4px', cursor: 'pointer', border: 'none', background: 'transparent', fontSize: 14, opacity: i === 0 ? 0.3 : 1 }}>↑</button>
                            <button onClick={() => moveStage(i, 1)} disabled={i === localStages.length - 1} style={{ padding: '0 4px', cursor: 'pointer', border: 'none', background: 'transparent', fontSize: 14, opacity: i === localStages.length - 1 ? 0.3 : 1 }}>↓</button>
                        </div>
                    ))}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <input
                        value={newStageName}
                        onChange={e => setNewStageName(e.target.value)}
                        placeholder="New stage name"
                        style={{ flex: 1, padding: '10px 14px', border: '2px solid var(--color-stroke-subtle)', borderRadius: 0, background: 'var(--color-bg-base)', fontSize: 14, color: 'var(--color-text-primary)' }}
                    />
                    <button className="btn btn-secondary" onClick={addStage}>+ Add</button>
                </div>
                <div className="users-modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>Cancel</button>
                    <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                        {saving ? 'Saving…' : 'Save Pipeline'}
                    </button>
                </div>
            </div>
        </div>
    );
}
