'use client';

import { useEffect, useState } from 'react';
import { Building2, Users, KeyRound, Zap, AlertTriangle } from 'lucide-react';

interface AnalyticsData {
    overview: {
        totalCompanies: number;
        totalUsers: number;
        activeLicenses: number;
        enabledFeatures: number;
    };
    companiesByPlan: { plan: string; count: number }[];
    featureAdoption: { feature: string; adoption: number; enabledCount: number; totalCount: number }[];
    expiringLicenses: { companyName: string; plan: string; expiresAt: string }[];
    recentActivity: { event: string; module: string; user: string; company: string; time: string }[];
}

export default function BackofficeAnalyticsPage() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch('/api/backoffice/analytics')
            .then((r) => r.json())
            .then(setData)
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    function timeAgo(iso: string) {
        const diff = Date.now() - new Date(iso).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return 'agora';
        if (mins < 60) return `${mins} min atrás`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h atrás`;
        return `${Math.floor(hrs / 24)}d atrás`;
    }

    function getPlanClass(plan: string) {
        if (plan === 'pro') return 'bo-plan-pro';
        if (plan === 'enterprise') return 'bo-plan-enterprise';
        return 'bo-plan-starter';
    }

    if (loading) {
        return (
            <div className="flex justify-center" style={{ padding: 'var(--space-xxl)' }}>
                <div className="spinner" />
            </div>
        );
    }

    const overview = data?.overview ?? { totalCompanies: 0, totalUsers: 0, activeLicenses: 0, enabledFeatures: 0 };

    return (
        <div>
            <div className="mb-lg">
                <h2>Analytics da Plataforma</h2>
                <p className="text-secondary mt-xs">
                    Visão global de todas as empresas e utilização
                </p>
            </div>

            {/* Overview Stats */}
            <div className="grid grid-4 mb-lg">
                {[
                    { label: 'Total Empresas', value: overview.totalCompanies, icon: <Building2 size={28} strokeWidth={1.5} /> },
                    { label: 'Total Utilizadores', value: overview.totalUsers, icon: <Users size={28} strokeWidth={1.5} /> },
                    { label: 'Licenças Ativas', value: overview.activeLicenses, icon: <KeyRound size={28} strokeWidth={1.5} /> },
                    { label: 'Features Ativas', value: overview.enabledFeatures, icon: <Zap size={28} strokeWidth={1.5} /> },
                ].map((stat) => (
                    <div key={stat.label} className="card card-elevated" style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', justifyContent: 'center' }}>{stat.icon}</div>
                        <div style={{ fontSize: 36, fontWeight: 800, marginTop: 'var(--space-xs)' }}>
                            {stat.value}
                        </div>
                        <div className="text-secondary" style={{ fontSize: 'var(--font-size-small)' }}>
                            {stat.label}
                        </div>
                    </div>
                ))}
            </div>

            <div className="grid grid-2 mb-lg">
                {/* Companies by Plan */}
                <div className="card card-elevated" style={{ padding: 'var(--space-md)' }}>
                    <h3 className="mb-md">Empresas por Plano</h3>
                    {(data?.companiesByPlan ?? []).length === 0 ? (
                        <p className="text-muted" style={{ fontSize: 'var(--font-size-small)' }}>Sem dados disponíveis.</p>
                    ) : (
                        <div className="flex flex-col gap-sm">
                            {(data?.companiesByPlan ?? []).map((p) => (
                                <div key={p.plan} className="flex justify-between items-center">
                                    <span className={`bo-plan-badge ${getPlanClass(p.plan)}`}>{p.plan}</span>
                                    <div className="flex items-center gap-sm" style={{ flex: 1, marginLeft: 'var(--space-md)' }}>
                                        <div style={{
                                            flex: 1,
                                            height: 8,
                                            background: 'var(--color-bg-surface)',
                                            borderRadius: 4,
                                            overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                width: `${overview.totalCompanies > 0 ? (p.count / overview.totalCompanies) * 100 : 0}%`,
                                                height: '100%',
                                                background: p.plan === 'enterprise'
                                                    ? 'var(--color-accent-red)'
                                                    : p.plan === 'pro'
                                                        ? '#4285F4'
                                                        : 'var(--color-stroke-subtle)',
                                                borderRadius: 4,
                                            }} />
                                        </div>
                                        <span style={{ fontWeight: 700, minWidth: 36, textAlign: 'right' }}>
                                            {p.count}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Feature Adoption */}
                <div className="card card-elevated" style={{ padding: 'var(--space-md)' }}>
                    <h3 className="mb-md">Adoção de Features</h3>
                    {(data?.featureAdoption ?? []).length === 0 ? (
                        <p className="text-muted" style={{ fontSize: 'var(--font-size-small)' }}>Sem dados.</p>
                    ) : (
                        <div className="flex flex-col gap-sm">
                            {(data?.featureAdoption ?? []).map((f) => (
                                <div key={f.feature}>
                                    <div className="flex justify-between mb-xs">
                                        <span style={{ fontSize: 'var(--font-size-small)', fontWeight: 600 }}>
                                            {f.feature}
                                        </span>
                                        <span className="text-muted" style={{ fontSize: 'var(--font-size-caption)' }}>
                                            {f.adoption}% ({f.enabledCount}/{f.totalCount})
                                        </span>
                                    </div>
                                    <div style={{
                                        width: '100%',
                                        height: 6,
                                        background: 'var(--color-bg-surface)',
                                        borderRadius: 3,
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            width: `${f.adoption}%`,
                                            height: '100%',
                                            background: f.adoption > 70
                                                ? 'var(--color-state-success)'
                                                : f.adoption > 40
                                                    ? 'var(--color-state-warning)'
                                                    : 'var(--color-stroke-subtle)',
                                            borderRadius: 3,
                                        }} />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-2">
                {/* Expiring Licenses */}
                <div className="card card-elevated" style={{ padding: 'var(--space-md)' }}>
                    <h3 className="mb-md" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><AlertTriangle size={16} strokeWidth={2} /> Licenças a Expirar (30 dias)</h3>
                    {(data?.expiringLicenses ?? []).length === 0 ? (
                        <p className="text-muted" style={{ fontSize: 'var(--font-size-small)' }}>
                            Nenhuma licença a expirar nos próximos 30 dias.
                        </p>
                    ) : (
                        <div className="flex flex-col gap-sm">
                            {(data?.expiringLicenses ?? []).map((l, i) => (
                                <div key={i} className="flex justify-between items-center" style={{
                                    padding: 'var(--space-sm)',
                                    background: 'rgba(215, 58, 58, 0.04)',
                                    borderRadius: 'var(--radius-button)',
                                }}>
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-small)' }}>{l.companyName}</div>
                                        <span className={`bo-plan-badge ${getPlanClass(l.plan)}`} style={{ marginTop: 4 }}>{l.plan}</span>
                                    </div>
                                    <span className="text-muted" style={{ fontSize: 'var(--font-size-caption)' }}>
                                        {new Date(l.expiresAt).toLocaleDateString('pt-PT')}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Recent Activity */}
                <div className="card card-elevated" style={{ padding: 'var(--space-md)' }}>
                    <h3 className="mb-md">Atividade Recente</h3>
                    {(data?.recentActivity ?? []).length === 0 ? (
                        <p className="text-muted" style={{ fontSize: 'var(--font-size-small)' }}>
                            Sem atividade recente na plataforma.
                        </p>
                    ) : (
                        <div className="flex flex-col">
                            {(data?.recentActivity ?? []).map((a, i) => (
                                <div
                                    key={i}
                                    className="flex justify-between items-center"
                                    style={{
                                        padding: 'var(--space-sm) 0',
                                        borderBottom: i < (data?.recentActivity ?? []).length - 1
                                            ? '1px solid var(--color-stroke-subtle)'
                                            : 'none',
                                    }}
                                >
                                    <div>
                                        <div style={{ fontWeight: 600, fontSize: 'var(--font-size-small)' }}>{a.event}</div>
                                        <div className="text-muted" style={{ fontSize: 'var(--font-size-caption)' }}>
                                            {a.company} · {a.user}
                                        </div>
                                    </div>
                                    <span className="text-muted" style={{ fontSize: 'var(--font-size-caption)' }}>
                                        {timeAgo(a.time)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
