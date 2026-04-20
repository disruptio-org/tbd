'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
    Zap, CheckCircle2, FileText, LayoutGrid, AlertTriangle,
    ExternalLink, Clock, Activity, Loader,
} from 'lucide-react';
import './today-updates.css';

/* ─── Types ─────────────────────────────────────────── */

interface UpdateEvent {
    id: string;
    type: 'ai_action' | 'initiative_event' | 'task_completed' | 'content_created' | 'artifact_created';
    title: string;
    description?: string;
    agentName?: string;
    projectName?: string;
    status: 'success' | 'failed' | 'blocked' | 'partial' | 'info';
    timestamp: string;
    actionUrl?: string;
}

interface UpdatesData {
    events: UpdateEvent[];
    summary: {
        total: number;
        byType: Record<string, number>;
        range: string;
    };
}

type FilterType = 'all' | 'ai_action' | 'initiative' | 'task' | 'content' | 'artifact';

const FILTER_CONFIG: { key: FilterType; label: string; icon: React.ReactNode; dotColor: string }[] = [
    { key: 'all', label: 'All', icon: <Activity size={12} />, dotColor: '#fafafa' },
    { key: 'ai_action', label: 'AI Actions', icon: <Zap size={12} />, dotColor: '#818cf8' },
    { key: 'initiative', label: 'Initiatives', icon: <AlertTriangle size={12} />, dotColor: '#fbbf24' },
    { key: 'task', label: 'Tasks', icon: <CheckCircle2 size={12} />, dotColor: '#4ade80' },
    { key: 'content', label: 'Content', icon: <FileText size={12} />, dotColor: '#22d3ee' },
    { key: 'artifact', label: 'Artifacts', icon: <LayoutGrid size={12} />, dotColor: '#c084fc' },
];

const TYPE_LABELS: Record<string, string> = {
    ai_action: 'AI',
    initiative_event: 'Initiative',
    task_completed: 'Task',
    content_created: 'Content',
    artifact_created: 'Artifact',
};

/* ─── Helpers ───────────────────────────────────────── */

function formatTimestamp(ts: string): string {
    const d = new Date(ts);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
        d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
}

function getDateLabel(ts: string): string {
    const d = new Date(ts);
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const yesterday = new Date(today.getTime() - 86400000);
    const eventDay = new Date(d.getFullYear(), d.getMonth(), d.getDate());

    if (eventDay.getTime() === today.getTime()) return 'Today';
    if (eventDay.getTime() === yesterday.getTime()) return 'Yesterday';
    return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/* ─── Component ─────────────────────────────────────── */

export default function TodayUpdates() {
    const [data, setData] = useState<UpdatesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<FilterType>('all');
    const [range, setRange] = useState('7d');
    const router = useRouter();

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/today/updates?range=${range}&type=${filter}`);
            if (res.ok) {
                const d = await res.json();
                setData(d);
            }
        } catch (e) {
            console.error('[TodayUpdates] fetch error:', e);
        }
        setLoading(false);
    }, [range, filter]);

    useEffect(() => { fetchData(); }, [fetchData]);

    // Group events by date
    const groupedEvents: Array<{ label: string; events: UpdateEvent[] }> = [];
    if (data?.events) {
        let currentLabel = '';
        for (const event of data.events) {
            const label = getDateLabel(event.timestamp);
            if (label !== currentLabel) {
                groupedEvents.push({ label, events: [] });
                currentLabel = label;
            }
            groupedEvents[groupedEvents.length - 1].events.push(event);
        }
    }

    return (
        <div className="tu-container">
            {/* ── Summary Bar ── */}
            {data && (
                <div className="tu-summary">
                    <div className="tu-summary-left">
                        <div>
                            <div className="tu-summary-count">{data.summary.total}</div>
                            <div className="tu-summary-label">
                                Events · {range === '24h' ? 'Last 24 hours' : range === '30d' ? 'Last 30 days' : 'Last 7 days'}
                            </div>
                        </div>
                    </div>
                    <div className="tu-summary-badges">
                        {Object.entries(data.summary.byType).filter(([, v]) => v > 0).map(([type, count]) => (
                            <span key={type} className="tu-summary-chip">
                                <span className="chip-dot" style={{
                                    background: type === 'ai_action' ? '#818cf8'
                                        : type === 'initiative_event' ? '#fbbf24'
                                        : type === 'task_completed' ? '#4ade80'
                                        : type === 'content_created' ? '#22d3ee'
                                        : '#c084fc'
                                }} />
                                {count} {TYPE_LABELS[type] || type}
                            </span>
                        ))}
                    </div>
                </div>
            )}

            {/* ── Filter Bar ── */}
            <div className="tu-filters">
                <div className="tu-filter-pills">
                    {FILTER_CONFIG.map(f => (
                        <button
                            key={f.key}
                            className={`tu-pill ${filter === f.key ? 'active' : ''}`}
                            onClick={() => setFilter(f.key)}
                        >
                            {f.icon} {f.label}
                        </button>
                    ))}
                </div>
                <select
                    className="tu-range-select"
                    value={range}
                    onChange={e => setRange(e.target.value)}
                >
                    <option value="24h">Last 24 hours</option>
                    <option value="7d">Last 7 days</option>
                    <option value="30d">Last 30 days</option>
                </select>
            </div>

            {/* ── Loading ── */}
            {loading && (
                <div className="tu-loading">
                    <Loader size={20} className="spin" />
                </div>
            )}

            {/* ── Empty State ── */}
            {!loading && (!data || data.events.length === 0) && (
                <div className="tu-empty">
                    <div className="tu-empty-icon">📡</div>
                    <p>No activity found in this time range.</p>
                    <p style={{ fontSize: 12, marginTop: 4 }}>Try expanding the range or interact with your AI team to generate events.</p>
                </div>
            )}

            {/* ── Timeline Feed ── */}
            {!loading && groupedEvents.length > 0 && (
                <div className="tu-timeline">
                    {groupedEvents.map((group) => (
                        <div key={group.label}>
                            <div className="tu-date-divider">
                                <span>{group.label}</span>
                            </div>
                            {group.events.map(event => (
                                <div
                                    key={event.id}
                                    className={`tu-event ${event.actionUrl ? 'clickable' : ''}`}
                                    onClick={event.actionUrl ? () => router.push(event.actionUrl!) : undefined}
                                >
                                    <div className={`tu-event-dot ${event.status}`} />
                                    <div className="tu-event-body">
                                        <div className="tu-event-header">
                                            <span className={`tu-event-type ${event.type}`}>
                                                {TYPE_LABELS[event.type] || event.type}
                                            </span>
                                            <span className="tu-event-title">{event.title}</span>
                                            <span className="tu-event-time">
                                                <Clock size={10} /> {formatTimestamp(event.timestamp)}
                                            </span>
                                        </div>
                                        <div className="tu-event-desc">
                                            {event.description && <span>{event.description}</span>}
                                            {event.projectName && (
                                                <span className="tu-event-project">{event.projectName}</span>
                                            )}
                                            {event.agentName && !event.projectName && (
                                                <span style={{ opacity: 0.6 }}>{event.agentName}</span>
                                            )}
                                        </div>
                                        {event.actionUrl && (
                                            <span className="tu-event-link">
                                                <ExternalLink size={10} /> View Details
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
