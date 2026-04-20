'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useT } from '@/i18n/context';
import {
    LayoutDashboard, Bot, Calendar, Megaphone, Package, DollarSign,
    GraduationCap, Building2, FileText, Search, FolderOpen,
    CheckSquare, BookOpen, ArrowRight, Image as ImageIcon,
    Clock, AlertTriangle,
} from 'lucide-react';
import '../dashboard-home.css';

/* ─── Types ───────────────────────────────────────────── */

interface TaskItem {
    id: string;
    title: string;
    priority: string;
    dueDate: string | null;
    columnName: string;
    labels: string[];
}

interface TaskGroup {
    boardId: string;
    boardName: string;
    projectName: string | null;
    tasks: TaskItem[];
}

interface ThisWeekTask {
    id: string;
    title: string;
    dueDate: string | null;
    priority: string;
    projectName: string | null;
    boardName: string;
}

interface ThisWeekSummary {
    total: number;
    completed: number;
    tasks: ThisWeekTask[];
}

interface RecentDoc {
    id: string;
    filename: string;
    mimeType: string;
    createdAt: string;
}

interface RecentConv {
    id: string;
    title: string | null;
    assistantType: string;
    createdAt: string;
}

/* ─── Helpers ─────────────────────────────────────────── */

function formatRelativeDate(iso: string): string {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
}

function getPriorityColor(p: string): string {
    switch (p) {
        case 'urgent': return '#ef4444';
        case 'high': return '#f97316';
        case 'medium': return '#2563eb';
        default: return '#94a3b8';
    }
}

function isOverdue(dueDate: string | null): boolean {
    if (!dueDate) return false;
    return new Date(dueDate) < new Date();
}

