'use client';

import { useState, useEffect } from 'react';
import { useUIFeedback } from '@/components/UIFeedback';
import { FEATURE_LABELS } from '@/lib/permissions';

import {
    ShieldCheck, Eye, Pencil, Trash2, Users, Key, FolderOpen, X,
    ClipboardList, Globe, Ban, Settings,
} from 'lucide-react';
import { TableShell, TableToolbar, StatusBadge, RowActionMenu, TableEmptyState, TableLoadingState } from '@/components/table';
import '@/components/table/table.css';
import './access-groups.css';

interface AccessGroupRecord {
    id: string;
    name: string;
    description: string | null;
    memberCount: number;
    permissions: { features: string[]; subFeatures: string[]; projectScope: string };
    createdAt: string;
}

interface GroupDetail {
    id: string;
    name: string;
    description: string | null;
    permissions: {
        features: string[];
        subFeatures: string[];
        projectScope: { mode: string; ids: string[] };
    };
    members: { id: string; name: string; email: string }[];
}

interface MetadataPayload {
    featureKeys: string[];
    subFeatureKeys: string[];
    labels: Record<string, string>;
    featureGroups: { key: string; label: string; features: string[] }[];
    subFeatureGroups: Record<string, string[]>;
    projects: { id: string; name: string }[];
}

