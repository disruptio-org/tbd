'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Building2, Plus, Search, ArrowRight, Loader2,
    Mail, User, FolderKanban, X, Globe,
} from 'lucide-react';
import './customers.css';

/* ─── Types ───────────────────────────────────────────── */

interface CustomerItem {
    id: string;
    name: string;
    description: string | null;
    industry: string | null;
    website: string | null;
    contactName: string | null;
    contactEmail: string | null;
    status: string;
    projectCount: number;
    createdAt: string;
}

/* ─── Helper: Customer Initials ───────────────────────── */

function getInitials(name: string): string {
    return name.split(/[\s\-_]+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

/* ─── Main Component ──────────────────────────────────── */

export default function CustomersPage() {
    const router = useRouter();
    const [customers, setCustomers] = useState<CustomerItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [creating, setCreating] = useState(false);

    // Form state
    const [form, setForm] = useState({
        name: '',
        description: '',
        industry: '',
        website: '',
        contactName: '',
        contactEmail: '',
    });

    /* ─── Load Customers ──────────────────────────────── */

    const loadCustomers = useCallback(async () => {
        try {
            const res = await fetch('/api/customers');
            if (res.ok) setCustomers(await res.json());
        } catch (err) {
            console.error('[customers] Failed to load:', err);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { loadCustomers(); }, [loadCustomers]);

    /* ─── Create Customer ─────────────────────────────── */

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.name.trim()) return;
        setCreating(true);

        try {
            const res = await fetch('/api/customers', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(form),
            });
            if (res.ok) {
                const customer = await res.json();
                setShowCreate(false);
                setForm({ name: '', description: '', industry: '', website: '', contactName: '', contactEmail: '' });
                router.push(`/customers/${customer.id}`);
            }
        } catch (err) {
            console.error('[customers] Failed to create:', err);
        } finally {
            setCreating(false);
        }
    };

    /* ─── Filter ──────────────────────────────────────── */

    const filtered = customers
        .filter(c => c.status === 'active')
        .filter(c => {
            if (!searchQuery) return true;
            const q = searchQuery.toLowerCase();
            return c.name.toLowerCase().includes(q) ||
                (c.industry || '').toLowerCase().includes(q) ||
                (c.contactName || '').toLowerCase().includes(q);
        });

    /* ─── Stats ───────────────────────────────────────── */
    const totalActive = customers.filter(c => c.status === 'active').length;
    const totalProjects = customers.reduce((sum, c) => sum + c.projectCount, 0);
    const archivedCount = customers.filter(c => c.status === 'archived').length;
    const uniqueIndustries = new Set(customers.filter(c => c.industry).map(c => c.industry)).size;

    /* ─── Render ──────────────────────────────────────── */

    if (loading) {
        return (
            <div className="cu-root">
                <div className="cu-loading">
                    <Loader2 size={24} className="cu-spin" />
                    <span>Loading customers...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="cu-root">
            {/* ── Header ── */}
            <header className="cu-header">
                <div className="cu-header-left">
                    <h1 className="cu-title">Customers</h1>
                    <p className="cu-subtitle">Manage your client portfolio and relationships</p>
                </div>
                <button className="cu-create-btn" onClick={() => setShowCreate(true)}>
                    <Plus size={16} /> New Customer
                </button>
            </header>

            {/* ── Stats ── */}
            <div className="cu-stats">
                <div className="cu-stat-card">
                    <div className="cu-stat-value accent">{totalActive}</div>
                    <div className="cu-stat-label">Active Customers</div>
                </div>
                <div className="cu-stat-card">
                    <div className="cu-stat-value">{totalProjects}</div>
                    <div className="cu-stat-label">Total Projects</div>
                </div>
                <div className="cu-stat-card">
                    <div className="cu-stat-value">{uniqueIndustries}</div>
                    <div className="cu-stat-label">Industries</div>
                </div>
                <div className="cu-stat-card">
                    <div className="cu-stat-value">{archivedCount}</div>
                    <div className="cu-stat-label">Archived</div>
                </div>
            </div>

            {/* ── Search ── */}
            <div className="cu-toolbar">
                <div className="cu-search">
                    <Search size={14} />
                    <input
                        type="text"
                        placeholder="Search customers by name, industry, or contact..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* ── Grid ── */}
            {filtered.length === 0 ? (
                <div className="cu-empty">
                    <Building2 size={48} strokeWidth={1.2} className="cu-empty-icon" />
                    <h3>{customers.length === 0 ? 'No Customers Yet' : 'No Results'}</h3>
                    <p>
                        {customers.length === 0
                            ? 'Create your first customer to organize projects and DNA context by client.'
                            : 'Try adjusting your search query.'}
                    </p>
                    {customers.length === 0 && (
                        <button className="cu-create-btn" onClick={() => setShowCreate(true)} style={{ marginTop: 8 }}>
                            <Plus size={14} /> Create First Customer
                        </button>
                    )}
                </div>
            ) : (
                <div className="cu-grid">
                    {filtered.map(customer => (
                        <div
                            key={customer.id}
                            className="cu-card"
                            onClick={() => router.push(`/customers/${customer.id}`)}
                        >
                            {/* Header */}
                            <div className="cu-card-header">
                                <div className="cu-card-icon">
                                    {getInitials(customer.name)}
                                </div>
                                <div className="cu-card-info">
                                    <h3 className="cu-card-name">{customer.name}</h3>
                                    {customer.industry && (
                                        <div className="cu-card-industry">
                                            {customer.industry}
                                        </div>
                                    )}
                                </div>
                                {customer.projectCount > 0 && (
                                    <span className="cu-card-badge">
                                        <FolderKanban size={13} /> {customer.projectCount}
                                    </span>
                                )}
                            </div>

                            {/* Description */}
                            {customer.description && (
                                <p className="cu-card-desc">{customer.description}</p>
                            )}

                            {/* Footer */}
                            <div className="cu-card-footer">
                                <div className="cu-card-meta">
                                    {customer.contactName && (
                                        <span><User size={11} /> {customer.contactName}</span>
                                    )}
                                    {customer.contactEmail && (
                                        <span><Mail size={11} /> {customer.contactEmail}</span>
                                    )}
                                </div>
                                <ArrowRight size={14} className="cu-card-arrow" />
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* ── Create Modal ── */}
            {showCreate && (
                <div className="cu-modal-overlay" onClick={() => setShowCreate(false)}>
                    <div className="cu-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="cu-modal-header">
                            <h2>
                                <Building2 size={18} />
                                New Customer
                            </h2>
                            <button className="cu-modal-close" onClick={() => setShowCreate(false)}>
                                <X size={16} />
                            </button>
                        </div>
                        <form onSubmit={handleCreate} className="cu-form">
                            <div className="cu-form-group">
                                <label>Customer Name *</label>
                                <input
                                    type="text"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    placeholder="e.g., EID, GDEL, Acme Corp"
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className="cu-form-group">
                                <label>Industry</label>
                                <input
                                    type="text"
                                    value={form.industry}
                                    onChange={(e) => setForm({ ...form, industry: e.target.value })}
                                    placeholder="e.g., Logistics, Finance, Healthcare"
                                />
                            </div>
                            <div className="cu-form-group">
                                <label>Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                                    placeholder="Brief description of this customer..."
                                    rows={3}
                                />
                            </div>
                            <div className="cu-form-split">
                                <div className="cu-form-group">
                                    <label>Contact Name</label>
                                    <input
                                        type="text"
                                        value={form.contactName}
                                        onChange={(e) => setForm({ ...form, contactName: e.target.value })}
                                        placeholder="Main contact"
                                    />
                                </div>
                                <div className="cu-form-group">
                                    <label>Contact Email</label>
                                    <input
                                        type="email"
                                        value={form.contactEmail}
                                        onChange={(e) => setForm({ ...form, contactEmail: e.target.value })}
                                        placeholder="email@company.com"
                                    />
                                </div>
                            </div>
                            <div className="cu-form-group">
                                <label>Website</label>
                                <input
                                    type="url"
                                    value={form.website}
                                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                                    placeholder="https://company.com"
                                />
                            </div>

                            <div className="cu-form-actions">
                                <button type="button" className="cu-btn-cancel" onClick={() => setShowCreate(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="cu-btn-save" disabled={creating || !form.name.trim()}>
                                    {creating ? (
                                        <><Loader2 size={14} className="cu-spin" /> Creating...</>
                                    ) : (
                                        <><Plus size={14} /> Create Customer</>
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
