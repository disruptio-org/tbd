'use client';

import { useState, useEffect, useCallback } from 'react';
import {
    Activity, CheckCircle2, AlertTriangle, Clock,
    MessageSquare, FileText, Zap, Filter,
} from 'lucide-react';
import './team-activity.css';

/* ─── Types ────────────────────────────────────────────── */

interface ActivityEvent {
    id: string;
    type: string;
    agentId: string;
    agentName: string;
    agentColor: string;
    title: string;
    description: string;
    projectName?: string;
    sourceType: string;
    sourceId: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}

interface AgentStat {
    agentId: string;
    agentName: string;
    count: number;
    color: string;
}

interface ActivitySummary {
    total: number;
    completed: number;
    blocked: number;
    pendingApprovals: number;
    conversations: number;
    artifactsCreated: number;
    byAgent: AgentStat[];
}

/* ─── Helpers ──────────────────────────────────────────── */

function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function timeAgo(dateStr: string): string {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = Math.floor((now.getTime() - d.getTime()) / 1000);
    if (diff < 60) return 'just now';
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    return `${Math.floor(diff / 86400)}d ago`;
}

/* ─── Badge config ─────────────────────────────────────── */

const TYPE_CONFIG: Record<string, { label: string; className: string; icon: React.ReactNode }> = {
    task_completed:     { label: 'Completed',          className: 'completed',   icon: <CheckCircle2 size={10} /> },
    task_started:       { label: 'Working',            className: 'working',     icon: <Activity size={10} /> },
    task_blocked:       { label: 'Blocked',            className: 'blocked',     icon: <AlertTriangle size={10} /> },
    initiative_working: { label: 'Working',            className: 'working',     icon: <Activity size={10} /> },
    initiative_running: { label: 'Running',            className: 'running',     icon: <Zap size={10} /> },
    approval_pending:   { label: 'Needs Approval',     className: 'approval',    icon: <Clock size={10} /> },
    approval_approved:  { label: 'Approved',           className: 'completed',   icon: <CheckCircle2 size={10} /> },
    approval_rejected:  { label: 'Rejected',           className: 'blocked',     icon: <AlertTriangle size={10} /> },
    conversation:       { label: 'Conversation',       className: 'conversation',icon: <MessageSquare size={10} /> },
    artifact_created:   { label: 'Artifact Created',   className: 'artifact',    icon: <FileText size={10} /> },
};

/* ─── Filter config ────────────────────────────────────── */

const FILTERS = [
    { key: 'all',           label: 'All',            icon: <Filter size={12} /> },
    { key: 'tasks',         label: 'Tasks',          icon: <Zap size={12} /> },
    { key: 'conversations', label: 'Conversations',  icon: <MessageSquare size={12} /> },
    { key: 'approvals',     label: 'Approvals',      icon: <Clock size={12} /> },
    { key: 'artifacts',     label: 'Artifacts',      icon: <FileText size={12} /> },
];

/* ═══════════════════════════════════════════════════════ */

