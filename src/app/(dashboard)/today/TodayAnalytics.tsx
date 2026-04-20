'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    CheckCircle2, FileText, MessageCircle, AlertTriangle,
    TrendingUp, TrendingDown, Minus, Brain, Loader,
    Activity, FolderOpen, BarChart3, Zap,
} from 'lucide-react';
import './today-analytics.css';

/* ─── Types ─────────────────────────────────────────── */

interface KPIValue {
    value: number;
    previousValue?: number;
    trend?: 'up' | 'down' | 'flat';
    score?: number;
    avgTurnaroundHours?: number;
}

interface AgentUtil {
    name: string;
    actions: number;
    percentage: number;
}

interface ProjectHealth {
    name: string;
    tasksTotal: number;
    tasksCompleted: number;
    progress: number;
}

interface DailyPoint {
    date: string;
    actions: number;
    tasks: number;
    content: number;
}

interface AnalyticsData {
    period: string;
    kpis: {
        tasksCompleted: KPIValue;
        contentGenerated: KPIValue;
        aiConversations: KPIValue;
        pendingApprovals: KPIValue;
        knowledgeCoverage: KPIValue;
        blockedItems: KPIValue;
    };
    agentUtilization: AgentUtil[];
    projectHealth: ProjectHealth[];
    dailyActivity: DailyPoint[];
}

/* ─── Helpers ───────────────────────────────────────── */

const TREND_ICON = {
    up: <TrendingUp size={12} />,
    down: <TrendingDown size={12} />,
    flat: <Minus size={12} />,
};

function trendLabel(kpi: KPIValue): string {
    if (kpi.previousValue === undefined) return '';
    const diff = kpi.value - kpi.previousValue;
    if (diff === 0) return 'No change';
    const pct = kpi.previousValue > 0 ? Math.round(Math.abs(diff / kpi.previousValue) * 100) : 0;
    return `${diff > 0 ? '+' : ''}${diff} (${pct}%)`;
}

/* ─── Component ─────────────────────────────────────── */