function formatDueDate(iso: string): string {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/* ─── Project accent colors ───────────────────── */
const PROJECT_COLORS = [
    '#2563eb', // blue
    '#d4af37', // gold
    '#8b5cf6', // purple
    '#0d9488', // teal
    '#e11d48', // rose
    '#ea580c', // orange
    '#059669', // emerald
    '#6366f1', // indigo
];

function getProjectColor(name: string): string {
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    return PROJECT_COLORS[Math.abs(hash) % PROJECT_COLORS.length];
}

/* ─── Assistant Config ────────────────────────────────── */

interface AssistantCard {
    href: string;
    labelKey: string;
    icon: React.ReactNode;
    featureKey: string;
}

const ASSISTANTS: AssistantCard[] = [
    { href: '/marketing', labelKey: 'nav.marketingAssistant', icon: <Megaphone size={22} strokeWidth={2} />, featureKey: 'marketing' },
    { href: '/sales', labelKey: 'nav.salesAssistant', icon: <DollarSign size={22} strokeWidth={2} />, featureKey: 'sales' },
    { href: '/product', labelKey: 'nav.productAssistant', icon: <Package size={22} strokeWidth={2} />, featureKey: 'product_assistant' },
    { href: '/company-advisor', labelKey: 'nav.companyAdvisor', icon: <Building2 size={22} strokeWidth={2} />, featureKey: 'company_advisor' },
    { href: '/onboarding-assistant', labelKey: 'nav.onboardingAssistant', icon: <GraduationCap size={22} strokeWidth={2} />, featureKey: 'onboarding_assistant' },
    { href: '/chat', labelKey: 'nav.askAi', icon: <Bot size={22} strokeWidth={2} />, featureKey: 'chat' },
];

/* ─── Component ───────────────────────────────────────── */

export default function DashboardPage() {
    const { t } = useT();
    const [taskGroups, setTaskGroups] = useState<TaskGroup[]>([]);
    const [thisWeek, setThisWeek] = useState<ThisWeekSummary>({ total: 0, completed: 0, tasks: [] });
    const [recentDocs, setRecentDocs] = useState<RecentDoc[]>([]);
    const [recentConvs, setRecentConvs] = useState<RecentConv[]>([]);
    const [features, setFeatures] = useState<string[] | null>(null);
    const [userName, setUserName] = useState('');
    const [companyName, setCompanyName] = useState('');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        Promise.all([
            fetch('/api/dashboard/my-tasks').then((r) => r.json()).catch(() => ({ groups: [], thisWeek: { total: 0, completed: 0, tasks: [] } })),
            fetch('/api/analytics').then((r) => r.json()).catch(() => ({ recent: { documents: [], conversations: [] } })),
            fetch('/api/user/features').then((r) => r.json()).catch(() => ({ features: [] })),
            fetch('/api/user/profile').then((r) => r.json()).catch(() => ({ profile: {} })),
            fetch('/api/company/profile').then((r) => r.json()).catch(() => ({})),
        ])
            .then(([tasksData, analytics, feats, profile, company]) => {
                setTaskGroups(tasksData.groups ?? []);
                setThisWeek(tasksData.thisWeek ?? { total: 0, completed: 0, tasks: [] });
                setRecentDocs(analytics.recent?.documents ?? []);
                setRecentConvs(analytics.recent?.conversations ?? []);
                setFeatures(feats.features ?? []);
                setUserName(profile.profile?.name ?? '');
                setCompanyName(company.profile?.companyName ?? '');
            })
            .catch(console.error)
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return <div className="dash-loading">{t('common.loading')}</div>;
    }

    const firstName = userName.split(' ')[0] || 'there';

    const visibleAssistants = ASSISTANTS.filter((a) => {
        if (!features) return true;
        return features.includes(a.featureKey);
    });

    // Merge recent docs + conversations into a single sorted timeline
    type ActivityItem = { type: 'doc' | 'conv'; id: string; title: string; icon: React.ReactNode; href: string; time: string };
    const recentActivity: ActivityItem[] = [
        ...recentDocs.map((d): ActivityItem => ({
            type: 'doc',
            id: d.id,
            title: d.filename,
            icon: d.mimeType?.includes('pdf') ? <BookOpen size={14} /> : d.mimeType?.includes('image') ? <ImageIcon size={14} /> : <FileText size={14} />,
            href: '/documents',
            time: d.createdAt,
        })),
        ...recentConvs.map((c): ActivityItem => ({
            type: 'conv',
            id: c.id,
            title: c.title || t('chat.newConversation'),
            icon: <Bot size={14} />,
            href: '/chat',
            time: c.createdAt,
        })),
    ]
        .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
        .slice(0, 8);

    const totalTasks = taskGroups.reduce((sum, g) => sum + g.tasks.length, 0);
    const weekProgress = thisWeek.total > 0 ? Math.round((thisWeek.completed / thisWeek.total) * 100) : 0;
    const overdueThisWeek = thisWeek.tasks.filter(t => isOverdue(t.dueDate)).length;

    return (
        <div className="dashboard-home">
            {/* ─── Header ──────────────── */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><LayoutDashboard size={20} strokeWidth={2} /></span>
                    <h1>{t('dashboard.welcomeBack', { name: firstName })}</h1>
                </div>
                <Link href="/chat" className="dash-header-cta">
                    <Bot size={16} /> {t('dashboard.askAi')}
                </Link>
            </div>

            {/* ─── Compact subtitle ────── */}
            <div className="dash-hero-compact">
                <p>
                    {companyName
                        ? t('dashboard.workspaceReady', { company: companyName })
                        : t('dashboard.workspaceReady', { company: 'Nousio' })}
                </p>
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* THIS WEEK STRIP                                     */}
            {/* ═══════════════════════════════════════════════════ */}
            {thisWeek.total > 0 && (
                <div className="dash-week-strip">
                    <div className="dash-week-strip-header">
                        <div className="dash-week-strip-title">
                            <Clock size={16} strokeWidth={2.5} />
                            <span>THIS WEEK — {thisWeek.total} {thisWeek.total === 1 ? 'TASK' : 'TASKS'} DUE</span>
                        </div>
                        <div className="dash-week-strip-stats">
                            {overdueThisWeek > 0 && (
                                <span className="dash-week-overdue">
                                    <AlertTriangle size={12} /> {overdueThisWeek} OVERDUE
                                </span>
                            )}
                            <span className="dash-week-counter">
                                {thisWeek.completed}/{thisWeek.total}
                            </span>
                        </div>
                    </div>
                    <div className="dash-week-progress-track">
                        <div
                            className="dash-week-progress-bar"
                            style={{ width: `${weekProgress}%` }}
                        />
                    </div>
                    {thisWeek.tasks.length > 0 && (
                        <div className="dash-week-tasks">
                            {thisWeek.tasks.slice(0, 4).map((task) => (
                                <div key={task.id} className="dash-week-task-chip">
                                    <span
                                        className="dash-week-task-dot"
                                        style={{ background: getPriorityColor(task.priority) }}
                                    />
                                    <span className="dash-week-task-name">{task.title}</span>
                                    {task.dueDate && (
                                        <span className={`dash-week-task-date ${isOverdue(task.dueDate) ? 'overdue' : ''}`}>
                                            {formatDueDate(task.dueDate)}
                                        </span>
                                    )}
                                </div>
                            ))}
                            {thisWeek.tasks.length > 4 && (
                                <span className="dash-week-more">+{thisWeek.tasks.length - 4} more</span>
                            )}
                        </div>
                    )}
                </div>
            )}

            {/* ═══════════════════════════════════════════════════ */}
            {/* PROJECT CARDS — Grid by Project                     */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="dash-section-card">
                <div className="dash-card-header">
                    <h3><CheckSquare size={16} strokeWidth={2} /> {t('dashboard.myOpenTasks')}</h3>
                    {totalTasks > 0 && (
                        <span className="dash-task-count">{totalTasks} {totalTasks === 1 ? 'task' : 'tasks'}</span>
                    )}
                </div>

                {taskGroups.length > 0 ? (
                    <div className="dash-project-grid">
                        {taskGroups.map((group) => {
                            const displayName = group.projectName
                                ? `${group.projectName} / ${group.boardName}`
                                : group.boardName;
                            const accentColor = getProjectColor(displayName);

                            return (
                                <div key={group.boardId} className="dash-project-card" style={{ borderLeftColor: accentColor }}>
                                    <div className="dash-project-card-header">
                                        <FolderOpen size={14} strokeWidth={2} style={{ color: accentColor }} />
                                        <span className="dash-project-card-name">{displayName}</span>
                                        <span className="dash-project-card-count">{group.tasks.length}</span>
                                    </div>
                                    <ul className="dash-project-task-list">
                                        {group.tasks.map((task) => (
                                            <li key={task.id}>
                                                <Link
                                                    href={`/tasks?boardId=${group.boardId}`}
                                                    className="dash-project-task-item"
                                                >
                                                    <div
                                                        className="dash-project-task-bar"
                                                        style={{ background: getPriorityColor(task.priority) }}
                                                    />
                                                    <span className="dash-project-task-title">{task.title}</span>
                                                    <div className="dash-project-task-meta">
                                                        <span className="dash-project-task-status">{task.columnName}</span>
                                                        {task.dueDate && (
                                                            <span className={`dash-project-task-due ${isOverdue(task.dueDate) ? 'overdue' : ''}`}>
                                                                <Calendar size={10} /> {formatDueDate(task.dueDate)}
                                                            </span>
                                                        )}
                                                    </div>
                                                </Link>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="dash-task-empty">
                        <CheckSquare size={32} strokeWidth={1.5} />
                        <p>{t('dashboard.noOpenTasks')}</p>
                        <span>{t('dashboard.noOpenTasksDesc')}</span>
                        <Link href="/tasks" className="dash-task-empty-cta">
                            {t('dashboard.goToTasks')} <ArrowRight size={14} />
                        </Link>
                    </div>
                )}
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* SECTION 2: AI ASSISTANTS — Full Width               */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="dash-section-card">
                <div className="dash-card-header">
                    <h3><Bot size={16} strokeWidth={2} /> {t('dashboard.aiAssistants')}</h3>
                </div>
                <div className="dash-assistants-row">
                    {visibleAssistants.map((a) => (
                        <Link key={a.href} href={a.href} className="dash-assistant-btn">
                            <span className="dash-assistant-icon">{a.icon}</span>
                            <span className="dash-assistant-label">{t(a.labelKey)}</span>
                        </Link>
                    ))}
                </div>
            </div>

            {/* ═══════════════════════════════════════════════════ */}
            {/* SECTION 3: RECENT ACTIVITY — Full Width             */}
            {/* ═══════════════════════════════════════════════════ */}
            <div className="dash-section-card">
                <div className="dash-card-header">
                    <h3>{t('dashboard.recentActivity')}</h3>
                </div>
                {recentActivity.length > 0 ? (
                    <ul className="dash-activity-list">
                        {recentActivity.map((item) => (
                            <li key={`${item.type}-${item.id}`}>
                                <Link href={item.href} className="dash-activity-item">
                                    <span className="dash-activity-icon">{item.icon}</span>
                                    <span className="dash-activity-name">{item.title}</span>
                                    <span className="dash-activity-time">{formatRelativeDate(item.time)}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <div className="dash-activity-empty">{t('dashboard.noRecentActivity')}</div>
                )}
            </div>
        </div>
    );
}
