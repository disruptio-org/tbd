'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ClipboardList, Globe, Zap, KeyRound, Users, ArrowLeft, RefreshCw, Linkedin, Eye, EyeOff, Mail, UserPlus, Send, RotateCw, CheckCircle, Key, Copy, Trash2, Plus, AlertTriangle, Plug, Unplug, Loader2 } from 'lucide-react';

interface CompanyDetail {
    id: string;
    name: string;
    email: string | null;
    plan: string;
    isActive: boolean;
    createdAt: string;
    updatedAt: string;
    website: string | null;
    linkedinUrl: string | null;
    webContext: string | null;
    User: { id: string; name: string; email: string; role: string; authProvider: string; createdAt: string; mustChangePassword?: boolean; isProvisionedByAdmin?: boolean; inviteSentAt?: string | null; firstLoginAt?: string | null; passwordChangedAt?: string | null }[];
    CompanyFeature: { id: string; featureKey: string; enabled: boolean; updatedAt: string }[];
    License: { id: string; plan: string; startsAt: string; expiresAt: string | null; isActive: boolean } | null;
}

interface Feature { key: string; label: string; enabled: boolean; updatedAt: string | null; }

const I = { size: 14, strokeWidth: 2 } as const;
const TABS = [
    { id: 'details', label: 'Detalhes', icon: <ClipboardList {...I} /> },
    { id: 'web-context', label: 'Contexto Web', icon: <Globe {...I} /> },
    { id: 'features', label: 'Features', icon: <Zap {...I} /> },
    { id: 'license', label: 'Licença', icon: <KeyRound {...I} /> },
    { id: 'users', label: 'Utilizadores', icon: <Users {...I} /> },
    { id: 'api-keys', label: 'API Keys', icon: <Key {...I} /> },
    { id: 'integrations', label: 'Integrations', icon: <Plug {...I} /> },
];

