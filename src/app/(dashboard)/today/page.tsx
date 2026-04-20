'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Plus, ChevronRight, Zap, Sparkles, AlertTriangle, CheckCircle, X } from 'lucide-react';
import DailyBriefCard from '@/components/DailyBriefCard';
import TodayUpdates from './TodayUpdates';
import TodayAnalytics from './TodayAnalytics';
import './today.css';

/* ─── Types ─────────────────────────────────────────── */

interface TodayData {
    greeting: { userName: string; timeOfDay: 'morning' | 'afternoon' | 'evening' };
    summary: { pendingApprovals: number; tasksToday: number; activeInitiatives: number; overdueItems: number };
    schedule: {
        weekDays: Array<{ date: string; dayName: string; isToday: boolean; hasEvents: boolean; eventCount: number }>;
        todayAgenda: Array<{ id: string; time?: string; title: string; type: string; projectName?: string }>;
    };
    needsAttention: Array<{
        id: string; entityId: string; type: string; title: string;
        projectName?: string; boardId?: string; dueTime?: string; priority: string; actionUrl: string;
    }>;
    teamUpdates: Array<{
        id: string; type: string; agentName: string; title: string;
        description?: string; projectName?: string; timestamp: string;
    }>;
    activeWork: Array<{
        id: string; projectName: string; customerName?: string;
        executionState: string; progress: { completed: number; total: number }; lastActivity?: string;
    }>;
    pendingActions: Array<{
        id: string; type: 'approve_task' | 'review_output' | 'review_revision' | 'validate_plan';
        title: string; initiativeTitle: string | null; projectName: string | null;
        initiativeId: string | null; assignedBrainName: string | null; updatedAt: string | null;
    }>;
}

interface AssignedTaskGroup {
    boardId: string;
    boardName: string;
    projectName: string | null;
    tasks: Array<{
        id: string;
        title: string;
        priority: string;
        dueDate: string | null;
        columnName: string;
        labels: string[];
    }>;
}

interface AssignedTask {
    id: string;
    title: string;
    priority: string;
    dueDate: string | null;
    columnName: string;
    labels: string[];
    boardId: string;
    boardName: string;
    projectName: string | null;
}

interface SkillInsight {
    scheduleId: string;
    runId: string;
    skillName: string;
    skillIcon: string | null;
    skillKey: string | null;
    outputTitle: string | null;
    outputPreview: string;
    outputText: string;
    generatedAt: string;
    isNew: boolean;
    timezone: string;
    runAtTime: string;
}

/* ─── Helpers ───────────────────────────────────────── */

const GREETING: Record<string, string> = {
    morning: 'Good morning',
    afternoon: 'Good afternoon',
    evening: 'Good evening',
};

const TASK_PRIORITY_WEIGHT: Record<string, number> = {
    urgent: 0,
    high: 1,
    medium: 2,
    low: 3,
};

function LiveClock() {
    const [time, setTime] = useState('');
    useEffect(() => {
        const tick = () => setTime(new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }));
        tick();
        const id = setInterval(tick, 30_000);
        return () => clearInterval(id);
    }, []);
    return <span className="today-hero-clock">{time}</span>;
}

/** Lightweight markdown → HTML */
function simpleMarkdown(md: string): string {
    return md
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
        .replace(/^---+$/gm, '<hr/>')
        .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
        .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
        .replace(/\n\n/g, '</p><p>')
        .replace(/\n/g, '<br/>')
        .replace(/^/, '<p>').replace(/$/, '</p>');
}

function getTaskPriorityLabel(priority: string): string {
    return (priority || 'low').toUpperCase();
}

function getTaskPriorityColor(priority: string): string {
    if (priority === 'urgent') return '#ef4444';
    if (priority === 'high') return '#f97316';
    if (priority === 'medium') return '#2563eb';
    return '#71717a';
}

function isTaskOverdue(dueDate: string | null): boolean {
    return Boolean(dueDate && new Date(dueDate).getTime() < Date.now());
}

