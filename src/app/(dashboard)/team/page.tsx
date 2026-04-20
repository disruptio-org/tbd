'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useUIFeedback } from '@/components/UIFeedback';
import TeamActivityFeed from './TeamActivityFeed';
import {
    Bot, Brain, Building2, Coins, Megaphone, GraduationCap,
    Target, Package, ChevronRight, Zap, Users,
    CheckCircle2, Clock, AlertTriangle, Activity,
} from 'lucide-react';
import './team.css';

/* ─── Types ────────────────────────────────────────── */

interface BrainMember {
    id: string;
    brainType: string;
    name: string;
    description: string | null;
    status: string;
    isEnabled: boolean;
    updatedAt: string;
    configJson?: any;
}

interface MemberWithActivity extends BrainMember {
    workingTasks: number;
    pendingApprovals: number;
    completedToday: number;
    currentTask?: string;
    agentStatus: 'idle' | 'working' | 'waiting' | 'blocked';
    recentActions: ActivityItem[];
    displayName: string;
    avatarUrl: string | null;
}

interface ActivityItem {
    id: string;
    type: 'completed' | 'handoff' | 'clarification' | 'blocked';
    agentName: string;
    agentColor: string;
    title: string;
    projectName?: string;
    timestamp: string;
}

/* ─── Helpers ──────────────────────────────────────── */

const AVATAR_COLORS = [
    '#6366f1', '#8b5cf6', '#0891b2', '#059669', '#d97706',
    '#e11d48', '#4f46e5', '#0d9488', '#be185d', '#65a30d',
];

function getAvatarColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

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

const BRAIN_ICONS: Record<string, React.ReactNode> = {
    'COMPANY': <Building2 size={16} />,
    'MARKETING': <Megaphone size={16} />,
    'SALES': <Coins size={16} />,
    'PRODUCT_ASSISTANT': <Package size={16} />,
    'ONBOARDING': <GraduationCap size={16} />,
    'COMPANY_ADVISOR': <Building2 size={16} />,
    'LEAD_DISCOVERY': <Target size={16} />,
    'DESIGN_BRAND': <Brain size={16} />,
};

