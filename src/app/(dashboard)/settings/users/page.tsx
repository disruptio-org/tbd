'use client';

import { useState, useEffect } from 'react';
import { useUIFeedback } from '@/components/UIFeedback';
import { FEATURE_LABELS } from '@/lib/permissions';
import { Pencil, Tag, Key, Ban, CheckCircle, UserPlus, Shield, X, Users, Eye, EyeOff } from 'lucide-react';
import { TableShell, TableToolbar, StatusBadge, RowActionMenu, TableEmptyState, TableLoadingState } from '@/components/table';
import '@/components/table/table.css';
import './users.css';

interface UserRecord {
    id: string;
    name: string;
    email: string;
    role: string;
    status: string;
    avatarUrl: string | null;
    createdAt: string;
    groups: { id: string; name: string }[];
}

export default function UsersPage() {
    const { showToast, showConfirm } = useUIFeedback();
    const [users, setUsers] = useState<UserRecord[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [filterStatus, setFilterStatus] = useState('');
    // Create user modal
    const [showCreate, setShowCreate] = useState(false);
    const [newName, setNewName] = useState('');
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState('MEMBER');
    const [newPassword, setNewPassword] = useState('');
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [creating, setCreating] = useState(false);
    // Edit user modal
    const [editing, setEditing] = useState<UserRecord | null>(null);
    const [editName, setEditName] = useState('');
    const [editRole, setEditRole] = useState('');
    const [saving, setSaving] = useState(false);
    // Groups assignment
    const [assigningGroups, setAssigningGroups] = useState<UserRecord | null>(null);
    const [allGroups, setAllGroups] = useState<{ id: string; name: string }[]>([]);
    const [selectedGroupIds, setSelectedGroupIds] = useState<string[]>([]);
    const [savingGroups, setSavingGroups] = useState(false);
    // Effective access viewer
    const [viewingAccess, setViewingAccess] = useState<{ user: UserRecord; access: Record<string, unknown> } | null>(null);

    useEffect(() => { loadUsers(); }, []);

    async function loadUsers() {
        try {
            const params = new URLSearchParams();
            if (search.trim()) params.set('search', search.trim());
            if (filterRole) params.set('role', filterRole);
            if (filterStatus) params.set('status', filterStatus);
            const res = await fetch(`/api/company/users?${params}`);
            const data = await res.json();
            setUsers(data.users || []);
        } catch { showToast('Failed to load users', 'error'); }
        setLoading(false);
    }

    useEffect(() => {
        const timer = setTimeout(() => { setLoading(true); loadUsers(); }, 300);
        return () => clearTimeout(timer);
    }, [search, filterRole, filterStatus]);

    async function handleCreate() {
        if (!newName.trim() || !newEmail.trim() || newPassword.length < 6) return;
        setCreating(true);
        try {
            const res = await fetch('/api/company/users', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newName.trim(), email: newEmail.trim(), role: newRole, password: newPassword }),
            });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || 'Failed', 'error'); setCreating(false); return; }
            showToast('User created', 'success');
            setShowCreate(false); setNewName(''); setNewEmail(''); setNewRole('MEMBER'); setNewPassword(''); setShowNewPassword(false);
            loadUsers();
        } catch { showToast('Error creating user', 'error'); }
        setCreating(false);
    }

    async function handleSaveEdit() {
        if (!editing) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/company/users/${editing.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editName.trim(), role: editRole }),
            });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || 'Failed', 'error'); setSaving(false); return; }
            showToast('User updated', 'success');
            setEditing(null);
            loadUsers();
        } catch { showToast('Error saving', 'error'); }
        setSaving(false);
    }

    function openEdit(u: UserRecord) {
        setEditing(u); setEditName(u.name); setEditRole(u.role);
    }

    async function handleDeactivate(u: UserRecord) {
        showConfirm(`Deactivate ${u.name}?`, async () => {
            const res = await fetch(`/api/company/users/${u.id}/deactivate`, { method: 'POST' });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || 'Failed', 'error'); return; }
            showToast('User deactivated', 'success');
            loadUsers();
        });
    }

    async function handleReactivate(u: UserRecord) {
        const res = await fetch(`/api/company/users/${u.id}/reactivate`, { method: 'POST' });
        const data = await res.json();
        if (!res.ok) { showToast(data.error || 'Failed', 'error'); return; }
        showToast('User reactivated', 'success');
        loadUsers();
    }

    async function openGroupAssignment(u: UserRecord) {
        setAssigningGroups(u);
        setSelectedGroupIds(u.groups.map(g => g.id));
        try {
            const res = await fetch('/api/company/access-groups');
            const data = await res.json();
            setAllGroups((data.groups || []).map((g: { id: string; name: string }) => ({ id: g.id, name: g.name })));
        } catch { showToast('Failed to load groups', 'error'); }
    }

    async function handleSaveGroups() {
        if (!assigningGroups) return;
        setSavingGroups(true);
        try {
            const res = await fetch(`/api/company/users/${assigningGroups.id}/groups`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ groupIds: selectedGroupIds }),
            });
            if (!res.ok) { const d = await res.json(); showToast(d.error || 'Failed', 'error'); setSavingGroups(false); return; }
            showToast('Groups updated', 'success');
            setAssigningGroups(null);
            loadUsers();
        } catch { showToast('Error saving groups', 'error'); }
        setSavingGroups(false);
    }

    async function handleViewAccess(u: UserRecord) {
        try {
            const res = await fetch(`/api/company/users/${u.id}/effective-access`);
            const data = await res.json();
            setViewingAccess({ user: u, access: data.access });
        } catch { showToast('Failed to load access', 'error'); }
    }

    function getInitials(name: string) {
        return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    }

    function roleLabel(r: string) {
        return r === 'SUPER_ADMIN' ? 'Super Admin' : r === 'ADMIN' ? 'Admin' : 'Member';
    }

    return (
        <div className="users-page">
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><Users size={20} strokeWidth={2} /></span>
                    <h1>User Management</h1>
                </div>
                <div className="assistant-page-workspace">
                    <button className="btn btn-primary" onClick={() => setShowCreate(true)}>+ Create User</button>
                </div>
            </div>

            {/* ── Users Table ── */}
            <TableShell>
                <TableToolbar
                    searchValue={search}
                    searchPlaceholder="Search by name or email..."
                    onSearchChange={setSearch}
                    filters={
                        <>
                            <select className="nousio-toolbar-filter" style={{ padding: '6px 10px' }} value={filterRole} onChange={e => setFilterRole(e.target.value)}>
                                <option value="">All Roles</option>
                                <option value="ADMIN">Admin</option>
                                <option value="MEMBER">Member</option>
                            </select>
                            <select className="nousio-toolbar-filter" style={{ padding: '6px 10px' }} value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
                                <option value="">All Status</option>
                                <option value="ACTIVE">Active</option>
                                <option value="INACTIVE">Inactive</option>
                            </select>
                        </>
                    }
                    resultCount={`${users.length} user${users.length !== 1 ? 's' : ''}`}
                />
                {loading && users.length === 0 ? (
                    <TableLoadingState rows={5} columns={5} />
                ) : users.length > 0 ? (
                    <table className="nousio-table">
                        <thead>
                            <tr>
                                <th style={{ width: '30%' }}>User</th>
                                <th style={{ width: '12%' }}>Role</th>
                                <th style={{ width: '12%' }}>Status</th>
                                <th style={{ width: '20%' }}>Groups</th>
                                <th style={{ width: '12%' }}>Created</th>
                                <th style={{ width: '14%' }} className="align-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {users.map(u => (
                                <tr key={u.id}>
                                    <td>
                                        <div className="users-cell-user">
                                            {u.avatarUrl
                                                ? <img src={u.avatarUrl} alt={u.name} className="users-avatar" />
                                                : <div className="users-avatar-placeholder">{getInitials(u.name)}</div>
                                            }
                                            <div className="nousio-cell-stack">
                                                <span className="cell-line-1">{u.name}</span>
                                                <span className="cell-line-2">{u.email}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td><StatusBadge variant="neutral">{roleLabel(u.role)}</StatusBadge></td>
                                    <td>
                                        <StatusBadge variant={u.status === 'ACTIVE' ? 'success' : u.status === 'INACTIVE' ? 'error' : 'warning'}>
                                            {u.status}
                                        </StatusBadge>
                                    </td>
                                    <td>
                                        <div className="users-groups-cell">
                                            {u.groups.length === 0 ? <span className="users-no-groups">No groups</span> : u.groups.map(g => (
                                                <span key={g.id} className="users-group-tag">{g.name}</span>
                                            ))}
                                        </div>
                                    </td>
                                    <td className="cell-muted">{new Date(u.createdAt).toLocaleDateString()}</td>
                                    <td>
                                        <RowActionMenu
                                            primaryAction={{
                                                icon: <Pencil size={14} strokeWidth={2} />,
                                                title: 'Edit user',
                                                onClick: () => openEdit(u),
                                            }}
                                            items={[
                                                { label: 'Assign Groups', icon: <Tag size={14} />, onClick: () => openGroupAssignment(u) },
                                                { label: 'View Permissions', icon: <Key size={14} />, onClick: () => handleViewAccess(u) },
                                                u.status === 'ACTIVE'
                                                    ? { label: 'Deactivate', icon: <Ban size={14} />, onClick: () => handleDeactivate(u), danger: true }
                                                    : { label: 'Reactivate', icon: <CheckCircle size={14} />, onClick: () => handleReactivate(u) },
                                            ]}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                ) : (
                    <TableEmptyState
                        icon={<Users size={32} strokeWidth={1.5} />}
                        title="No users found"
                        description="Try adjusting your search or filters"
                    />
                )}
            </TableShell>

            {/* Create User Modal */}
            {showCreate && (
                <div className="modal-backdrop" onClick={() => setShowCreate(false)}>
                    <div className="users-modal" onClick={e => e.stopPropagation()}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><UserPlus size={18} strokeWidth={2} /> Create User</h3>
                        <div className="users-form-group">
                            <label>Full Name *</label>
                            <input value={newName} onChange={e => setNewName(e.target.value)} placeholder="John Doe" autoFocus />
                        </div>
                        <div className="users-form-group">
                            <label>Email *</label>
                            <input type="email" value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="john@company.com" />
                        </div>
                        <div className="users-form-group">
                            <label>Initial Password *</label>
                            <div style={{ position: 'relative' }}>
                                <input
                                    type={showNewPassword ? 'text' : 'password'}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Min. 6 characters"
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(p => !p)}
                                    style={{
                                        position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
                                        background: 'none', border: 'none', cursor: 'pointer', padding: 4,
                                        color: 'var(--color-text-tertiary)',
                                    }}
                                    title={showNewPassword ? 'Hide password' : 'Show password'}
                                >
                                    {showNewPassword ? <EyeOff size={16} strokeWidth={2} /> : <Eye size={16} strokeWidth={2} />}
                                </button>
                            </div>
                            {newPassword.length > 0 && newPassword.length < 6 && (
                                <span style={{ fontSize: 12, color: 'var(--color-state-error)', marginTop: 4 }}>Password must be at least 6 characters</span>
                            )}
                        </div>
                        <div className="users-form-group">
                            <label>Role</label>
                            <select value={newRole} onChange={e => setNewRole(e.target.value)}>
                                <option value="MEMBER">Member</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                        </div>
                        <div className="users-modal-footer">
                            <button className="btn btn-secondary" onClick={() => setShowCreate(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleCreate} disabled={creating || !newName.trim() || !newEmail.trim() || newPassword.length < 6}>
                                {creating ? 'Creating...' : 'Create User'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit User Modal */}
            {editing && (
                <div className="modal-backdrop" onClick={() => setEditing(null)}>
                    <div className="users-modal" onClick={e => e.stopPropagation()}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Pencil size={18} strokeWidth={2} /> Edit User</h3>
                        <div className="users-form-group">
                            <label>Full Name</label>
                            <input value={editName} onChange={e => setEditName(e.target.value)} />
                        </div>
                        <div className="users-form-group">
                            <label>Email</label>
                            <input value={editing.email} readOnly disabled />
                        </div>
                        <div className="users-form-group">
                            <label>Role</label>
                            <select value={editRole} onChange={e => setEditRole(e.target.value)}>
                                <option value="MEMBER">Member</option>
                                <option value="ADMIN">Admin</option>
                            </select>
                        </div>
                        <div className="users-modal-footer">
                            <button className="btn btn-secondary" onClick={() => setEditing(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveEdit} disabled={saving}>
                                {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Group Assignment Modal */}
            {assigningGroups && (
                <div className="modal-backdrop" onClick={() => setAssigningGroups(null)}>
                    <div className="users-modal" onClick={e => e.stopPropagation()}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Tag size={18} strokeWidth={2} /> Assign Groups — {assigningGroups.name}</h3>
                        {allGroups.length === 0 ? (
                            <p className="users-empty-msg">No access groups created yet. Create one in the Access Groups settings.</p>
                        ) : (
                            <div className="users-group-checklist">
                                {allGroups.map(g => (
                                    <label key={g.id} className="users-group-check-item">
                                        <input
                                            type="checkbox"
                                            checked={selectedGroupIds.includes(g.id)}
                                            onChange={e => {
                                                if (e.target.checked) setSelectedGroupIds(p => [...p, g.id]);
                                                else setSelectedGroupIds(p => p.filter(x => x !== g.id));
                                            }}
                                        />
                                        <span>{g.name}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                        <div className="users-modal-footer">
                            <button className="btn btn-secondary" onClick={() => setAssigningGroups(null)}>Cancel</button>
                            <button className="btn btn-primary" onClick={handleSaveGroups} disabled={savingGroups}>
                                {savingGroups ? 'Saving...' : 'Save'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Effective Access Modal */}
            {viewingAccess && (
                <div className="modal-backdrop" onClick={() => setViewingAccess(null)}>
                    <div className="users-modal users-modal-wide" onClick={e => e.stopPropagation()}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}><Key size={18} strokeWidth={2} /> Effective Permissions — {viewingAccess.user.name}</h3>
                        <div className="users-access-grid">
                            <div className="users-access-section">
                                <h4>Features</h4>
                                {Object.entries((viewingAccess.access as { features?: Record<string, boolean> }).features || {}).map(([key, val]) => (
                                    <div key={key} className={`users-access-row ${val ? 'granted' : 'denied'}`}>
                                        <span>{FEATURE_LABELS[key] || key}</span>
                                        <span className={val ? 'access-yes' : 'access-no'}>{val ? <CheckCircle size={14} strokeWidth={2} /> : <X size={14} strokeWidth={2} />}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="users-access-section">
                                <h4>Sub-Features</h4>
                                {Object.entries((viewingAccess.access as { subFeatures?: Record<string, boolean> }).subFeatures || {}).map(([key, val]) => (
                                    <div key={key} className={`users-access-row ${val ? 'granted' : 'denied'}`}>
                                        <span>{FEATURE_LABELS[key] || key}</span>
                                        <span className={val ? 'access-yes' : 'access-no'}>{val ? <CheckCircle size={14} strokeWidth={2} /> : <X size={14} strokeWidth={2} />}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <div className="users-modal-footer">
                            <button className="btn btn-primary" onClick={() => setViewingAccess(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