function formatTaskDueLabel(dueDate: string | null): string | null {
    if (!dueDate) return null;

    const due = new Date(dueDate);
    const dueDay = new Date(due);
    dueDay.setHours(0, 0, 0, 0);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);

    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays === -1) return 'Yesterday';

    return due.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

function sortAssignedTasks(tasks: AssignedTask[]): AssignedTask[] {
    return [...tasks].sort((a, b) => {
        const priorityDelta =
            (TASK_PRIORITY_WEIGHT[a.priority] ?? TASK_PRIORITY_WEIGHT.low) -
            (TASK_PRIORITY_WEIGHT[b.priority] ?? TASK_PRIORITY_WEIGHT.low);

        if (priorityDelta !== 0) {
            return priorityDelta;
        }

        if (a.dueDate && b.dueDate) {
            return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
        }

        if (a.dueDate) return -1;
        if (b.dueDate) return 1;

        return a.title.localeCompare(b.title);
    });
}

/* ─── Action type config ─────────────────────────────── */
const ACTION_CONFIG: Record<string, { label: string; color: string; bgAlpha: string }> = {
    approve_task: { label: 'Approve to Run', color: '#f59e0b', bgAlpha: 'rgba(245,158,11,0.1)' },
    review_output: { label: 'Review Output', color: '#06b6d4', bgAlpha: 'rgba(6,182,212,0.1)' },
    review_revision: { label: 'Review Revision', color: '#ef4444', bgAlpha: 'rgba(239,68,68,0.1)' },
    validate_plan: { label: 'Validate Plan', color: '#f59e0b', bgAlpha: 'rgba(245,158,11,0.1)' },
};

/* ─── Material icon via Lucide fallback ──────────────── */
const ICONS = ['🚀', '🏗️', '⚡', '💎', '🎯', '🔮'];