export default function CompanyDetailPage() {
    const { id } = useParams<{ id: string }>();
    const router = useRouter();
    const [tab, setTab] = useState('details');
    const [company, setCompany] = useState<CompanyDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [scraping, setScraping] = useState(false);
    const [scrapeMsg, setScrapeMsg] = useState('');
    const [showFullContext, setShowFullContext] = useState(false);

    // Details form
    const [detailsForm, setDetailsForm] = useState({
        name: '', email: '', plan: 'starter', isActive: true,
        website: '', linkedinUrl: '',
    });

    // Features
    const [features, setFeatures] = useState<Feature[]>([]);

    // License
    const [licenseForm, setLicenseForm] = useState({ plan: 'starter', expiresAt: '', isActive: true });

    // Users
    const [users, setUsers] = useState<CompanyDetail['User']>([]);
    const [showInvite, setShowInvite] = useState(false);
    const [inviteForm, setInviteForm] = useState({ email: '', password: '', name: '', role: 'MEMBER' });
    const [showPassword, setShowPassword] = useState(false);
    const [inviting, setInviting] = useState(false);
    const [inviteMsg, setInviteMsg] = useState('');
    const [sendingInvite, setSendingInvite] = useState<string | null>(null);

    // API Keys
    interface ApiKeyItem { id: string; label: string; keyPrefix: string; scopes: string[]; isActive: boolean; lastUsedAt: string | null; createdAt: string; }
    const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
    const [showNewKey, setShowNewKey] = useState(false);
    const [newKeyLabel, setNewKeyLabel] = useState('');
    const [generatedFullKey, setGeneratedFullKey] = useState<string | null>(null);
    const [generatingKey, setGeneratingKey] = useState(false);
    const [keyCopied, setKeyCopied] = useState(false);

    // Integrations
    interface IntegrationItem { id: string; provider: string; label: string; isActive: boolean; lastSyncedAt: string | null; actionCount: number; config: Record<string, unknown>; createdAt: string; }
    const [integrations, setIntegrations] = useState<IntegrationItem[]>([]);
    const [showConnectZapier, setShowConnectZapier] = useState(false);
    const [zapierUrl, setZapierUrl] = useState('');
    const [connecting, setConnecting] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [syncResult, setSyncResult] = useState<string | null>(null);

    useEffect(() => {
        loadCompany();
    }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => {
        if (tab === 'api-keys') loadApiKeys();
        if (tab === 'integrations') loadIntegrations();
    }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps

    async function loadCompany() {
        try {
            const res = await fetch(`/api/backoffice/companies/${id}`);
            if (!res.ok) { router.replace('/backoffice'); return; }
            const data = await res.json();
            setCompany(data);
            setDetailsForm({
                name: data.name ?? '',
                email: data.email ?? '',
                plan: data.plan ?? 'starter',
                isActive: data.isActive ?? true,
                website: data.website ?? '',
                linkedinUrl: data.linkedinUrl ?? '',
            });
            setUsers(data.User ?? []);

            // Load features
            const featRes = await fetch(`/api/backoffice/companies/${id}/features`);
            if (featRes.ok) setFeatures(await featRes.json());

            // Load license
            const licRes = await fetch(`/api/backoffice/companies/${id}/license`);
            if (licRes.ok) {
                const lic = await licRes.json();
                setLicenseForm({
                    plan: lic.plan ?? 'starter',
                    expiresAt: lic.expiresAt ? lic.expiresAt.split('T')[0] : '',
                    isActive: lic.isActive ?? true,
                });
            }
        } catch {
            router.replace('/backoffice');
        }
        setLoading(false);
    }

    async function loadApiKeys() {
        try {
            const res = await fetch(`/api/backoffice/companies/${id}/api-keys`);
            if (res.ok) { const d = await res.json(); setApiKeys(d.keys || []); }
        } catch { /* ignore */ }
    }

    async function loadIntegrations() {
        try {
            const res = await fetch(`/api/backoffice/companies/${id}/integrations`);
            if (res.ok) { const d = await res.json(); setIntegrations(d.integrations || []); }
        } catch { /* ignore */ }
    }

    async function saveDetails(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            await fetch(`/api/backoffice/companies/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(detailsForm),
            });
            await loadCompany();
        } catch (err) { console.error(err); }
        setSaving(false);
    }

    async function saveFeatures() {
        setSaving(true);
        try {
            await fetch(`/api/backoffice/companies/${id}/features`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    features: features.map((f) => ({ featureKey: f.key, enabled: f.enabled })),
                }),
            });
        } catch (err) { console.error(err); }
        setSaving(false);
    }

    async function saveLicense(e: React.FormEvent) {
        e.preventDefault();
        setSaving(true);
        try {
            await fetch(`/api/backoffice/companies/${id}/license`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    plan: licenseForm.plan,
                    expiresAt: licenseForm.expiresAt || null,
                    isActive: licenseForm.isActive,
                }),
            });
            if (licenseForm.plan !== detailsForm.plan) {
                setDetailsForm((f) => ({ ...f, plan: licenseForm.plan }));
            }
        } catch (err) { console.error(err); }
        setSaving(false);
    }

    async function handleScrape() {
        setScraping(true);
        setScrapeMsg('');
        try {
            const res = await fetch(`/api/backoffice/companies/${id}/scrape-web`, { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setScrapeMsg(`✅ Contexto extraído com sucesso (${data.contextLength} caracteres)`);
                await loadCompany();
            } else {
                setScrapeMsg(`⚠️ ${data.error || 'Erro ao extrair contexto'}`);
            }
        } catch {
            setScrapeMsg('⚠️ Erro de rede ao extrair contexto');
        }
        setScraping(false);
    }

    async function updateUserRole(userId: string, role: string) {
        try {
            const res = await fetch(`/api/backoffice/companies/${id}/users`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId, role }),
            });
            if (res.ok) {
                const updated = await res.json();
                setUsers((prev) => prev.map((u) => (u.id === updated.id ? updated : u)));
            }
        } catch (err) { console.error(err); }
    }

    if (loading) {
        return (
            <div className="flex justify-center" style={{ padding: 'var(--space-xxl)' }}>
                <div className="spinner" />
            </div>
        );
    }

    if (!company) return null;

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-lg">
                <div className="flex items-center gap-md">
                    <button className="btn btn-ghost" onClick={() => router.push('/backoffice')}>
                        <ArrowLeft size={14} strokeWidth={2} /> Voltar
                    </button>
                    <div>
                        <h2>{company.name}</h2>
                        <p className="text-secondary mt-xs">{company.email || 'Sem email'}</p>
                    </div>
                </div>
                <span className={`bo-status ${company.isActive ? 'bo-status-active' : 'bo-status-inactive'}`}>
                    <span className="bo-status-dot" />
                    {company.isActive ? 'Ativo' : 'Inativo'}
                </span>
            </div>

            {/* Tabs */}
            <div className="bo-tabs">
                {TABS.map((t) => (
                    <button
                        key={t.id}
                        className={`bo-tab ${tab === t.id ? 'active' : ''}`}
                        onClick={() => setTab(t.id)}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                    >
                        {t.icon} {t.label}
                    </button>
                ))}
            </div>

            {/* ─── Tab: Detalhes ─── */}
            {tab === 'details' && (
                <div className="card card-elevated" style={{ padding: 'var(--space-lg)', maxWidth: 600 }}>
                    <form onSubmit={saveDetails}>
                        <div className="form-group">
                            <label className="label" htmlFor="det-name">Nome da Empresa</label>
                            <input
                                id="det-name"
                                className="input"
                                value={detailsForm.name}
                                onChange={(e) => setDetailsForm((f) => ({ ...f, name: e.target.value }))}
                                required
                            />
                        </div>
                        <div className="form-group">
                            <label className="label" htmlFor="det-email">Email de Contacto</label>
                            <input
                                id="det-email"
                                className="input"
                                type="email"
                                value={detailsForm.email}
                                onChange={(e) => setDetailsForm((f) => ({ ...f, email: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label className="label" htmlFor="det-plan">Plano</label>
                            <select
                                id="det-plan"
                                className="select"
                                value={detailsForm.plan}
                                onChange={(e) => setDetailsForm((f) => ({ ...f, plan: e.target.value }))}
                            >
                                <option value="starter">Starter</option>
                                <option value="pro">Pro</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="label" htmlFor="det-website">Website</label>
                            <input
                                id="det-website"
                                className="input"
                                type="url"
                                placeholder="https://empresa.pt"
                                value={detailsForm.website}
                                onChange={(e) => setDetailsForm((f) => ({ ...f, website: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label className="label" htmlFor="det-linkedin">LinkedIn</label>
                            <input
                                id="det-linkedin"
                                className="input"
                                type="url"
                                placeholder="https://linkedin.com/company/empresa"
                                value={detailsForm.linkedinUrl}
                                onChange={(e) => setDetailsForm((f) => ({ ...f, linkedinUrl: e.target.value }))}
                            />
                        </div>
                        <div className="form-group">
                            <label className="label">Estado</label>
                            <label className="bo-toggle">
                                <input
                                    type="checkbox"
                                    checked={detailsForm.isActive}
                                    onChange={(e) => setDetailsForm((f) => ({ ...f, isActive: e.target.checked }))}
                                />
                                <span className="bo-toggle-slider" />
                            </label>
                            <span className="text-secondary" style={{ marginLeft: 'var(--space-sm)', fontSize: 'var(--font-size-small)' }}>
                                {detailsForm.isActive ? 'Ativo' : 'Inativo'}
                            </span>
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={saving}>
                            {saving ? 'A guardar…' : 'Guardar Alterações'}
                        </button>
                    </form>
                </div>
            )}

            {/* ─── Tab: Contexto Web ─── */}
            {tab === 'web-context' && (
                <div className="card card-elevated" style={{ padding: 'var(--space-lg)', maxWidth: 700 }}>
                    <div style={{ marginBottom: 20 }}>
                        <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Contexto Web da Empresa</h3>
                        <p className="text-secondary" style={{ fontSize: 13 }}>
                            Este contexto é extraído automaticamente do website e LinkedIn da empresa
                            e é usado pelo assistente de IA para responder com conhecimento sobre a empresa desde o primeiro dia.
                        </p>
                    </div>

                    {/* URL status */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                            <Globe size={14} strokeWidth={2} style={{ opacity: 0.5 }} />
                            {company.website
                                ? <a href={company.website} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-red)' }}>{company.website}</a>
                                : <span className="text-muted">Website não configurado</span>}
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
                            <Linkedin size={14} strokeWidth={2} style={{ opacity: 0.5 }} />
                            {company.linkedinUrl
                                ? <a href={company.linkedinUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--color-accent-red)' }}>{company.linkedinUrl}</a>
                                : <span className="text-muted">LinkedIn não configurado</span>}
                        </div>
                    </div>

                    {/* Re-scrape button */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20 }}>
                        <button
                            className="btn btn-primary"
                            onClick={handleScrape}
                            disabled={scraping || (!company.website && !company.linkedinUrl)}
                        >
                            {scraping ? (
                                <><span className="spinner" style={{ width: 14, height: 14, display: 'inline-block', marginRight: 8 }} />A extrair...</>
                            ) : (
                                <><RefreshCw size={14} strokeWidth={2} /> Re-extrair Contexto</>
                            )}
                        </button>
                        {!company.website && !company.linkedinUrl && (
                            <span className="text-muted" style={{ fontSize: 12 }}>
                                Adicione um website ou LinkedIn no separador Detalhes primeiro.
                            </span>
                        )}
                        {scrapeMsg && (
                            <span style={{ fontSize: 13, color: scrapeMsg.startsWith('✅') ? 'var(--color-state-success)' : 'var(--color-state-error)' }}>
                                {scrapeMsg}
                            </span>
                        )}
                    </div>

                    {/* Context preview */}
                    {company.webContext ? (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                                <span className="section-label">CONTEXTO EXTRAÍDO</span>
                                <span className="text-muted" style={{ fontSize: 12 }}>{company.webContext.length} caracteres</span>
                            </div>
                            <div style={{
                                background: 'var(--color-bg-surface)',
                                border: '1px solid var(--color-stroke-subtle)',
                                borderRadius: 8,
                                padding: '14px 16px',
                                fontSize: 13,
                                lineHeight: 1.6,
                                whiteSpace: 'pre-wrap',
                                fontFamily: 'inherit',
                                color: 'var(--color-text-secondary)',
                            }}>
                                {showFullContext
                                    ? company.webContext
                                    : company.webContext.slice(0, 600) + (company.webContext.length > 600 ? '…' : '')}
                            </div>
                            {company.webContext.length > 600 && (
                                <button
                                    className="btn btn-ghost btn-sm mt-sm"
                                    onClick={() => setShowFullContext(!showFullContext)}
                                >
                                    {showFullContext ? 'Ver menos ↑' : 'Ver tudo ↓'}
                                </button>
                            )}
                        </div>
                    ) : (
                        <div className="empty-state" style={{ padding: 'var(--space-xl)' }}>
                            <div className="empty-state-icon"><Globe size={40} strokeWidth={1.5} /></div>
                            <h3>Sem contexto web</h3>
                            <p className="text-secondary mt-xs">
                                Adicione um website ou LinkedIn e clique em <strong>Re-extrair Contexto</strong> para gerar automaticamente o perfil da empresa.
                            </p>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Tab: Features ─── */}
            {tab === 'features' && (
                <div>
                    <div className="flex justify-between items-center mb-md">
                        <p className="text-secondary">Ative ou desative as funcionalidades disponíveis para esta empresa.</p>
                        <button className="btn btn-primary" onClick={saveFeatures} disabled={saving}>
                            {saving ? 'A guardar…' : 'Guardar Features'}
                        </button>
                    </div>
                    <div className="bo-feature-grid">
                        {features.map((f) => (
                            <div key={f.key} className="bo-feature-item">
                                <div>
                                    <div className="bo-feature-label">{f.label}</div>
                                    <div className="bo-feature-key">{f.key}</div>
                                </div>
                                <label className="bo-toggle">
                                    <input
                                        type="checkbox"
                                        checked={f.enabled}
                                        onChange={(e) =>
                                            setFeatures((prev) =>
                                                prev.map((ff) =>
                                                    ff.key === f.key ? { ...ff, enabled: e.target.checked } : ff
                                                )
                                            )
                                        }
                                    />
                                    <span className="bo-toggle-slider" />
                                </label>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* ─── Tab: Licença ─── */}
            {tab === 'license' && (
                <div className="card card-elevated" style={{ padding: 'var(--space-lg)', maxWidth: 600 }}>
                    <form onSubmit={saveLicense}>
                        <div className="form-group">
                            <label className="label" htmlFor="lic-plan">Plano de Subscrição</label>
                            <select
                                id="lic-plan"
                                className="select"
                                value={licenseForm.plan}
                                onChange={(e) => setLicenseForm((f) => ({ ...f, plan: e.target.value }))}
                            >
                                <option value="starter">Starter</option>
                                <option value="pro">Pro</option>
                                <option value="enterprise">Enterprise</option>
                            </select>
                        </div>
                        <div className="form-group">
                            <label className="label" htmlFor="lic-expires">Data de Expiração</label>
                            <input
                                id="lic-expires"
                                className="input"
                                type="date"
                                value={licenseForm.expiresAt}
                                onChange={(e) => setLicenseForm((f) => ({ ...f, expiresAt: e.target.value }))}
                            />
                            <p className="text-muted" style={{ fontSize: 'var(--font-size-caption)', marginTop: 4 }}>
                                Deixe em branco para licença sem expiração.
                            </p>
                        </div>
                        <div className="form-group">
                            <label className="label">Licença Ativa</label>
                            <label className="bo-toggle">
                                <input
                                    type="checkbox"
                                    checked={licenseForm.isActive}
                                    onChange={(e) => setLicenseForm((f) => ({ ...f, isActive: e.target.checked }))}
                                />
                                <span className="bo-toggle-slider" />
                            </label>
                            <span className="text-secondary" style={{ marginLeft: 'var(--space-sm)', fontSize: 'var(--font-size-small)' }}>
                                {licenseForm.isActive ? 'Ativa' : 'Suspensa'}
                            </span>
                        </div>
                        <button className="btn btn-primary" type="submit" disabled={saving}>
                            {saving ? 'A guardar…' : 'Guardar Licença'}
                        </button>
                    </form>
                </div>
            )}

            {/* ─── Tab: Utilizadores ─── */}
            {tab === 'users' && (
                <div>
                    <div className="flex justify-between items-center mb-md">
                        <p className="text-secondary">
                            {users.length} utilizador{users.length !== 1 ? 'es' : ''} nesta empresa
                        </p>
                        <button className="btn btn-primary" onClick={() => { setShowInvite(true); setInviteMsg(''); }}>
                            + Convidar Utilizador
                        </button>
                    </div>

                    {users.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon"><Users size={40} strokeWidth={1.5} /></div>
                            <h3>Sem utilizadores</h3>
                            <p className="text-secondary mt-xs">
                                Convide o primeiro utilizador para esta empresa.
                            </p>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Nome</th>
                                        <th>Email</th>
                                        <th>Autenticação</th>
                                        <th>Papel</th>
                                        <th>Estado</th>
                                        <th>Registado</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((u) => {
                                        const getOnboardingBadge = () => {
                                            if (!u.isProvisionedByAdmin) return <span className="badge badge-neutral">Self-signup</span>;
                                            if (u.mustChangePassword) return <span className="badge" style={{ background: '#fef3c7', color: '#92400e' }}><KeyRound size={12} strokeWidth={2} /> Pending Password</span>;
                                            if (u.passwordChangedAt && !u.firstLoginAt) return <span className="badge" style={{ background: '#ede9fe', color: '#6366f1' }}><RotateCw size={12} strokeWidth={2} /> In Setup</span>;
                                            if (u.firstLoginAt) return <span className="badge" style={{ background: '#d1fae5', color: '#065f46' }}><CheckCircle size={12} strokeWidth={2} /> Ativo</span>;
                                            return <span className="badge" style={{ background: '#fee2e2', color: '#991b1b' }}><Mail size={12} strokeWidth={2} /> Invited</span>;
                                        };
                                        return (
                                        <tr key={u.id}>
                                            <td style={{ fontWeight: 600 }}>{u.name}</td>
                                            <td className="text-secondary">{u.email}</td>
                                            <td>
                                                <span className="badge badge-neutral">
                                                    {u.authProvider === 'GOOGLE' ? <><Globe size={12} strokeWidth={2} /> Google</> : <><Mail size={12} strokeWidth={2} /> Email</>}
                                                </span>
                                            </td>
                                            <td>
                                                <select
                                                    className="select"
                                                    style={{ width: 'auto', minWidth: 110 }}
                                                    value={u.role}
                                                    onChange={(e) => updateUserRole(u.id, e.target.value)}
                                                >
                                                    <option value="MEMBER">Member</option>
                                                    <option value="ADMIN">Admin</option>
                                                </select>
                                            </td>
                                            <td>{getOnboardingBadge()}</td>
                                            <td className="text-muted">
                                                {new Date(u.createdAt).toLocaleDateString('pt-PT')}
                                            </td>
                                            <td>
                                                {u.isProvisionedByAdmin && u.mustChangePassword && (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        disabled={sendingInvite === u.id}
                                                        onClick={async () => {
                                                            setSendingInvite(u.id);
                                                            try {
                                                                const res = await fetch(`/api/backoffice/companies/${id}/send-invite`, {
                                                                    method: 'POST',
                                                                    headers: { 'Content-Type': 'application/json' },
                                                                    body: JSON.stringify({ userId: u.id }),
                                                                });
                                                                if (res.ok) {
                                                                    const usersRes = await fetch(`/api/backoffice/companies/${id}/users`);
                                                                    if (usersRes.ok) setUsers(await usersRes.json());
                                                                }
                                                            } catch { /* ignore */ }
                                                            setSendingInvite(null);
                                                        }}
                                                    >
                                                        {sendingInvite === u.id ? <RefreshCw size={12} className="animate-spin" /> : (u.inviteSentAt ? <><RotateCw size={12} /> Reenviar</> : <><Send size={12} /> Enviar Convite</>)}
                                                    </button>
                                                )}
                                                {u.inviteSentAt && (
                                                    <span className="text-muted" style={{ fontSize: 11, display: 'block', marginTop: 2 }}>
                                                        Enviado: {new Date(u.inviteSentAt).toLocaleDateString('pt-PT')}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Invite Modal */}
                    {showInvite && (
                        <div className="overlay" onClick={() => setShowInvite(false)}>
                            <div className="modal" onClick={(e) => e.stopPropagation()}>
                                <div className="modal-header">
                                    <h3>Adicionar Utilizador</h3>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setShowInvite(false)}>✕</button>
                                </div>
                                <p className="text-secondary" style={{ fontSize: 13, marginBottom: 16 }}>
                                    O utilizador é criado imediatamente. Na primeira sessão, será pedido que altere a palavra-passe.
                                </p>
                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    setInviting(true);
                                    setInviteMsg('');
                                    try {
                                        const res = await fetch(`/api/backoffice/companies/${id}/users`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify(inviteForm),
                                        });
                                        const data = await res.json();
                                        if (res.ok) {
                                            setInviteMsg('✅ Utilizador criado com sucesso!');
                                            setInviteForm({ email: '', password: '', name: '', role: 'MEMBER' });
                                            // Refresh users list
                                            const usersRes = await fetch(`/api/backoffice/companies/${id}/users`);
                                            if (usersRes.ok) setUsers(await usersRes.json());
                                        } else {
                                            setInviteMsg(`⚠️ ${data.error || 'Erro ao convidar utilizador'}`);
                                        }
                                    } catch {
                                        setInviteMsg('⚠️ Erro de rede');
                                    }
                                    setInviting(false);
                                }}>
                                    <div className="form-group">
                                        <label className="label" htmlFor="inv-email">Email *</label>
                                        <input
                                            id="inv-email"
                                            className="input"
                                            type="email"
                                            placeholder="colaborador@empresa.pt"
                                            value={inviteForm.email}
                                            onChange={(e) => setInviteForm((f) => ({ ...f, email: e.target.value }))}
                                            required
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="label" htmlFor="inv-password">Palavra-passe inicial *</label>
                                        <div style={{ position: 'relative' }}>
                                            <input
                                                id="inv-password"
                                                className="input"
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder="Mínimo 6 caracteres"
                                                value={inviteForm.password}
                                                onChange={(e) => setInviteForm((f) => ({ ...f, password: e.target.value }))}
                                                minLength={6}
                                                required
                                                style={{ paddingRight: 40 }}
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setShowPassword((v) => !v)}
                                                style={{
                                                    position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                                                    background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: 'var(--color-text-muted)',
                                                }}
                                                title={showPassword ? 'Ocultar' : 'Mostrar'}
                                            >
                                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                            </button>
                                        </div>
                                        <p style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 4 }}>
                                            O utilizador ser\u00e1 pedido a alterar esta palavra-passe no primeiro login.
                                        </p>
                                    </div>
                                    <div className="form-group">
                                        <label className="label" htmlFor="inv-name">Nome (opcional)</label>
                                        <input
                                            id="inv-name"
                                            className="input"
                                            type="text"
                                            placeholder="João Silva"
                                            value={inviteForm.name}
                                            onChange={(e) => setInviteForm((f) => ({ ...f, name: e.target.value }))}
                                        />
                                    </div>
                                    <div className="form-group">
                                        <label className="label" htmlFor="inv-role">Papel</label>
                                        <select
                                            id="inv-role"
                                            className="select"
                                            value={inviteForm.role}
                                            onChange={(e) => setInviteForm((f) => ({ ...f, role: e.target.value }))}
                                        >
                                            <option value="MEMBER">Member — acesso padrão</option>
                                            <option value="ADMIN">Admin — pode gerir a empresa</option>
                                        </select>
                                    </div>
                                    {inviteMsg && (
                                        <p style={{
                                            fontSize: 13, marginBottom: 12,
                                            color: inviteMsg.startsWith('✅') ? 'var(--color-state-success)' : 'var(--color-state-error)',
                                        }}>
                                            {inviteMsg}
                                        </p>
                                    )}
                                    <div className="modal-footer">
                                        <button type="button" className="btn btn-secondary" onClick={() => setShowInvite(false)}>
                                            Fechar
                                        </button>
                                        <button type="submit" className="btn btn-primary" disabled={inviting}>
                                            {inviting ? 'A criar…' : <><UserPlus size={14} /> Criar Utilizador</>}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Tab: API Keys ─── */}
            {tab === 'api-keys' && (
                <div>
                    <div className="flex justify-between items-center mb-md">
                        <div>
                            <p className="text-secondary">Chaves de API para integração externa (CRM, website, etc.)</p>
                        </div>
                        <button className="btn btn-primary" onClick={() => { setShowNewKey(true); setGeneratedFullKey(null); setNewKeyLabel(''); setKeyCopied(false); }}>
                            <Plus size={14} strokeWidth={2} /> Gerar Nova Chave
                        </button>
                    </div>

                    {/* Key list */}
                    {apiKeys.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon"><Key size={40} strokeWidth={1.5} /></div>
                            <h3>Sem chaves de API</h3>
                            <p className="text-secondary mt-xs">Gere uma chave para permitir integrações externas.</p>
                        </div>
                    ) : (
                        <div className="table-wrapper">
                            <table>
                                <thead>
                                    <tr>
                                        <th>Label</th>
                                        <th>Key</th>
                                        <th>Scopes</th>
                                        <th>Estado</th>
                                        <th>Último uso</th>
                                        <th>Criada</th>
                                        <th>Ações</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {apiKeys.map((k) => (
                                        <tr key={k.id} style={{ opacity: k.isActive ? 1 : 0.5 }}>
                                            <td style={{ fontWeight: 600 }}>{k.label}</td>
                                            <td><code style={{ fontSize: 12, background: 'var(--color-bg-surface)', padding: '2px 8px', borderRadius: 4 }}>{k.keyPrefix}••••••••</code></td>
                                            <td><span className="badge badge-neutral" style={{ fontSize: 11 }}>{k.scopes.join(', ')}</span></td>
                                            <td>
                                                <span className={`bo-status ${k.isActive ? 'bo-status-active' : 'bo-status-inactive'}`} style={{ fontSize: 12 }}>
                                                    <span className="bo-status-dot" />
                                                    {k.isActive ? 'Ativa' : 'Revogada'}
                                                </span>
                                            </td>
                                            <td className="text-muted">{k.lastUsedAt ? new Date(k.lastUsedAt).toLocaleDateString('pt-PT') : '—'}</td>
                                            <td className="text-muted">{new Date(k.createdAt).toLocaleDateString('pt-PT')}</td>
                                            <td>
                                                {k.isActive && (
                                                    <button
                                                        className="btn btn-ghost btn-sm"
                                                        style={{ color: 'var(--color-state-error)' }}
                                                        onClick={async () => {
                                                            if (!confirm('Revogar esta chave? Integrações que a usem deixarão de funcionar.')) return;
                                                            await fetch(`/api/backoffice/companies/${id}/api-keys?keyId=${k.id}`, { method: 'DELETE' });
                                                            loadApiKeys();
                                                        }}
                                                    >
                                                        <Trash2 size={12} strokeWidth={2} /> Revogar
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Generate key modal */}
                    {showNewKey && (
                        <div className="overlay" onClick={() => { if (!generatedFullKey) setShowNewKey(false); }}>
                            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
                                <div className="modal-header">
                                    <h3>{generatedFullKey ? 'Chave Gerada' : 'Gerar Nova Chave de API'}</h3>
                                    {!generatedFullKey && <button className="btn btn-ghost btn-sm" onClick={() => setShowNewKey(false)}>✕</button>}
                                </div>

                                {!generatedFullKey ? (
                                    <form onSubmit={async (e) => {
                                        e.preventDefault();
                                        setGeneratingKey(true);
                                        try {
                                            const res = await fetch(`/api/backoffice/companies/${id}/api-keys`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ label: newKeyLabel, scopes: ['crm:leads:write'] }),
                                            });
                                            const data = await res.json();
                                            if (res.ok) {
                                                setGeneratedFullKey(data.key.fullKey);
                                                loadApiKeys();
                                            }
                                        } catch { /* ignore */ }
                                        setGeneratingKey(false);
                                    }}>
                                        <div className="form-group">
                                            <label className="label" htmlFor="key-label">Nome / Label</label>
                                            <input
                                                id="key-label"
                                                className="input"
                                                placeholder="Ex: MOBY Website Contact Form"
                                                value={newKeyLabel}
                                                onChange={e => setNewKeyLabel(e.target.value)}
                                                required
                                            />
                                        </div>
                                        <div className="form-group">
                                            <label className="label">Scopes</label>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                <span className="badge badge-neutral">crm:leads:write</span>
                                            </div>
                                            <p className="text-muted" style={{ fontSize: 11, marginTop: 4 }}>Mais scopes serão adicionados no futuro.</p>
                                        </div>
                                        <div className="modal-footer">
                                            <button type="button" className="btn btn-secondary" onClick={() => setShowNewKey(false)}>Cancelar</button>
                                            <button type="submit" className="btn btn-primary" disabled={generatingKey}>
                                                {generatingKey ? 'A gerar…' : <><Key size={14} /> Gerar Chave</>}
                                            </button>
                                        </div>
                                    </form>
                                ) : (
                                    <div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '10px 14px', background: '#fef3c7', borderRadius: 8, border: '1px solid #fcd34d' }}>
                                            <AlertTriangle size={16} strokeWidth={2} style={{ color: '#92400e', flexShrink: 0 }} />
                                            <span style={{ fontSize: 13, color: '#92400e', fontWeight: 500 }}>Copie esta chave agora. Ela não será mostrada novamente.</span>
                                        </div>
                                        <div style={{ position: 'relative', marginBottom: 16 }}>
                                            <code style={{
                                                display: 'block', padding: '14px 16px', background: 'var(--color-bg-surface)',
                                                border: '1px solid var(--color-stroke-subtle)', borderRadius: 8,
                                                fontSize: 13, wordBreak: 'break-all', lineHeight: 1.5,
                                                fontFamily: 'monospace', color: 'var(--color-text-primary)',
                                            }}>
                                                {generatedFullKey}
                                            </code>
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                style={{ position: 'absolute', top: 8, right: 8 }}
                                                onClick={() => {
                                                    navigator.clipboard.writeText(generatedFullKey);
                                                    setKeyCopied(true);
                                                    setTimeout(() => setKeyCopied(false), 2000);
                                                }}
                                            >
                                                {keyCopied ? <><CheckCircle size={14} style={{ color: 'var(--color-state-success)' }} /> Copiada!</> : <><Copy size={14} /> Copiar</>}
                                            </button>
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', marginBottom: 16 }}>
                                            <strong>Exemplo de utilização:</strong>
                                            <pre style={{ background: 'var(--color-bg-surface)', padding: 12, borderRadius: 8, fontSize: 12, marginTop: 8, overflow: 'auto', border: '1px solid var(--color-stroke-subtle)' }}>{`curl -X POST ${typeof window !== 'undefined' ? window.location.origin : 'https://nousio.com'}/api/public/crm/leads \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${generatedFullKey}" \
  -d '{ "leadName": "João Silva", "email": "joao@empresa.pt" }'`}</pre>
                                        </div>
                                        <div className="modal-footer">
                                            <button className="btn btn-primary" onClick={() => { setShowNewKey(false); setGeneratedFullKey(null); }}>Fechar</button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* ─── Tab: Integrations ─── */}
            {tab === 'integrations' && (
                <div>
                    <div className="flex justify-between items-center mb-md">
                        <div>
                            <p className="text-secondary">Integrações externas via MCP (Zapier, etc.)</p>
                        </div>
                        {!integrations.some(i => i.provider === 'ZAPIER_MCP') && (
                            <button className="btn btn-primary" onClick={() => { setShowConnectZapier(true); setZapierUrl(''); setSyncResult(null); }}>
                                <Plug size={14} strokeWidth={2} /> Conectar Zapier
                            </button>
                        )}
                    </div>

                    {/* Connected integrations */}
                    {integrations.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-state-icon"><Plug size={40} strokeWidth={1.5} /></div>
                            <h3>Sem integrações</h3>
                            <p className="text-secondary mt-xs">Conecte o Zapier MCP para importar skills externas.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            {integrations.map(integ => {
                                const config = typeof integ.config === 'string' ? JSON.parse(integ.config) : integ.config;
                                return (
                                    <div key={integ.id} className="settings-card" style={{ padding: 24 }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                                                    <Zap size={20} strokeWidth={2} style={{ color: '#ff6d00' }} />
                                                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{integ.label}</h3>
                                                    <span className={`bo-status ${integ.isActive ? 'bo-status-active' : 'bo-status-inactive'}`} style={{ fontSize: 11, marginLeft: 8 }}>
                                                        <span className="bo-status-dot" />
                                                        {integ.isActive ? 'Conectado' : 'Inativo'}
                                                    </span>
                                                </div>

                                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '6px 16px', fontSize: 13, color: 'var(--color-text-secondary)' }}>
                                                    <span style={{ fontWeight: 600 }}>Endpoint:</span>
                                                    <code style={{ fontSize: 11, background: 'var(--color-bg-surface)', padding: '2px 6px', borderRadius: 2, wordBreak: 'break-all' }}>
                                                        {config?.mcpEndpointUrl ? `${String(config.mcpEndpointUrl).substring(0, 50)}...` : '—'}
                                                    </code>
                                                    <span style={{ fontWeight: 600 }}>Ações disponíveis:</span>
                                                    <span>{integ.actionCount}</span>
                                                    <span style={{ fontWeight: 600 }}>Último sync:</span>
                                                    <span>{integ.lastSyncedAt ? new Date(integ.lastSyncedAt).toLocaleString('pt-PT') : 'Nunca'}</span>
                                                </div>
                                            </div>

                                            <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    disabled={syncing}
                                                    onClick={async () => {
                                                        setSyncing(true); setSyncResult(null);
                                                        try {
                                                            const res = await fetch(`/api/backoffice/companies/${id}/integrations/sync`, {
                                                                method: 'POST',
                                                                headers: { 'Content-Type': 'application/json' },
                                                                body: JSON.stringify({ integrationId: integ.id }),
                                                            });
                                                            const data = await res.json();
                                                            setSyncResult(res.ok ? data.message : (data.error || 'Sync falhou'));
                                                            if (res.ok) loadIntegrations();
                                                        } catch { setSyncResult('Erro de rede'); }
                                                        setSyncing(false);
                                                    }}
                                                >
                                                    {syncing ? <><Loader2 size={12} className="spin" /> A sincronizar...</> : <><RefreshCw size={12} strokeWidth={2} /> Sync Actions</>}
                                                </button>
                                                <button
                                                    className="btn btn-ghost btn-sm"
                                                    style={{ color: 'var(--color-state-error)' }}
                                                    onClick={async () => {
                                                        if (!confirm('Desconectar Zapier? Todos os skills importados serão removidos.')) return;
                                                        await fetch(`/api/backoffice/companies/${id}/integrations?integrationId=${integ.id}`, { method: 'DELETE' });
                                                        loadIntegrations();
                                                    }}
                                                >
                                                    <Unplug size={12} strokeWidth={2} /> Desconectar
                                                </button>
                                            </div>
                                        </div>

                                        {syncResult && (
                                            <div style={{ marginTop: 12, padding: '8px 12px', background: 'var(--color-bg-surface)', border: '1px solid var(--color-stroke-subtle)', borderRadius: 4, fontSize: 13 }}>
                                                {syncResult}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Connect Zapier modal */}
                    {showConnectZapier && (
                        <div className="overlay" onClick={() => setShowConnectZapier(false)}>
                            <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 540 }}>
                                <div className="modal-header">
                                    <h3><Zap size={18} style={{ color: '#ff6d00', verticalAlign: 'middle', marginRight: 8 }} />Conectar Zapier MCP</h3>
                                    <button className="btn btn-ghost btn-sm" onClick={() => setShowConnectZapier(false)}>✕</button>
                                </div>

                                <form onSubmit={async (e) => {
                                    e.preventDefault();
                                    setConnecting(true);
                                    try {
                                        const res = await fetch(`/api/backoffice/companies/${id}/integrations`, {
                                            method: 'POST',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                                provider: 'ZAPIER_MCP',
                                                label: 'Zapier',
                                                config: { mcpEndpointUrl: zapierUrl },
                                            }),
                                        });
                                        if (res.ok) {
                                            setShowConnectZapier(false);
                                            loadIntegrations();
                                        }
                                    } catch { /* ignore */ }
                                    setConnecting(false);
                                }}>
                                    <div style={{ marginBottom: 16, fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>
                                        <p style={{ marginBottom: 12 }}><strong>Como funciona:</strong></p>
                                        <ol style={{ paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            <li>Aceda a <strong>zapier.com/mcp</strong> e copie o URL do MCP Server</li>
                                            <li>Cole o URL abaixo — o Nousio irá descobrir as ações disponíveis</li>
                                            <li>Use <strong>Sync Actions</strong> para importar as ações como Skills</li>
                                        </ol>
                                    </div>

                                    <div className="form-group">
                                        <label className="label" htmlFor="zapier-url">MCP Endpoint URL</label>
                                        <input
                                            id="zapier-url"
                                            className="input"
                                            placeholder="https://actions.zapier.com/mcp/sk-..."
                                            value={zapierUrl}
                                            onChange={e => setZapierUrl(e.target.value)}
                                            required
                                            style={{ fontFamily: 'monospace', fontSize: 13 }}
                                        />
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', background: '#fef3c7', border: '1px solid #fcd34d', marginBottom: 16, fontSize: 12, color: '#92400e' }}>
                                        <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                                        Este URL contém credenciais Zapier. Será armazenado encriptado no Nousio.
                                    </div>

                                    <div className="modal-footer">
                                        <button type="button" className="btn btn-secondary" onClick={() => setShowConnectZapier(false)}>Cancelar</button>
                                        <button type="submit" className="btn btn-primary" disabled={connecting || !zapierUrl.trim()}>
                                            {connecting ? 'A conectar…' : <><Plug size={14} /> Conectar & Descobrir</>}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