export default function TodayAnalytics() {
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [period, setPeriod] = useState('30d');

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/today/analytics?period=${period}`);
            if (res.ok) setData(await res.json());
        } catch (e) { console.error('[TodayAnalytics] fetch error:', e); }
        setLoading(false);
    }, [period]);

    useEffect(() => { fetchData(); }, [fetchData]);

    if (loading) {
        return <div className="ta-container"><div className="ta-loading"><Loader size={20} className="spin" /></div></div>;
    }

    if (!data) {
        return <div className="ta-container"><div className="ta-loading">Failed to load analytics.</div></div>;
    }

    const { kpis, agentUtilization, projectHealth, dailyActivity } = data;
    const maxDailyActions = Math.max(...dailyActivity.map(d => d.actions + d.tasks + d.content), 1);

    return (
        <div className="ta-container">
            {/* ── Period Selector ── */}
            <div className="ta-header">
                <span className="ta-header-title">Performance Overview</span>
                <div className="ta-period-pills">
                    {['7d', '30d', '90d'].map(p => (
                        <button
                            key={p}
                            className={`ta-period-pill ${period === p ? 'active' : ''}`}
                            onClick={() => setPeriod(p)}
                        >
                            {p === '7d' ? '7 Days' : p === '30d' ? '30 Days' : '90 Days'}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── KPI Cards ── */}
            <div className="ta-kpi-grid">
                <KPICard
                    label="Tasks Completed"
                    icon={<CheckCircle2 size={12} />}
                    kpi={kpis.tasksCompleted}
                />
                <KPICard
                    label="Content Generated"
                    icon={<FileText size={12} />}
                    kpi={kpis.contentGenerated}
                />
                <KPICard
                    label="AI Conversations"
                    icon={<MessageCircle size={12} />}
                    kpi={kpis.aiConversations}
                />
                <KPICard
                    label="Pending Approvals"
                    icon={<AlertTriangle size={12} />}
                    kpi={kpis.pendingApprovals}
                    invertTrend
                />
                <KPICard
                    label="Knowledge Coverage"
                    icon={<Brain size={12} />}
                    kpi={kpis.knowledgeCoverage}
                    isPercentage
                />
                <KPICard
                    label="Blocked Items"
                    icon={<AlertTriangle size={12} />}
                    kpi={kpis.blockedItems}
                    invertTrend
                />
            </div>

            {/* ── Daily Activity Chart ── */}
            {dailyActivity.length > 0 && (
                <div className="ta-section">
                    <div className="ta-section-header">
                        <span className="ta-section-title"><Activity size={14} /> Daily Activity</span>
                    </div>
                    <div className="ta-chart">
                        {dailyActivity.map(day => {
                            const total = day.actions + day.tasks + day.content;
                            const maxH = 80;
                            const scale = maxDailyActions > 0 ? maxH / maxDailyActions : 0;
                            return (
                                <div key={day.date} className="ta-chart-bar-group" title={`${day.date}: ${total} events`}>
                                    <div
                                        className="ta-chart-bar actions"
                                        style={{ height: Math.max(day.actions * scale, day.actions > 0 ? 2 : 0) + 'px' }}
                                    />
                                    <div
                                        className="ta-chart-bar tasks"
                                        style={{ height: Math.max(day.tasks * scale, day.tasks > 0 ? 2 : 0) + 'px' }}
                                    />
                                    <div
                                        className="ta-chart-bar content"
                                        style={{ height: Math.max(day.content * scale, day.content > 0 ? 2 : 0) + 'px' }}
                                    />
                                </div>
                            );
                        })}
                    </div>
                    <div className="ta-chart-legend">
                        <span className="ta-chart-legend-item"><span className="ta-chart-legend-dot" style={{ background: '#818cf8' }} /> AI Actions</span>
                        <span className="ta-chart-legend-item"><span className="ta-chart-legend-dot" style={{ background: '#22c55e' }} /> Tasks</span>
                        <span className="ta-chart-legend-item"><span className="ta-chart-legend-dot" style={{ background: '#22d3ee' }} /> Content</span>
                    </div>
                </div>
            )}

            {/* ── Two Column: Agent Utilization + Project Health ── */}
            <div className="ta-two-col">
                {/* Agent Utilization */}
                <div className="ta-section">
                    <div className="ta-section-header">
                        <span className="ta-section-title"><Zap size={14} /> Agent Utilization</span>
                    </div>
                    {agentUtilization.length > 0 ? (
                        <div className="ta-agent-list">
                            {agentUtilization.map(agent => (
                                <div key={agent.name} className="ta-agent-row">
                                    <span className="ta-agent-name">{agent.name}</span>
                                    <div className="ta-agent-bar-bg">
                                        <div
                                            className="ta-agent-bar-fill"
                                            style={{ width: `${agent.percentage}%` }}
                                        />
                                    </div>
                                    <span className="ta-agent-count">{agent.actions}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: '#52525b', fontSize: 13 }}>No agent activity yet.</p>
                    )}
                </div>

                {/* Project Health */}
                <div className="ta-section">
                    <div className="ta-section-header">
                        <span className="ta-section-title"><FolderOpen size={14} /> Project Health</span>
                    </div>
                    {projectHealth.length > 0 ? (
                        <div className="ta-project-list">
                            {projectHealth.map(project => (
                                <div key={project.name} className="ta-project-row">
                                    <div className="ta-project-header">
                                        <span className="ta-project-name">{project.name}</span>
                                        <span className="ta-project-stats">
                                            {project.tasksCompleted}/{project.tasksTotal} tasks · {project.progress}%
                                        </span>
                                    </div>
                                    <div className="ta-progress-bar-bg">
                                        <div
                                            className="ta-progress-bar-fill"
                                            style={{ width: `${project.progress}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p style={{ color: '#52525b', fontSize: 13 }}>No active projects.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

/* ─── KPI Card Sub-component ────────────────────────── */

function KPICard({
    label, icon, kpi, invertTrend, isPercentage,
}: {
    label: string;
    icon: React.ReactNode;
    kpi: KPIValue;
    invertTrend?: boolean;
    isPercentage?: boolean;
}) {
    const displayValue = isPercentage
        ? `${Math.round((kpi.score || 0) * 100)}%`
        : String(kpi.value);

    let trendClass = kpi.trend || 'flat';
    // For "bad" metrics (blocked, pending), "up" is bad
    if (invertTrend && trendClass === 'up') trendClass = 'down';
    else if (invertTrend && trendClass === 'down') trendClass = 'up';

    return (
        <div className="ta-kpi-card">
            <span className="ta-kpi-label">{icon} {label}</span>
            <span className="ta-kpi-value">{displayValue}</span>
            {kpi.trend && kpi.previousValue !== undefined && (
                <span className={`ta-kpi-trend ${trendClass}`}>
                    {TREND_ICON[kpi.trend]} {trendLabel(kpi)}
                    <span className="trend-prev">vs prev {label.toLowerCase().includes('conversation') ? 'period' : 'period'}</span>
                </span>
            )}
        </div>
    );
}
