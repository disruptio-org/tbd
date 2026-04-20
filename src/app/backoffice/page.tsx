'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useUIFeedback } from '@/components/UIFeedback';
import { t, DEFAULT_LOCALE, SUPPORTED_LOCALES, getLanguageName } from '@/i18n';
import { Building2, Globe, Eye, Trash2, ExternalLink } from 'lucide-react';
import { TableShell, TableToolbar, StatusBadge, RowActionMenu, TableEmptyState, TableLoadingState } from '@/components/table';
import '@/components/table/table.css';

interface CompanyRow {
    id: string;
    name: string;
    email: string | null;
    plan: string;
    isActive: boolean;
    createdAt: string;
    userCount: number;
    featureCount: number;
    license: { plan: string; expiresAt: string | null; isActive: boolean } | null;
}

export default function BackofficePage() {
    const [companies, setCompanies] = useState<CompanyRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [planFilter, setPlanFilter] = useState('');
    const [showCreate, setShowCreate] = useState(false);
    const [createForm, setCreateForm] = useState({ name: '', email: '', plan: 'starter', website: '', linkedinUrl: '', language: 'en' });
    const [creating, setCreating] = useState(false);
    const [scraping, setScraping] = useState(false);
    const { showConfirm } = useUIFeedback();
    const lang = DEFAULT_LOCALE;

    function loadCompanies() {
        const params = new URLSearchParams();
        if (search) params.set('search', search);
        if (planFilter) params.set('plan', planFilter);

        fetch(`/api/backoffice/companies?${params.toString()}`)
            .then((r) => r.json())
            .then((data) => setCompanies(Array.isArray(data) ? data : []))
            .catch(console.error)
            .finally(() => setLoading(false));
    }

    useEffect(() => {
        loadCompanies();
    }, [planFilter]); // eslint-disable-line react-hooks/exhaustive-deps

    function handleSearch(e: React.FormEvent) {
        e.preventDefault();
        setLoading(true);
        loadCompanies();
    }

    async function handleCreate(e: React.FormEvent) {
        e.preventDefault();
        if (!createForm.name || !createForm.email) return;
        setCreating(true);

        try {
            const res = await fetch('/api/backoffice/companies', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(createForm),
            });
            if (res.ok) {
                const created = await res.json();
                setShowCreate(false);
                setCreateForm({ name: '', email: '', plan: 'starter', website: '', linkedinUrl: '', language: 'en' });
                setLoading(true);
                loadCompanies();

                const hasUrls = createForm.website.trim() || createForm.linkedinUrl.trim();
                if (hasUrls && created?.id) {
                    setScraping(true);
                    fetch(`/api/backoffice/companies/${created.id}/scrape-web`, { method: 'POST' })
                        .then(() => setScraping(false))
                        .catch(() => setScraping(false));
                }
            }
        } catch (err) {
            console.error('Create failed:', err);
        }
        setCreating(false);
    }

    async function handleDelete(id: string, name: string) {
        showConfirm(t(lang, 'backoffice.deleteConfirm', { name }), async () => {
            try {
                await fetch(`/api/backoffice/companies/${id}`, { method: 'DELETE' });
                setCompanies((prev) => prev.filter((c) => c.id !== id));
            } catch (err) {
                console.error('Delete failed:', err);
            }
        });
    }

    function getPlanVariant(plan: string): 'info' | 'warning' | 'success' | 'neutral' {
        if (plan === 'pro') return 'info';
        if (plan === 'enterprise') return 'warning';
        return 'neutral';
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-lg">
                <div>
                    <h2>{t(lang, 'backoffice.companyManagement')}</h2>
                    <p className="text-secondary mt-xs">
                        {t(lang, 'backoffice.companyManagementDesc')}
                    </p>
                </div>
                <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                    + {t(lang, 'backoffice.newCompany')}
                </button>
            </div>

            {/* Companies Table — Compact Variant */}
            <TableShell variant="compact">
                <TableToolbar
                    searchValue={search}
                    searchPlaceholder={t(lang, 'backoffice.searchPlaceholder')}
                    onSearchChange={setSearch}
                    filters={
                        <select className="nousio-toolbar-filter" style={{ padding: '6px 10px' }} value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
                            <option value="">{t(lang, 'backoffice.allPlans')}</option>
                            <option value="starter">Starter</option>
                            <option value="pro">Pro</option>
                            <option value="enterprise">Enterprise</option>
                        </select>
                    }
                    actions={
                        <button className="btn btn-secondary" onClick={(e: React.MouseEvent) => { e.preventDefault(); setLoading(true); loadCompanies(); }}>
                            {t(lang, 'common.search')}
                        </button>
                    }
                    resultCount={t(lang, 'backoffice.companiesRegistered', { count: companies.length })}
                />
                {loading ? (
                    <TableLoadingState rows={5} columns={7} />
                ) : companies.length === 0 ? (
                    <TableEmptyState
                        icon={<Building2 size={40} strokeWidth={1.5} />}
                        title={t(lang, 'backoffice.noCompanies')}
                        description={t(lang, 'backoffice.noCompaniesDesc')}
                        action={
                            <button className="btn btn-primary" onClick={() => setShowCreate(true)}>
                                + {t(lang, 'backoffice.newCompany')}
                            </button>
                        }
                    />
                ) : (
                    <table className="nousio-table nousio-table--compact">
                        <thead>
                            <tr>
                                <th style={{ width: '22%' }}>{t(lang, 'backoffice.company')}</th>
                                <th style={{ width: '18%' }}>Email</th>
                                <th style={{ width: '10%' }}>{t(lang, 'backoffice.plan')}</th>
                                <th className="align-center" style={{ width: '8%' }}>{t(lang, 'backoffice.users')}</th>
                                <th className="align-center" style={{ width: '10%' }}>Features</th>
                                <th style={{ width: '10%' }}>{t(lang, 'backoffice.status')}</th>
                                <th style={{ width: '10%' }}>{t(lang, 'backoffice.created')}</th>
                                <th className="align-right" style={{ width: '12%' }}>{t(lang, 'backoffice.actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {companies.map((c) => (
                                <tr key={c.id}>
                                    <td className="cell-primary">
                                        <Link href={`/backoffice/companies/${c.id}`} style={{ color: '#2563eb', textDecoration: 'none' }}>
                                            {c.name}
                                        </Link>
                                    </td>
                                    <td className="cell-muted">{c.email || '—'}</td>
                                    <td>
                                        <StatusBadge variant={getPlanVariant(c.plan)}>
                                            {c.plan}
                                        </StatusBadge>
                                    </td>
                                    <td className="align-center">{c.userCount}</td>
                                    <td className="align-center">{c.featureCount}/10</td>
                                    <td>
                                        <StatusBadge variant={c.isActive ? 'success' : 'error'}>
                                            {c.isActive ? t(lang, 'backoffice.active') : t(lang, 'backoffice.inactive')}
                                        </StatusBadge>
                                    </td>
                                    <td className="cell-muted">
                                        {new Date(c.createdAt).toLocaleDateString('pt-PT')}
                                    </td>
                                    <td>
                                        <RowActionMenu
                                            primaryAction={{
                                                icon: <ExternalLink size={14} strokeWidth={2} />,
                                                title: t(lang, 'backoffice.manage'),
                                                onClick: () => { window.location.href = `/backoffice/companies/${c.id}`; },
                                            }}
                                            items={[
                                                {
                                                    label: t(lang, 'common.delete'),
                                                    icon: <Trash2 size={14} />,
                                                    onClick: () => handleDelete(c.id, c.name),
                                                    danger: true,
                                                },
                                            ]}
                                        />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </TableShell>

            {/* Scraping toast */}
            {scraping && (
                <div style={{
                    position: 'fixed', bottom: 24, right: 24, background: '#0f172a', color: '#fff',
                    padding: '12px 20px', border: '2px solid #0f172a', fontSize: 13, display: 'flex', alignItems: 'center',
                    gap: 10, zIndex: 999, boxShadow: '4px 4px 0px #000',
                }}>
                    <div className="spinner" style={{ width: 16, height: 16, borderTopColor: '#2563eb' }} />
                    {t(lang, 'backoffice.enrichingProfile')}
                </div>
            )}

            {/* Create Modal */}
            {showCreate && (
                <div className="overlay" onClick={() => setShowCreate(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>{t(lang, 'backoffice.newCompany')}</h3>
                            <button className="btn btn-ghost btn-sm" onClick={() => setShowCreate(false)}>✕</button>
                        </div>
                        <form onSubmit={handleCreate}>
                            <div className="form-group">
                                <label className="label" htmlFor="create-name">{t(lang, 'backoffice.companyName')}</label>
                                <input id="create-name" className="input" type="text" placeholder="Ex: TechSolutions Ltd" value={createForm.name} onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))} required />
                            </div>
                            <div className="form-group">
                                <label className="label" htmlFor="create-email">{t(lang, 'backoffice.contactEmail')}</label>
                                <input id="create-email" className="input" type="email" placeholder="admin@company.com" value={createForm.email} onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))} required />
                            </div>
                            <div className="form-group">
                                <label className="label" htmlFor="create-plan">{t(lang, 'backoffice.plan')}</label>
                                <select id="create-plan" className="select" value={createForm.plan} onChange={(e) => setCreateForm((f) => ({ ...f, plan: e.target.value }))}>
                                    <option value="starter">Starter</option>
                                    <option value="pro">Pro</option>
                                    <option value="enterprise">Enterprise</option>
                                </select>
                            </div>
                            <div className="form-group">
                                <label className="label" htmlFor="create-language"><Globe size={14} strokeWidth={2} /> {t(lang, 'backoffice.language')}</label>
                                <select id="create-language" className="select" value={createForm.language} onChange={(e) => setCreateForm((f) => ({ ...f, language: e.target.value }))}>
                                    {SUPPORTED_LOCALES.map((loc) => (
                                        <option key={loc} value={loc}>{getLanguageName(loc)}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ borderTop: '2px solid var(--color-stroke-subtle)', margin: '12px 0', paddingTop: 12 }}>
                                <p style={{ fontSize: 12, color: 'var(--color-text-muted)', marginBottom: 10 }}>
                                    <Globe size={14} strokeWidth={2} /> {t(lang, 'backoffice.optionalUrls')}
                                </p>
                                <div className="form-group">
                                    <label className="label" htmlFor="create-website">Website</label>
                                    <input id="create-website" className="input" type="url" placeholder="https://company.com" value={createForm.website} onChange={(e) => setCreateForm((f) => ({ ...f, website: e.target.value }))} />
                                </div>
                                <div className="form-group">
                                    <label className="label" htmlFor="create-linkedin">LinkedIn</label>
                                    <input id="create-linkedin" className="input" type="url" placeholder="https://linkedin.com/company/name" value={createForm.linkedinUrl} onChange={(e) => setCreateForm((f) => ({ ...f, linkedinUrl: e.target.value }))} />
                                </div>
                            </div>

                            <div className="modal-footer">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowCreate(false)}>
                                    {t(lang, 'common.cancel')}
                                </button>
                                <button type="submit" className="btn btn-primary" disabled={creating}>
                                    {creating ? t(lang, 'backoffice.creating') : t(lang, 'backoffice.createCompany')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