export default function AccessGroupsPage() {
    const { showToast, showConfirm } = useUIFeedback();
    const [groups, setGroups] = useState<AccessGroupRecord[]>([]);
    const [loading, setLoading] = useState(true);
    // Editor state
    const [showEditor, setShowEditor] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editorName, setEditorName] = useState('');
    const [editorDesc, setEditorDesc] = useState('');
    const [editorFeatures, setEditorFeatures] = useState<string[]>([]);
    const [editorSubFeatures, setEditorSubFeatures] = useState<string[]>([]);
    const [editorProjectMode, setEditorProjectMode] = useState<'all' | 'selected' | 'none'>('all');
    const [editorProjectIds, setEditorProjectIds] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);
    // Metadata
    const [metadata, setMetadata] = useState<MetadataPayload | null>(null);
    // Detail view
    const [viewingGroup, setViewingGroup] = useState<GroupDetail | null>(null);

    useEffect(() => { loadGroups(); }, []);

    async function loadGroups() {
        try {
            const res = await fetch('/api/company/access-groups');
            const data = await res.json();
            setGroups(data.groups || []);
        } catch { showToast('Failed to load groups', 'error'); }
        setLoading(false);
    }

    async function loadMetadata() {
        if (metadata) return;
        try {
            const res = await fetch('/api/company/access-metadata');
            setMetadata(await res.json());
        } catch { showToast('Failed to load metadata', 'error'); }
    }

    function openCreate() {
        loadMetadata();
        setEditingId(null);
        setEditorName(''); setEditorDesc('');
        setEditorFeatures([]); setEditorSubFeatures([]);
        setEditorProjectMode('all'); setEditorProjectIds([]);
        setShowEditor(true);
    }

    async function openEdit(id: string) {
        await loadMetadata();
        try {
            const res = await fetch(`/api/company/access-groups/${id}`);
            const data = await res.json();
            if (!data.group) { showToast('Not found', 'error'); return; }
            const g = data.group as GroupDetail;
            setEditingId(id);
            setEditorName(g.name);
            setEditorDesc(g.description || '');
            setEditorFeatures(g.permissions.features);
            setEditorSubFeatures(g.permissions.subFeatures);
            if (g.permissions.projectScope.mode === 'all') {
                setEditorProjectMode('all'); setEditorProjectIds([]);
            } else if (g.permissions.projectScope.mode === 'selected') {
                setEditorProjectMode('selected'); setEditorProjectIds(g.permissions.projectScope.ids);
            } else {
                setEditorProjectMode('none'); setEditorProjectIds([]);
            }
            setShowEditor(true);
        } catch { showToast('Failed to load group', 'error'); }
    }

    async function viewGroup(id: string) {
        try {
            const res = await fetch(`/api/company/access-groups/${id}`);
            const data = await res.json();
            if (data.group) setViewingGroup(data.group);
        } catch { showToast('Failed', 'error'); }
    }

    async function handleSave() {
        if (!editorName.trim()) { showToast('Name is required', 'error'); return; }
        setSaving(true);
        const payload = {
            name: editorName.trim(),
            description: editorDesc.trim() || null,
            permissions: {
                features: editorFeatures,
                subFeatures: editorSubFeatures,
                projectScope: editorProjectMode === 'none' ? undefined : {
                    mode: editorProjectMode,
                    ids: editorProjectMode === 'selected' ? editorProjectIds : [],
                },
            },
        };
        try {
            const url = editingId ? `/api/company/access-groups/${editingId}` : '/api/company/access-groups';
            const method = editingId ? 'PUT' : 'POST';
            const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || 'Failed', 'error'); setSaving(false); return; }
            showToast(editingId ? 'Group updated' : 'Group created', 'success');
            setShowEditor(false);
            loadGroups();
        } catch { showToast('Error saving', 'error'); }
        setSaving(false);
    }

    function handleDelete(id: string, name: string) {
        showConfirm(`Delete group "${name}"?`, async () => {
            const res = await fetch(`/api/company/access-groups/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || 'Failed', 'error'); return; }
            showToast('Group deleted', 'success');
            loadGroups();
        });
    }

    function toggleFeature(key: string) {
        setEditorFeatures(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);
    }

    function toggleSubFeature(key: string) {
        setEditorSubFeatures(p => p.includes(key) ? p.filter(k => k !== key) : [...p, key]);
    }

    function toggleProject(pid: string) {
        setEditorProjectIds(p => p.includes(pid) ? p.filter(x => x !== pid) : [...p, pid]);
    }

    return (
        <div className="ag-page">
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><ShieldCheck size={20} strokeWidth={2} /></span>
                    <h1>Access Groups</h1>
                </div>
                <div className="assistant-page-workspace">
                    <button className="btn btn-primary" onClick={openCreate}>+ New Group</button>
                </div>
            </div>

            {/* ── Access Groups Table ── */}
            <TableShell>
                <TableToolbar resultCount={`${groups.length} group${groups.length !== 1 ? 's' : ''}`} />
                {loading ? (
                    <TableLoadingState rows={4} columns={5} />
                ) : groups.length === 0 ? (
                    <TableEmptyState
                        icon={<ShieldCheck size={36} strokeWidth={1.5} />}
                        title="No access groups yet"
                        description="Create your first access group to define permissions for your team."
                        action={<button className="btn btn-primary" onClick={openCreate}>Create Group</button>}
                    />
                ) : (
                    <table className="nousio-table">
                        <thead>
                            <tr>
                                <th style={{ width: '22%' }}>Group</th>
                                <th style={{ width: '10%' }} className="align-center">Members</th>
                                <th style={{ width: '10%' }} className="align-center">Features</th>
                                <th style={{ width: '14%' }}>Scope</th>
                                <th style={{ width: '28%' }}>Permissions</th>
                                <th style={{ width: '16%' }} className="align-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groups.map(g => (
                                <tr key={g.id} className="clickable" onClick={() => viewGroup(g.id)}>
                                    <td>
                                        <div className="nousio-cell-stack">
                                            <span className="cell-line-1">{g.name}</span>
                                            {g.description && <span className="cell-line-2">{g.description}</span>}
                                        </div>
                                    </td>
                                    <td className="align-center">
                                        <StatusBadge variant="neutral"><Users size={10} /> {g.memberCount}</StatusBadge>
                                    </td>
                                    <td className="align-center">
                                        <StatusBadge variant="info"><Key size={10} /> {g.permissions.features.length}</StatusBadge>
                                    </td>
                                    <td>
                                        <StatusBadge variant={g.permissions.projectScope === 'all' ? 'success' : g.permissions.projectScope === 'selected' ? 'warning' : 'neutral'}>
                                            {g.permissions.projectScope === 'all' ? 'All projects' : g.permissions.projectScope === 'selected' ? 'Selected' : 'No scope'}
                                        </StatusBadge>
                                    </td>
                                    <td>
                                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                                            {g.permissions.features.slice(0, 4).map(f => (
                                                <StatusBadge key={f} variant="neutral">{FEATURE_LABELS[f] || f}</StatusBadge>
                                            ))}
                                            {g.permissions.features.length > 4 && (
                                                <StatusBadge variant="neutral">+{g.permissions.features.length - 4} more</StatusBadge>
                                            )}
                                        </div>
                                    </td>
                                    <td onClick={e => e.stopPropagation()}>
                                        <RowActionMenu
                                            primaryAction={{
                                                icon: <Eye size={14} strokeWidth={2} />,
                                                title: 'View',
                                                onClick: () => viewGroup(g.id),
                                            }}
                                            items={[
                                                { label: 'Edit', icon: <Pencil size={14} />, onClick: () => openEdit(g.id) },
                                                { label: 'Delete', icon: <Trash2 size={14} />, onClick: () => handleDelete(g.id, g.name), danger: true },
                                            ]}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </TableShell>

            {/* ═══ Group Editor Modal ═══ */}
            {showEditor && metadata && (
                <div className="modal-backdrop" onClick={() => setShowEditor(false)}>
                    <div className="ag-editor" onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="ag-editor-header">
                            <div className="ag-editor-header-left">
                                <div className="ag-editor-icon">{editingId ? <Pencil size={20} strokeWidth={2} /> : <ShieldCheck size={20} strokeWidth={2} />}</div>
                                <div>
                                    <h3 className="ag-editor-title">{editingId ? 'Edit Group' : 'Create Access Group'}</h3>
                                    <p className="ag-editor-subtitle">{editingId ? 'Update group permissions and settings' : 'Define a reusable set of permissions for your team'}</p>
                                </div>
                            </div>
                            <button className="ag-editor-close" onClick={() => setShowEditor(false)} title="Close"><X size={16} strokeWidth={2} /></button>
                        </div>

                        {/* Scrollable Body */}
                        <div className="ag-editor-body">

                            {/* Basic Info */}
                            <div className="ag-editor-section">
                                <div className="ag-section-label">
                                    <span className="ag-section-icon"><ClipboardList size={14} strokeWidth={2} /></span>
                                    Basic Info
                                </div>
                                <div className="ag-field">
                                    <label className="ag-field-label">Group Name <span className="ag-required">*</span></label>
                                    <input type="text" value={editorName} onChange={e => setEditorName(e.target.value)} placeholder="e.g. Marketing Team" autoFocus />
                                </div>
                                <div className="ag-field">
                                    <label className="ag-field-label">Description</label>
                                    <textarea value={editorDesc} onChange={e => setEditorDesc(e.target.value)} placeholder="Brief description of what this group is for..." />
                                </div>
                            </div>

                            {/* Feature Permissions */}
                            <div className="ag-editor-section">
                                <div className="ag-section-label">
                                    <span className="ag-section-icon"><Key size={14} strokeWidth={2} /></span>
                                    Feature Permissions
                                </div>
                                <div className="ag-perm-grid">
                                    {metadata.featureGroups.map(fg => (
                                        <div key={fg.key} className="ag-perm-group">
                                            <span className="ag-perm-group-label">{fg.label}</span>
                                            {fg.features.map(fk => (
                                                <label key={fk} className="ag-perm-item">
                                                    <input type="checkbox" checked={editorFeatures.includes(fk)} onChange={() => toggleFeature(fk)} />
                                                    <span className="ag-perm-item-label">{metadata.labels[fk] || fk}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Sub-Feature Permissions */}
                            <div className="ag-editor-section">
                                <div className="ag-section-label">
                                    <span className="ag-section-icon"><Settings size={14} strokeWidth={2} /></span>
                                    Sub-Feature Permissions
                                </div>
                                <div className="ag-perm-grid">
                                    {Object.entries(metadata.subFeatureGroups).map(([parent, subs]) => (
                                        <div key={parent} className="ag-perm-group">
                                            <span className="ag-perm-group-label">{metadata.labels[parent] || parent}</span>
                                            {subs.map((sk: string) => (
                                                <label key={sk} className="ag-perm-item">
                                                    <input type="checkbox" checked={editorSubFeatures.includes(sk)} onChange={() => toggleSubFeature(sk)} />
                                                    <span className="ag-perm-item-label">{metadata.labels[sk] || sk}</span>
                                                </label>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Project Scope */}
                            <div className="ag-editor-section">
                                <div className="ag-section-label">
                                    <span className="ag-section-icon"><FolderOpen size={14} strokeWidth={2} /></span>
                                    Project / Workspace Scope
                                </div>
                                <div className="ag-scope-options">
                                    <label className={`ag-scope-item ${editorProjectMode === 'all' ? 'active' : ''}`}>
                                        <input type="radio" name="scope" checked={editorProjectMode === 'all'} onChange={() => setEditorProjectMode('all')} style={{ display: 'none' }} />
                                        <div className="ag-scope-item-text">
                                            <span className="ag-scope-item-title"><Globe size={14} strokeWidth={2} /> All Projects</span>
                                            <span className="ag-scope-item-desc">Access to all current and future projects</span>
                                        </div>
                                    </label>
                                    <label className={`ag-scope-item ${editorProjectMode === 'selected' ? 'active' : ''}`}>
                                        <input type="radio" name="scope" checked={editorProjectMode === 'selected'} onChange={() => setEditorProjectMode('selected')} style={{ display: 'none' }} />
                                        <div className="ag-scope-item-text">
                                            <span className="ag-scope-item-title"><ClipboardList size={14} strokeWidth={2} /> Selected Projects</span>
                                            <span className="ag-scope-item-desc">Restrict access to specific projects only</span>
                                        </div>
                                    </label>
                                    <label className={`ag-scope-item ${editorProjectMode === 'none' ? 'active' : ''}`}>
                                        <input type="radio" name="scope" checked={editorProjectMode === 'none'} onChange={() => setEditorProjectMode('none')} style={{ display: 'none' }} />
                                        <div className="ag-scope-item-text">
                                            <span className="ag-scope-item-title"><Ban size={14} strokeWidth={2} /> No Project Access</span>
                                            <span className="ag-scope-item-desc">Members cannot access any projects</span>
                                        </div>
                                    </label>
                                </div>
                                {editorProjectMode === 'selected' && (
                                    <div className="ag-project-list">
                                        {metadata.projects.length === 0 ? (
                                            <p className="ag-detail-empty">No projects found.</p>
                                        ) : metadata.projects.map(p => (
                                            <label key={p.id} className="ag-perm-item">
                                                <input type="checkbox" checked={editorProjectIds.includes(p.id)} onChange={() => toggleProject(p.id)} />
                                                <span className="ag-perm-item-label">{p.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="ag-editor-footer">
                            <button className="btn btn-secondary" onClick={() => setShowEditor(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSave} disabled={saving || !editorName.trim()}>
                                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Group'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Group Detail Modal ═══ */}
            {viewingGroup && (
                <div className="modal-backdrop" onClick={() => setViewingGroup(null)}>
                    <div className="ag-editor" onClick={e => e.stopPropagation()}>

                        {/* Header */}
                        <div className="ag-editor-header">
                            <div className="ag-editor-header-left">
                                <div className="ag-editor-icon"><ShieldCheck size={20} strokeWidth={2} /></div>
                                <div>
                                    <h3 className="ag-editor-title">{viewingGroup.name}</h3>
                                    {viewingGroup.description && <p className="ag-editor-subtitle">{viewingGroup.description}</p>}
                                </div>
                            </div>
                            <button className="ag-editor-close" onClick={() => setViewingGroup(null)} title="Close"><X size={16} strokeWidth={2} /></button>
                        </div>

                        {/* Body */}
                        <div className="ag-editor-body">

                            <div className="ag-editor-section">
                                <div className="ag-section-label">
                                    <span className="ag-section-icon"><Key size={14} strokeWidth={2} /></span>
                                    Features ({viewingGroup.permissions.features.length})
                                </div>
                                <div className="ag-detail-tags">
                                    {viewingGroup.permissions.features.map(f => (
                                        <span key={f} className="ag-detail-tag">{FEATURE_LABELS[f] || f}</span>
                                    ))}
                                    {viewingGroup.permissions.features.length === 0 && <span className="ag-detail-empty">No features granted</span>}
                                </div>
                            </div>

                            <div className="ag-editor-section">
                                <div className="ag-section-label">
                                    <span className="ag-section-icon"><Settings size={14} strokeWidth={2} /></span>
                                    Sub-Features ({viewingGroup.permissions.subFeatures.length})
                                </div>
                                <div className="ag-detail-tags">
                                    {viewingGroup.permissions.subFeatures.map(sf => (
                                        <span key={sf} className="ag-detail-tag">{FEATURE_LABELS[sf] || sf}</span>
                                    ))}
                                    {viewingGroup.permissions.subFeatures.length === 0 && <span className="ag-detail-empty">No sub-features granted</span>}
                                </div>
                            </div>

                            <div className="ag-editor-section">
                                <div className="ag-section-label">
                                    <span className="ag-section-icon"><FolderOpen size={14} strokeWidth={2} /></span>
                                    Project Scope
                                </div>
                                <p className="ag-scope-summary">
                                    {viewingGroup.permissions.projectScope.mode === 'all' ? <><Globe size={14} strokeWidth={2} /> All projects (current & future)</> :
                                        viewingGroup.permissions.projectScope.mode === 'selected' ?
                                            <><ClipboardList size={14} strokeWidth={2} /> {viewingGroup.permissions.projectScope.ids.length} selected project(s)</> : <><Ban size={14} strokeWidth={2} /> No project scope</>}
                                </p>
                            </div>

                            <div className="ag-editor-section">
                                <div className="ag-section-label">
                                    <span className="ag-section-icon"><Users size={14} strokeWidth={2} /></span>
                                    Members ({viewingGroup.members.length})
                                </div>
                                {viewingGroup.members.length === 0 ? (
                                    <span className="ag-detail-empty">No members assigned yet</span>
                                ) : (
                                    <div className="ag-members-list">
                                        {viewingGroup.members.map(m => (
                                            <div key={m.id} className="ag-member-row">
                                                <span className="ag-member-name">{m.name}</span>
                                                <span className="ag-member-email">{m.email}</span>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="ag-editor-footer">
                            <button className="btn btn-secondary" onClick={() => { setViewingGroup(null); openEdit(viewingGroup.id); }}>Edit Group</button>
                            <button className="btn btn-primary" onClick={() => setViewingGroup(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