export default function TeamActivityFeed() {
    const [events, setEvents] = useState<ActivityEvent[]>([]);
    const [summary, setSummary] = useState<ActivitySummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');
    const [range, setRange] = useState('30d');

    const loadActivity = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/ai/team-activity?filter=${filter}&range=${range}`);
            const data = await res.json();
            setEvents(data.events || []);
            setSummary(data.summary || null);
        } catch {
            setEvents([]);
            setSummary(null);
        }
        setLoading(false);
    }, [filter, range]);

    useEffect(() => { loadActivity(); }, [loadActivity]);

    /* ─── Loading skeleton ─────────────────────────── */

    if (loading) {
        return (
            <div className="ta-container">
                <div className="ta-skeleton">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="ta-skeleton-row">
                            <div className="ta-skeleton-avatar" />
                            <div className="ta-skeleton-lines">
                                <div className="ta-skeleton-line short" />
                                <div className="ta-skeleton-line long" />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    /* ─── Max count for bar chart normalisation ─── */

    const maxCount = summary ? Math.max(...summary.byAgent.map(a => a.count), 1) : 1;

    /* ─── Render ────────────────────────────────── */

    return (
        <>
            {/* Filter bar */}
            <div className="ta-filter-bar">
                <div className="ta-filter-pills">
                    {FILTERS.map(f => (
                        <button
                            key={f.key}
                            className={`ta-filter-pill ${filter === f.key ? 'active' : ''}`}
                            onClick={() => setFilter(f.key)}
                        >
                            {f.icon} {f.label}
                        </button>
                    ))}
                </div>
                <select
                    className="ta-range-select"
                    value={range}
                    onChange={e => setRange(e.target.value)}
                >
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                    <option value="90d">Last 90 days</option>
                </select>
            </div>

            {/* Main grid: timeline + sidebar */}
            <div className="ta-container">

                {/* ── Empty state ── */}
                {events.length === 0 && !loading && (
                    <div className="ta-empty">
                        <Activity size={40} style={{ opacity: 0.12 }} />
                        <h3>No activity found</h3>
                        <p>
                            Your AI team hasn&apos;t generated any activity in this time range.
                            Assign tasks or start conversations to get things moving.
                        </p>
                    </div>
                )}

                {/* ── Timeline ── */}
                {events.length > 0 && (
                    <div className="ta-timeline">
                        {events.map(event => {
                            const config = TYPE_CONFIG[event.type] || TYPE_CONFIG.task_started;
                            const initials = getInitials(event.agentName);

                            return (
                                <div key={event.id} className="ta-entry">
                                    <div
                                        className="ta-entry-avatar"
                                        style={{ background: event.agentColor }}
                                    >
                                        {initials}
                                    </div>
                                    <div className="ta-entry-content">
                                        <div className="ta-entry-header">
                                            <span className="ta-entry-agent">{event.agentName}</span>
                                            <span className={`ta-type-badge ${config.className}`}>
                                                {config.icon} {config.label}
                                            </span>
                                            <span className="ta-entry-time">{timeAgo(event.timestamp)}</span>
                                        </div>
                                        <p className="ta-entry-title">
                                            {event.title}
                                            {event.projectName && (
                                                <span className="ta-entry-project"> · {event.projectName}</span>
                                            )}
                                        </p>

                                        {/* Artifact preview card */}
                                        {event.type === 'artifact_created' && (
                                            <div className="ta-artifact-preview">
                                                <FileText size={14} />
                                                <span>{event.title}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}

                {/* ── Summary Sidebar ── */}
                {events.length > 0 && summary && (
                    <div className="ta-summary">
                        <h3 className="ta-summary-title">Activity Summary</h3>

                        <div className="ta-summary-stats">
                            <div>
                                <div className="ta-summary-stat-value">{summary.total}</div>
                                <div className="ta-summary-stat-label">Total Events</div>
                            </div>
                            <div>
                                <div className="ta-summary-stat-value success">{summary.completed}</div>
                                <div className="ta-summary-stat-label">Completed</div>
                            </div>
                            <div>
                                <div className="ta-summary-stat-value error">{summary.blocked}</div>
                                <div className="ta-summary-stat-label">Blocked</div>
                            </div>
                            <div>
                                <div className="ta-summary-stat-value warning">{summary.pendingApprovals}</div>
                                <div className="ta-summary-stat-label">Pending Approval</div>
                            </div>
                        </div>

                        {/* Agent activity bars */}
                        {summary.byAgent.length > 0 && (
                            <div className="ta-agent-bars">
                                {summary.byAgent.map(agent => (
                                    <div key={agent.agentId} className="ta-agent-bar-row">
                                        <span className="ta-agent-bar-name">{agent.agentName}</span>
                                        <div className="ta-agent-bar-track">
                                            <div
                                                className="ta-agent-bar-fill"
                                                style={{
                                                    width: `${(agent.count / maxCount) * 100}%`,
                                                    background: agent.color,
                                                }}
                                            />
                                        </div>
                                        <span className="ta-agent-bar-count">{agent.count}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </div>
        </>
    );
}