/* ═══════════════════════════════════════════════════ */
export default function TeamPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const activeTab = searchParams.get('tab') || 'members';
    const { showToast } = useUIFeedback();
    const [loading, setLoading] = useState(true);
    const [members, setMembers] = useState<MemberWithActivity[]>([]);

    /* ─── Load team data ─────────────────────────── */

    const loadTeam = useCallback(async () => {
        try {
            // 1. Fetch brains
            const brainsRes = await fetch('/api/ai/brains');
            const brainsData = await brainsRes.json();
            const brains: BrainMember[] = brainsData.brains || [];

            // 2. Enrich each brain with task/activity data
            const enriched: MemberWithActivity[] = await Promise.all(
                brains.map(async (brain) => {
                    let workingTasks = 0;
                    let pendingApprovals = 0;
                    let completedToday = 0;
                    let currentTask: string | undefined;
                    const recentActions: ActivityItem[] = [];

                    try {
                        // Fetch tasks for this member
                        const tasksRes = await fetch(`/api/ai/members/${brain.id}/tasks`);
                        if (tasksRes.ok) {
                            const tasksData = await tasksRes.json();
                            const items = tasksData.items || [];
                            workingTasks = items.filter((t: any) => t.status === 'working').length;
                            completedToday = items.filter((t: any) => t.status === 'done').length;
                            const working = items.find((t: any) => t.status === 'working');
                            if (working) currentTask = working.title;

                            // Build activity items from recent tasks
                            items.slice(0, 3).forEach((t: any) => {
                                recentActions.push({
                                    id: t.id,
                                    type: t.status === 'done' ? 'completed'
                                        : t.status === 'needs_approval' ? 'handoff'
                                        : t.status === 'blocked' ? 'blocked'
                                        : 'clarification',
                                    agentName: brain.configJson?.identity?.displayName || brain.name,
                                    agentColor: getAvatarColor(brain.configJson?.identity?.displayName || brain.name),
                                    title: t.title,
                                    projectName: t.projectName,
                                    timestamp: t.updatedAt || brain.updatedAt,
                                });
                            });
                        }
                    } catch { /* non-critical */ }

                    try {
                        // Fetch approvals for this member
                        const appRes = await fetch(`/api/ai/members/${brain.id}/approvals`);
                        if (appRes.ok) {
                            const appData = await appRes.json();
                            pendingApprovals = (appData.items || []).filter(
                                (a: any) => a.status === 'waiting'
                            ).length;
                        }
                    } catch { /* non-critical */ }

                    // Determine agent status
                    let agentStatus: MemberWithActivity['agentStatus'] = 'idle';
                    if (!brain.isEnabled || brain.status !== 'ACTIVE') {
                        agentStatus = 'idle';
                    } else if (pendingApprovals > 0) {
                        agentStatus = 'waiting';
                    } else if (workingTasks > 0) {
                        agentStatus = 'working';
                    }

                    return {
                        ...brain,
                        workingTasks,
                        pendingApprovals,
                        completedToday,
                        currentTask,
                        agentStatus,
                        recentActions,
                        displayName: brain.configJson?.identity?.displayName || brain.name,
                        avatarUrl: brain.configJson?.identity?.avatarUrl || null,
                    };
                })
            );

            setMembers(enriched);
        } catch {
            showToast('Error loading AI Team', 'error');
        }
        setLoading(false);
    }, [showToast]);

    useEffect(() => { loadTeam(); }, [loadTeam]);

    /* ─── Derived stats ──────────────────────────── */

    const totalActive = members.filter(m => m.status === 'ACTIVE' && m.isEnabled).length;
    const totalWorking = members.filter(m => m.agentStatus === 'working').length;
    const totalPendingApprovals = members.reduce((s, m) => s + m.pendingApprovals, 0);
    const totalCompletedToday = members.reduce((s, m) => s + m.completedToday, 0);

    // Aggregate recent activity across all agents
    const allActivity: ActivityItem[] = members
        .flatMap(m => m.recentActions)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 8);

    /* ─── Loading ────────────────────────────────── */

    if (loading) {
        return (
            <div className="team-page">
                <div className="team-loading"><div className="spinner" /></div>
            </div>
        );
    }

    /* ─── Activity Tab ────────────────────────────── */

    if (activeTab === 'activity') {
        return (
            <div className="team-page">
                <TeamActivityFeed />
            </div>
        );
    }

    /* ─── Members Tab (default) ───────────────────── */

    const STATUS_LABELS: Record<string, string> = {
        idle: 'Standing By',
        working: 'Working',
        waiting: 'Needs Attention',
        blocked: 'Blocked',
    };

    return (
        <div className="team-page">

            {/* ── Stats Row ────────────────────────── */}
            <div className="team-stats-row">
                <div className="team-stat-card">
                    <div className="team-stat-value accent-lime">{totalActive}</div>
                    <div className="team-stat-label">Active Members</div>
                </div>
                <div className="team-stat-card">
                    <div className="team-stat-value accent-cyan">{totalWorking}</div>
                    <div className="team-stat-label">Currently Working</div>
                </div>
                <div className="team-stat-card">
                    <div className="team-stat-value accent-warning">{totalPendingApprovals}</div>
                    <div className="team-stat-label">Pending Approvals</div>
                </div>
                <div className="team-stat-card">
                    <div className="team-stat-value">{totalCompletedToday}</div>
                    <div className="team-stat-label">Completed Today</div>
                </div>
            </div>

            {/* ── Members Grid ─────────────────────── */}
            <div className="team-section-header">
                <div className="team-section-title">
                    <Users size={14} />
                    Team Members
                    <span className="team-section-count">{members.length}</span>
                </div>
            </div>

            {members.length === 0 ? (
                <div className="team-empty">
                    <Bot size={40} style={{ opacity: 0.15, color: 'var(--color-text-muted)' }} />
                    <h3>No AI team members yet</h3>
                    <p>Configure your AI team in Settings → AI Team to start delegating work to intelligent agents.</p>
                    <button className="btn btn-primary" onClick={() => router.push('/settings/ai-brain')}>
                        <Zap size={14} /> Setup AI Team
                    </button>
                </div>
            ) : (
                <div className="team-grid">
                    {members.map(member => {
                        const initials = getInitials(member.displayName);
                        const color = getAvatarColor(member.displayName);
                        const isActive = member.status === 'ACTIVE' && member.isEnabled;
                        const roleLabel = member.description
                            || member.brainType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

                        return (
                            <button
                                key={member.id}
                                className="team-member-card"
                                onClick={() => router.push(`/ai-team/${member.id}`)}
                            >
                                {/* Top row: avatar + name */}
                                <div className="team-card-top">
                                    <div className="team-card-avatar" style={{ background: member.avatarUrl ? 'transparent' : color }}>
                                        {member.avatarUrl ? (
                                            <img src={member.avatarUrl} alt={member.displayName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                        ) : (
                                            initials
                                        )}
                                        <span className={`team-card-avatar-dot ${isActive ? 'active' : 'inactive'}`} />
                                    </div>
                                    <div className="team-card-identity">
                                        <div className="team-card-name">{member.displayName}</div>
                                        <div className="team-card-role">{roleLabel}</div>
                                    </div>
                                    <ChevronRight size={16} className="team-card-arrow" />
                                </div>

                                {/* Body: status + current work */}
                                <div className="team-card-body">
                                    <div className="team-card-status-row">
                                        <span className={`team-card-status-badge ${member.agentStatus}`}>
                                            {member.agentStatus === 'working' && <Activity size={10} />}
                                            {member.agentStatus === 'waiting' && <Clock size={10} />}
                                            {member.agentStatus === 'blocked' && <AlertTriangle size={10} />}
                                            {STATUS_LABELS[member.agentStatus]}
                                        </span>
                                    </div>

                                    {/* Current tasks mini-list */}
                                    {(member.currentTask || member.pendingApprovals > 0) && (
                                        <div className="team-card-tasks">
                                            {member.currentTask && (
                                                <div className="team-card-task-item">
                                                    <span className="team-card-task-dot cyan" />
                                                    <span className="team-card-task-label">{member.currentTask}</span>
                                                </div>
                                            )}
                                            {member.pendingApprovals > 0 && (
                                                <div className="team-card-task-item">
                                                    <span className="team-card-task-dot warning" />
                                                    <span className="team-card-task-label">
                                                        {member.pendingApprovals} item{member.pendingApprovals > 1 ? 's' : ''} awaiting your approval
                                                    </span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Footer: metrics */}
                                <div className="team-card-footer">
                                    <div className="team-card-metric">
                                        <Zap size={12} className="team-card-metric-icon" />
                                        <span className="team-card-metric-value">{member.workingTasks}</span>
                                        active
                                    </div>
                                    <div className="team-card-metric">
                                        <CheckCircle2 size={12} className="team-card-metric-icon" />
                                        <span className="team-card-metric-value">{member.completedToday}</span>
                                        done
                                    </div>
                                    <div className="team-card-metric" style={{ marginLeft: 'auto' }}>
                                        {BRAIN_ICONS[member.brainType] || <Brain size={14} />}
                                    </div>
                                </div>
                            </button>
                        );
                    })}
                </div>
            )}

            {/* ── Activity Feed ────────────────────── */}
            {allActivity.length > 0 && (
                <>
                    <div className="team-section-header">
                        <div className="team-section-title">
                            <Activity size={14} />
                            Recent Activity
                        </div>
                    </div>

                    <div className="team-activity-feed">
                        {allActivity.map((item) => {
                            // Find enriched member for this activity's agent
                            const enrichedMember = members.find(m => m.id === (item as any).agentId || m.name === item.agentName);
                            const displayAgentName = enrichedMember?.displayName || item.agentName;
                            const agentAvatarUrl = enrichedMember?.avatarUrl || null;

                            return (
                            <div key={item.id} className="team-activity-item">
                                <div
                                    className="team-activity-avatar"
                                    style={{ background: agentAvatarUrl ? 'transparent' : item.agentColor }}
                                >
                                    {agentAvatarUrl ? (
                                        <img src={agentAvatarUrl} alt={displayAgentName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                    ) : (
                                        getInitials(displayAgentName)
                                    )}
                                </div>
                                <div className="team-activity-content">
                                    <div className="team-activity-header">
                                        <span className="team-activity-name">{displayAgentName}</span>
                                        <span className={`team-activity-type-badge ${item.type === 'blocked' ? 'blocked-badge' : item.type}`}>
                                            {item.type === 'completed' && <CheckCircle2 size={10} />}
                                            {item.type === 'handoff' && <Zap size={10} />}
                                            {item.type === 'clarification' && <Clock size={10} />}
                                            {item.type === 'blocked' && <AlertTriangle size={10} />}
                                            {item.type}
                                        </span>
                                        <span className="team-activity-time">{timeAgo(item.timestamp)}</span>
                                    </div>
                                    <p className="team-activity-text">
                                        {item.title}
                                        {item.projectName && (
                                            <span style={{ opacity: 0.5 }}> · {item.projectName}</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                        );
                        })}
                    </div>
                </>
            )}

            {allActivity.length === 0 && members.length > 0 && (
                <p className="team-empty-hint">
                    No recent activity from your AI team. Start a conversation or assign tasks to get things moving.
                </p>
            )}
        </div>
    );
}