/* ═══════════════════════════════════════════════════════ */
export default function TodayPage() {
    const [data, setData] = useState<TodayData | null>(null);
    const [loading, setLoading] = useState(true);
    const [apiError, setApiError] = useState<string | null>(null);
    const [assignedTasks, setAssignedTasks] = useState<AssignedTask[]>([]);
    const [tasksLoading, setTasksLoading] = useState(true);
    const [skillInsights, setSkillInsights] = useState<SkillInsight[]>([]);
    const [viewingInsight, setViewingInsight] = useState<SkillInsight | null>(null);
    const [referenceTime, setReferenceTime] = useState(() => Date.now());
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeTab = searchParams.get('tab') || 'overview';

    useEffect(() => {
        if (activeTab !== 'overview') return; // Skip fetching for sub-tabs
        fetch('/api/today')
            .then(r => {
                if (!r.ok) return r.json().then(e => { setApiError(e.error || `Status ${r.status}`); return null; });
                return r.json();
            })
            .then(d => { if (d) setData(d); setLoading(false); })
            .catch(err => { setApiError(err.message); setLoading(false); });

        fetch('/api/dashboard/my-tasks')
            .then(r => r.ok ? r.json() : { groups: [] })
            .then((d) => {
                const flattenedTasks = ((d.groups || []) as AssignedTaskGroup[]).flatMap((group) =>
                    group.tasks.map((task) => ({
                        ...task,
                        boardId: group.boardId,
                        boardName: group.boardName,
                        projectName: group.projectName,
                    }))
                );

                setAssignedTasks(sortAssignedTasks(flattenedTasks));
            })
            .catch(() => setAssignedTasks([]))
            .finally(() => setTasksLoading(false));

        // Fetch skill insights separately
        fetch('/api/skills/today')
            .then(r => r.ok ? r.json() : { insights: [] })
            .then(d => setSkillInsights(d.insights || []))
            .catch(() => {});
    }, [activeTab]);

    useEffect(() => {
        if (activeTab !== 'overview') return;

        const syncReferenceTime = () => setReferenceTime(Date.now());
        syncReferenceTime();

        const intervalId = setInterval(syncReferenceTime, 60_000);
        return () => clearInterval(intervalId);
    }, [activeTab]);

    // ── Tab routing: render sub-tabs (AFTER all hooks) ──
    if (activeTab === 'updates') return <TodayUpdates />;
    if (activeTab === 'analytics') return <TodayAnalytics />;

    /* Loading */
    if (loading) {
        return <div className="today-page"><div className="today-loading"><div className="spinner" /></div></div>;
    }

    /* Error */
    if (!data?.greeting) {
        return (
            <div className="today-page" style={{ textAlign: 'center', paddingTop: 80 }}>
                <div style={{ fontSize: 40, opacity: 0.3, marginBottom: 8 }}>🌅</div>
                <p style={{ color: '#71717a' }}>Não foi possível carregar os dados de hoje.</p>
                {apiError && <pre className="today-error-box" style={{ margin: '12px auto' }}>{apiError}</pre>}
            </div>
        );
    }

    const greet = GREETING[data.greeting.timeOfDay] || 'Good morning';
    const urgentCount = data.summary.pendingApprovals + data.summary.overdueItems;
    const assignedUrgentCount = assignedTasks.filter((task) => task.priority === 'urgent' || task.priority === 'high').length;
    const assignedOverdueCount = assignedTasks.filter((task) => isTaskOverdue(task.dueDate)).length;

    /* Build fallback intelligence entries */
    const fallbackIntelCards: Array<{ text: React.ReactNode; bordered: boolean; actionUrl?: string; entityId?: string; boardId?: string }> = [];
    if (data.needsAttention.length > 0) {
        data.needsAttention.forEach((a, i) => {
            fallbackIntelCards.push({
                text: <>{a.type === 'approval' ? 'Pending approval: ' : ''}<strong>{a.title}</strong>. {a.projectName || ''}</>,
                bordered: i === 0,
                actionUrl: a.actionUrl,
                entityId: a.entityId,
                boardId: a.boardId,
            });
        });
    } else if (data.teamUpdates.length > 0) {
        data.teamUpdates.slice(0, 4).forEach((u, i) => {
            fallbackIntelCards.push({
                text: u.projectName
                    ? <>Analyzing <strong>{u.projectName}</strong> feedback. {u.title}</>
                    : <>{u.title}</>,
                bordered: i === 0,
            });
        });
    } else {
        fallbackIntelCards.push(
            { text: <>All systems nominal. <strong>No blockers</strong> detected across active projects.</>, bordered: true },
            { text: <>Knowledge base up to date. <strong>{data.summary.activeInitiatives} initiatives</strong> tracked.</>, bordered: false },
        );
    }

    return (
        <div className="today-page">
            {/* Grain overlay */}
            <div className="today-grain" />

            {/* ─── Dashboard Canvas ────────────────────── */}
            <div className="today-bento">

                    {/* ── Hero Morning Greeting ────────── */}
                    <div className="today-hero">
                        <LiveClock />
                        <img
                            className="today-hero-art"
                            src="https://lh3.googleusercontent.com/aida-public/AB6AXuDTST5tZxl7wScKSLapbKineN8lE0tvXO45AB12MWbEm6Pj8ghM_w-QbVkhyk9d3T7dGNjYnJ7DbCipDB8GW0MSPTEUocyBMknLPj4ZWALz0dILO3hO9KwmvR2uqCD64fXzE5CYdC4aMZvMDUswPD0-OQGNdj5KlcdjPKWgNLvu7F2V730_-ADLAOZSIHkWxVFs-IsN-GavNg2DbNDWf6TyU1k6aGXbmMVgZGaUQZVES85AHmjKHG78IX9e3JtwgdcMGBRVmtUzEa4"
                            alt=""
                        />
                        <div className="today-hero-inner">
                            <div className="today-hero-status">
                                <span className="today-hero-dot" />
                                <span className="today-hero-status-text">
                                    Status: {data.summary.activeInitiatives > 0 ? 'Active Thinking' : 'Standing By'}
                                </span>
                            </div>
                            <h2 className="today-hero-headline">
                                {greet}, {data.greeting.userName}.
                                <br />
                                {urgentCount > 0 ? (
                                    <>You have <span className="today-hero-highlight">{urgentCount} high-priority</span> targets today.</>
                                ) : (
                                    <>All clear — no urgent items today.</>
                                )}
                            </h2>
                            <Link href="/today/brief" className="today-hero-cta">
                                Review Daily Brief
                            </Link>
                        </div>
                    </div>

                    {/* ── AI Reasoning Terminal ─────────── */}
                    <div className="today-intel">
                        <div className="today-intel-header">
                            <div>
                                <h3 className="today-intel-title">Nousio Intelligence</h3>
                                <p className="today-intel-subtitle">
                                    {assignedTasks.length > 0
                                        ? 'Your assigned queue, ranked by priority first and due date second.'
                                        : tasksLoading
                                            ? 'Refreshing the tasks assigned to you...'
                                            : 'Live signals from your projects and team activity.'}
                                </p>
                            </div>
                            <div className="today-intel-header-meta">
                                {assignedTasks.length > 0 && (
                                    <span className="today-intel-count">{assignedTasks.length}</span>
                                )}
                                <Zap size={14} className="today-intel-bolt" />
                            </div>
                        </div>
                        <div className="today-intel-feed">
                            {tasksLoading ? (
                                <div className="today-intel-empty">Loading your assigned tasks...</div>
                            ) : assignedTasks.length > 0 ? (
                                assignedTasks.map((task) => {
                                    const dueLabel = formatTaskDueLabel(task.dueDate);
                                    const overdue = isTaskOverdue(task.dueDate);
                                    const destinationLabel = task.projectName
                                        ? `${task.projectName} / ${task.boardName}`
                                        : task.boardName;

                                    return (
                                        <Link
                                            key={task.id}
                                            href={`/tasks?boardId=${task.boardId}&taskId=${task.id}`}
                                            className={`today-intel-task ${overdue ? 'is-overdue' : ''}`}
                                            style={{ borderLeftColor: getTaskPriorityColor(task.priority) }}
                                        >
                                            <div className="today-intel-task-body">
                                                <div className="today-intel-task-topline">
                                                    <span className={`today-intel-task-priority priority-${task.priority || 'low'}`}>
                                                        {getTaskPriorityLabel(task.priority)}
                                                    </span>
                                                    {dueLabel && (
                                                        <span className={`today-intel-task-due ${overdue ? 'is-overdue' : ''}`}>
                                                            {overdue ? `Overdue · ${dueLabel}` : dueLabel}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="today-intel-task-title">{task.title}</div>
                                                <div className="today-intel-task-meta">
                                                    <span>{destinationLabel}</span>
                                                    {task.columnName && (
                                                        <span className="today-intel-task-status">{task.columnName}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronRight size={16} className="today-intel-task-chevron" />
                                        </Link>
                                    );
                                })
                            ) : (
                                fallbackIntelCards.map((card, i) => (
                                    <div
                                        key={i}
                                        className={`today-intel-card ${card.bordered ? 'has-border' : ''} ${card.actionUrl ? 'clickable' : ''}`}
                                        onClick={card.actionUrl ? () => router.push(`${card.actionUrl}${card.boardId ? `?boardId=${card.boardId}` : ''}${card.entityId ? `${card.boardId ? '&' : '?'}taskId=${card.entityId}` : ''}`) : undefined}
                                        role={card.actionUrl ? 'button' : undefined}
                                        tabIndex={card.actionUrl ? 0 : undefined}
                                        onKeyDown={card.actionUrl ? (e) => { if (e.key === 'Enter') router.push(`${card.actionUrl}${card.boardId ? `?boardId=${card.boardId}` : ''}${card.entityId ? `${card.boardId ? '&' : '?'}taskId=${card.entityId}` : ''}`); } : undefined}
                                    >
                                        <p>{card.text}</p>
                                        {card.actionUrl && <span className="today-intel-arrow">→</span>}
                                    </div>
                                ))
                            )}
                        </div>
                        {assignedTasks.length > 0 ? (
                            <div className="today-intel-prompt today-intel-prompt-tasks">
                                <span>{assignedUrgentCount} urgent or high</span>
                                <span className="today-intel-prompt-divider" />
                                <span>{assignedOverdueCount} overdue</span>
                                <Link href="/tasks" className="today-intel-viewall">
                                    Open task board
                                </Link>
                            </div>
                        ) : (
                            <div className="today-intel-prompt">
                                <Sparkles size={12} />
                                <span>Press <kbd>⌘</kbd> + <kbd>K</kbd> to prompt</span>
                            </div>
                        )}
                    </div>

                    {/* ── Daily Brief ──────────────────── */}
                    <div id="daily-brief-section" style={{ gridColumn: 'span 12' }}>
                        <DailyBriefCard />
                    </div>

                    {/* ── AI Skill Insights ─────────────────── */}
                    <div className="today-insights">
                        <div className="today-insights-head">
                            <h3 className="today-insights-title">
                                <Zap size={16} /> AI Insights
                            </h3>
                            {skillInsights.length > 0 && (
                                <Link href="/skills" className="today-insights-viewall">View all</Link>
                            )}
                        </div>
                        {skillInsights.length > 0 ? (
                                <div className="today-insights-list">
                                {skillInsights.map(insight => {
                                    const ago = Math.round((referenceTime - new Date(insight.generatedAt).getTime()) / 60_000);
                                    const freshness = ago < 60 ? `${ago}m ago` : ago < 1440 ? `${Math.round(ago / 60)}h ago` : `${Math.round(ago / 1440)}d ago`;
                                    return (
                                        <div
                                            key={insight.runId}
                                            className="today-insight-row"
                                            onClick={() => setViewingInsight(insight)}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={e => { if (e.key === 'Enter') setViewingInsight(insight); }}
                                        >
                                            <div className="today-insight-icon">
                                                <Zap size={18} />
                                            </div>
                                            <div className="today-insight-body">
                                                <div className="today-insight-name">
                                                    {insight.skillName}
                                                    {insight.isNew && <span className="today-insight-badge">NEW</span>}
                                                </div>
                                                <div className="today-insight-preview">{insight.outputPreview}</div>
                                                <div className="today-insight-time">
                                                    <span className="today-insight-freshness">{freshness}</span>
                                                    <span>Generated at {new Date(insight.generatedAt).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className="today-insight-chevron" />
                                        </div>
                                    );
                                })}
                            </div>
                        ) : (
                            <div className="today-insights-empty">
                                <Sparkles size={18} />
                                <p>No scheduled insights yet. <Link href="/skills" style={{ color: '#D2F000' }}>Schedule a skill</Link> to see AI-generated reports here.</p>
                            </div>
                        )}
                    </div>

                    {/* ── Projects / Task Landscape ─────── */}
                    <div className="today-projects">
                        <div className="today-projects-head">
                            <h3 className="today-projects-title">Projects</h3>
                            <Link href="/projects" className="today-projects-viewall">View all</Link>
                        </div>
                        <div className="today-projects-list">
                            {data.activeWork.length > 0 ? (
                                data.activeWork.slice(0, 4).map((w, i) => {
                                    const pct = w.progress.total > 0 ? Math.round((w.progress.completed / w.progress.total) * 100) : 0;
                                    const stalled = w.executionState === 'BLOCKED' || w.executionState === 'WAITING_ON_HUMAN';
                                    const lastActivityTime = w.lastActivity ? new Date(w.lastActivity).getTime() : referenceTime;
                                    const dueInDays = Math.max(1, Math.ceil((lastActivityTime - referenceTime) / -86400000));
                                    return (
                                        <Link key={w.id} href="/projects" className="today-project-row">
                                            <div className="today-project-left">
                                                <div className="today-project-icon">{ICONS[i % ICONS.length]}</div>
                                                <div>
                                                    <div className="today-project-name">{w.projectName}</div>
                                                    <div className="today-project-meta">
                                                        {stalled
                                                            ? `Stalled • Waiting for ${data.greeting.userName}`
                                                            : `Due in ${dueInDays} days • ${pct}% complete`
                                                        }
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="today-project-right">
                                                {stalled && <div className="today-project-dot" />}
                                                {!stalled && <ChevronRight size={18} className="today-project-chevron" />}
                                            </div>
                                        </Link>
                                    );
                                })
                            ) : (
                                <div className="today-empty-msg">
                                    No active projects yet. <Link href="/projects" style={{ color: '#D2F000' }}>Create one</Link>.
                                </div>
                            )}
                        </div>
                    </div>

                    {/* ── Pending Your Action ──────────── */}
                    <div className="today-actions">
                        <div className="today-actions-head">
                            <h3 className="today-actions-title">Pending Your Action</h3>
                            {data.pendingActions.length > 0 && (
                                <span className="today-actions-count">
                                    <AlertTriangle size={12} />
                                    {data.pendingActions.length} {data.pendingActions.length === 1 ? 'action' : 'actions'} pending
                                </span>
                            )}
                        </div>
                        <div className="today-actions-list">
                            {data.pendingActions.length > 0 ? (
                                data.pendingActions.slice(0, 5).map((action) => {
                                    const cfg = ACTION_CONFIG[action.type] || ACTION_CONFIG.approve_task;
                                    return (
                                        <div
                                            key={action.id}
                                            className="today-action-row"
                                            style={{ borderLeftColor: cfg.color }}
                                            onClick={() => {
                                                if (action.initiativeId) {
                                                    router.push(`/boardroom/${action.initiativeId}`);
                                                }
                                            }}
                                            role="button"
                                            tabIndex={0}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter' && action.initiativeId) {
                                                    router.push(`/boardroom/${action.initiativeId}`);
                                                }
                                            }}
                                        >
                                            <div className="today-action-body">
                                                <span
                                                    className="today-action-badge"
                                                    style={{ color: cfg.color, background: cfg.bgAlpha }}
                                                >
                                                    {cfg.label}
                                                </span>
                                                <div className="today-action-title">{action.title}</div>
                                                <div className="today-action-meta">
                                                    {action.initiativeTitle && (
                                                        <span>{action.initiativeTitle}</span>
                                                    )}
                                                    {action.projectName && (
                                                        <span> · {action.projectName}</span>
                                                    )}
                                                    {action.assignedBrainName && (
                                                        <span className="today-action-agent">{action.assignedBrainName}</span>
                                                    )}
                                                </div>
                                            </div>
                                            <ChevronRight size={18} className="today-action-chevron" />
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="today-actions-empty">
                                    <CheckCircle size={20} />
                                    <span>All clear — no actions pending</span>
                                </div>
                            )}
                        </div>
                        {data.pendingActions.length > 0 && (
                            <Link href="/boardroom" className="today-actions-viewall">
                                View Boardroom →
                            </Link>
                        )}
                    </div>

                </div>

            {/* ─── FAB ─────────────────────────────────── */}
            <button className="today-fab">
                <Plus size={24} className="today-fab-icon" />
                <div className="today-fab-tooltip">New Thread</div>
            </button>

            {/* ─── Insight Viewer Modal ─────────────────── */}
            {viewingInsight && (
                <div className="newsletter-overlay" onClick={() => setViewingInsight(null)}>
                    <div className="newsletter-modal" onClick={e => e.stopPropagation()}>
                        <div className="newsletter-header">
                            <div className="newsletter-header-left">
                                <span className="newsletter-badge">AI GENERATED</span>
                                <span className="newsletter-date">
                                    {new Date(viewingInsight.generatedAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                </span>
                            </div>
                            <button className="skill-modal-close" onClick={() => setViewingInsight(null)}><X size={18} /></button>
                        </div>
                        {viewingInsight.outputTitle && (
                            <h1 className="newsletter-title">{viewingInsight.outputTitle}</h1>
                        )}
                        <div className="newsletter-divider" />
                        <div
                            className="newsletter-content"
                            dangerouslySetInnerHTML={{ __html: simpleMarkdown(viewingInsight.outputText || '') }}
                        />
                        <div className="newsletter-footer">
                            <span>Generated by Nousio AI — {viewingInsight.skillName}</span>
                            <span>⏱ Scheduled Run</span>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
