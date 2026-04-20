'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { use } from 'react';
import { useRouter } from 'next/navigation';
import {
    ArrowLeft, Check, X, Loader2, Clock, FileText, Activity,
    ShieldCheck, Package, Brain, Compass, Trash2, Send,
    AlertTriangle, CheckCircle2, XCircle, ClipboardList, MessageCircle,
    Eye, Maximize2, Minimize2,
} from 'lucide-react';
import {
    INITIATIVE_STATUS_LABELS,
    INITIATIVE_STATUS_COLORS,
    TASK_STATUS_LABELS,
    TASK_STATUS_COLORS,
    PRIORITY_COLORS,
    PRIORITY_LABELS,
    WORK_TYPE_LABELS,
    APPROVAL_GATE_LABELS,
} from '@/lib/boardroom/constants';
import type {
    InitiativeStatus,
    TaskStatus,
    WorkType,
    PriorityLevel,
    ApprovalGateType,
} from '@/lib/boardroom/constants';
import '../boardroom.css';
import './initiative-detail.css';
import ImageViewer from './ImageViewer';

/* ─── Types ────────────────────────────────────────────── */

interface Initiative {
    id: string;
    title: string;
    objective: string;
    businessGoal: string | null;
    requestedOutcome: string | null;
    workType: string | null;
    confidenceScore: number | null;
    status: InitiativeStatus;
    priority: string;
    approvalMode: string;
    sourceCommand: string | null;
    planSummary: string | null;
    projectId: string | null;
    projectName: string | null;
    createdById: string;
    createdAt: string;
    updatedAt: string;
    completedAt: string | null;
}

interface Workstream {
    id: string;
    title: string;
    description: string | null;
    position: number;
    status: string;
}

interface InitiativeTask {
    id: string;
    title: string;
    description: string | null;
    purpose: string | null;
    inputs: { label: string; value: string }[] | null;
    deliverables: { type: string; description: string }[] | null;
    acceptanceCriteria: string | null;
    assignedBrainType: string | null;
    assignedBrainName: string | null;
    assignedBrainId: string | null;
    selectedSkillId: string | null;
    requiredSkill: string | null;
    status: TaskStatus;
    dueTarget: string | null;
    deliveredAt: string | null;
    outputSummary: string | null;
    dependsOnTaskIds: string[];
    workstreamId: string | null;
    requiresApprovalBeforeRun: boolean;
    requiresApprovalAfterRun: boolean;
    executionModeOverride: string | null;
    revisionCount: number;
    position: number;
}

interface Approval {
    id: string;
    gateType: string;
    title: string;
    description: string | null;
    status: string;
    taskId: string | null;
    decidedAt: string | null;
    decisionNote: string | null;
    createdAt: string;
}

interface Artifact {
    id: string;
    artifactType: string;
    title: string;
    content: string | null;
    contentUrl: string | null;
    status: string;
    taskId: string | null;
    createdAt: string;
}

interface EventItem {
    id: string;
    actorType: string;
    actorLabel: string | null;
    action: string;
    description: string | null;
    createdAt: string;
}

/* ─── Markdown Renderer for Artifacts & Output ─────────── */

function renderBoardroomMarkdown(text: string): string {
    // Escape HTML
    let escaped = text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Extract code blocks to protect them
    const codeBlocks: string[] = [];
    escaped = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
        const idx = codeBlocks.length;
        codeBlocks.push(
            `<pre class="brd-md-code"><code>${code.trim()}</code></pre>`
        );
        return `%%CODEBLOCK_${idx}%%`;
    });

    const lines = escaped.split('\n');
    const processed: string[] = [];
    let inOl = false;
    let inUl = false;

    function closeList() {
        if (inOl) { processed.push('</ol>'); inOl = false; }
        if (inUl) { processed.push('</ul>'); inUl = false; }
    }

    function inlineFormat(s: string): string {
        return s
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
            .replace(/`([^`]+)`/g, '<code class="brd-md-inline-code">$1</code>');
    }

    for (const line of lines) {
        // Code block placeholder
        if (line.trim().startsWith('%%CODEBLOCK_')) {
            closeList();
            processed.push(line.trim());
            continue;
        }

        // Headings
        const h4 = line.match(/^####\s+(.+)/);
        if (h4) { closeList(); processed.push(`<h6 class="brd-md-h4">${inlineFormat(h4[1])}</h6>`); continue; }
        const h3 = line.match(/^###\s+(.+)/);
        if (h3) { closeList(); processed.push(`<h5 class="brd-md-h3">${inlineFormat(h3[1])}</h5>`); continue; }
        const h2 = line.match(/^##\s+(.+)/);
        if (h2) { closeList(); processed.push(`<h4 class="brd-md-h2">${inlineFormat(h2[1])}</h4>`); continue; }
        const h1 = line.match(/^#\s+(.+)/);
        if (h1) { closeList(); processed.push(`<h3 class="brd-md-h1">${inlineFormat(h1[1])}</h3>`); continue; }

        // Horizontal rule
        if (/^---+$/.test(line.trim())) { closeList(); processed.push('<hr class="brd-md-hr" />'); continue; }

        // Ordered list
        const olMatch = line.match(/^\d+\.\s+(.+)/);
        if (olMatch) {
            if (inUl) { processed.push('</ul>'); inUl = false; }
            if (!inOl) { processed.push('<ol class="brd-md-ol">'); inOl = true; }
            processed.push(`<li>${inlineFormat(olMatch[1])}</li>`);
            continue;
        }

        // Unordered list (including indented sub-bullets)
        const ulMatch = line.match(/^\s*[-*•]\s+(.+)/);
        if (ulMatch) {
            if (inOl) { processed.push('</ol>'); inOl = false; }
            if (!inUl) { processed.push('<ul class="brd-md-ul">'); inUl = true; }
            processed.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
            continue;
        }

        // Normal text or blank line
        closeList();
        if (line.trim()) {
            processed.push(`<p class="brd-md-p">${inlineFormat(line)}</p>`);
        }
    }
    closeList();

    // Restore code blocks
    let result = processed.join('\n');
    codeBlocks.forEach((block, i) => {
        result = result.replace(`%%CODEBLOCK_${i}%%`, block);
    });

    return result;
}

/* ─── Tab Types ────────────────────────────────────────── */

type TabKey = 'plan_review' | 'tasks' | 'workstreams' | 'approvals' | 'artifacts' | 'activity';

interface ChatMsg {
    role: 'user' | 'assistant';
    content: string;
}

const TABS: { key: TabKey; label: string; icon: React.ReactNode; awaitingOnly?: boolean }[] = [
    { key: 'plan_review', label: 'PLAN REVIEW', icon: <ClipboardList size={14} />, awaitingOnly: true },
    { key: 'tasks', label: 'TASK TABLE', icon: <FileText size={14} /> },
    { key: 'workstreams', label: 'WORKSTREAMS', icon: <Package size={14} /> },
    { key: 'approvals', label: 'APPROVALS', icon: <ShieldCheck size={14} /> },
    { key: 'artifacts', label: 'ARTIFACTS', icon: <FileText size={14} /> },
    { key: 'activity', label: 'ACTIVITY LOG', icon: <Activity size={14} /> },
];

/* ─── Main Page ────────────────────────────────────────── */

export default function InitiativeDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [initiative, setInitiative] = useState<Initiative | null>(null);
    const [workstreams, setWorkstreams] = useState<Workstream[]>([]);
    const [tasks, setTasks] = useState<InitiativeTask[]>([]);
    const [approvals, setApprovals] = useState<Approval[]>([]);
    const [artifacts, setArtifacts] = useState<Artifact[]>([]);
    const [events, setEvents] = useState<EventItem[]>([]);
    const [activeTab, setActiveTab] = useState<TabKey>('tasks');
    const [actionLoading, setActionLoading] = useState<string | null>(null);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    // Chat state (plan review)
    const [chatMessages, setChatMessages] = useState<ChatMsg[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const chatEndRef = useRef<HTMLDivElement>(null);
    const chatInputRef = useRef<HTMLInputElement>(null);

    // Approval detail view state
    const [viewingApproval, setViewingApproval] = useState<string | null>(null);
    const [approvalChat, setApprovalChat] = useState<ChatMsg[]>([]);
    const [approvalChatInput, setApprovalChatInput] = useState('');
    const [approvalChatLoading, setApprovalChatLoading] = useState(false);
    const approvalChatEndRef = useRef<HTMLDivElement>(null);
    const approvalChatInputRef = useRef<HTMLInputElement>(null);

    /* ─── Load Data ────────────────────────────────────── */

    const loadData = useCallback(async () => {
        try {
            const res = await fetch(`/api/boardroom/initiatives/${id}`);
            const data = await res.json();
            if (res.ok) {
                setInitiative(data.initiative);
                setWorkstreams(data.workstreams || []);
                setTasks(data.tasks || []);
                setApprovals(data.approvals || []);
                setArtifacts(data.artifacts || []);
                setEvents(data.events || []);
            }
        } catch { /* ignore */ }
        setLoading(false);
    }, [id]);

    useEffect(() => { loadData(); }, [loadData]);

    // Auto-select plan_review tab when initiative is in plan review
    useEffect(() => {
        if (initiative?.status === 'PLAN_IN_REVIEW') {
            setActiveTab('plan_review');
        }
    }, [initiative?.status]);

    // Auto-scroll chat on new message
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    /* ─── Chat with Company DNA ────────────────────────── */

    async function sendChatMessage() {
        const msg = chatInput.trim();
        if (!msg || chatLoading) return;

        const userMsg: ChatMsg = { role: 'user', content: msg };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setChatLoading(true);

        try {
            const res = await fetch(`/api/boardroom/initiatives/${id}/discuss`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: msg,
                    history: [...chatMessages, userMsg],
                }),
            });
            const data = await res.json();
            if (res.ok && data.reply) {
                setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
            }
        } catch { /* ignore */ }
        setChatLoading(false);
        chatInputRef.current?.focus();
    }

    // Auto-scroll approval chat
    useEffect(() => {
        approvalChatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [approvalChat]);

    /* ─── Approval-specific chat ───────────────────────── */

    function openApprovalView(approvalId: string) {
        setViewingApproval(approvalId);
        setApprovalChat([]);
        setApprovalChatInput('');
    }

    async function sendApprovalChat() {
        const msg = approvalChatInput.trim();
        if (!msg || approvalChatLoading || !viewingApproval) return;

        const userMsg: ChatMsg = { role: 'user', content: msg };
        setApprovalChat(prev => [...prev, userMsg]);
        setApprovalChatInput('');
        setApprovalChatLoading(true);

        try {
            const res = await fetch(`/api/boardroom/initiatives/${id}/discuss`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: `[Regarding approval gate: ${approvals.find(a => a.id === viewingApproval)?.title}]\n\n${msg}`,
                    history: [...approvalChat, userMsg],
                }),
            });
            const data = await res.json();
            if (res.ok && data.reply) {
                setApprovalChat(prev => [...prev, { role: 'assistant', content: data.reply }]);
            }
        } catch { /* ignore */ }
        setApprovalChatLoading(false);
        approvalChatInputRef.current?.focus();
    }

    /* ─── Actions ──────────────────────────────────────── */

    async function handlePlanAction(action: 'approve' | 'reject' | 'revision') {
        if (!initiative || actionLoading) return;
        setActionLoading('plan');

        await fetch(`/api/boardroom/initiatives/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action }),
        });

        await loadData();
        setActionLoading(null);
    }

    async function handleApprovalAction(approvalId: string, action: 'approve' | 'reject' | 'revision') {
        if (actionLoading) return;
        setActionLoading(approvalId);

        await fetch(`/api/boardroom/initiatives/${id}/approve`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approvalId, action }),
        });

        await loadData();
        setActionLoading(null);
    }

    async function handleStatusChange(targetStatus: InitiativeStatus) {
        if (!initiative || actionLoading) return;
        setActionLoading('status');

        await fetch(`/api/boardroom/initiatives/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: targetStatus }),
        });

        await loadData();
        setActionLoading(null);
    }

    async function handleDelete() {
        if (isDeleting) return;
        setIsDeleting(true);

        try {
            const res = await fetch(`/api/boardroom/initiatives/${id}`, { method: 'DELETE' });
            if (res.ok) {
                router.push('/boardroom');
            }
        } catch { /* ignore */ }
        setIsDeleting(false);
    }

    /* ─── Task Actions ────────────────────────────────── */

    const [executingTask, setExecutingTask] = useState<string | null>(null);
    const [viewingTask, setViewingTask] = useState<string | null>(null);
    const [previewArtifact, setPreviewArtifact] = useState<Artifact | null>(null);

    async function handleTaskExecute(taskId: string) {
        if (executingTask) return;
        setExecutingTask(taskId);

        try {
            const res = await fetch(`/api/boardroom/initiatives/${id}/tasks/${taskId}/execute`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (res.ok) {
                await loadData();
                setViewingTask(taskId); // auto-open the task detail to see the output
            }
        } catch { /* ignore */ }
        setExecutingTask(null);
    }

    async function handleTaskStatusChange(taskId: string, newStatus: string) {
        setActionLoading(taskId);
        try {
            await fetch(`/api/boardroom/initiatives/${id}/tasks`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ taskId, status: newStatus }),
            });
            await loadData();
        } catch { /* ignore */ }
        setActionLoading(null);
    }

    async function handleApproveToRun(taskId: string) {
        setActionLoading(taskId);
        try {
            const res = await fetch(`/api/boardroom/initiatives/${id}/tasks/${taskId}/approve-to-run`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            });
            if (res.ok) await loadData();
        } catch { /* ignore */ }
        setActionLoading(null);
    }

    async function handleTaskValidate(taskId: string, action: 'approve' | 'revise' | 'rerun') {
        setActionLoading(taskId);
        try {
            const res = await fetch(`/api/boardroom/initiatives/${id}/tasks/${taskId}/validate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action }),
            });
            if (res.ok) await loadData();
        } catch { /* ignore */ }
        setActionLoading(null);
    }

    /* ─── Loading ──────────────────────────────────────── */

    if (loading) {
        return (
            <div className="boardroom-page">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 16 }}>
                    <div style={{ width: 32, height: 32, border: '3px solid var(--color-stroke-subtle)', borderTopColor: 'var(--color-accent-primary)', borderRadius: '0%', animation: 'spin 700ms linear infinite' }} />
                    <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Loading Initiative</span>
                </div>
            </div>
        );
    }

    if (!initiative) {
        return (
            <div className="boardroom-page">
                <div className="assistant-page-header">
                    <div className="assistant-page-title">
                        <button className="customer-back-btn" onClick={() => router.push('/boardroom')}>
                            <ArrowLeft size={16} />
                        </button>
                        <span className="assistant-page-icon"><Compass size={20} strokeWidth={2} /></span>
                        <h1>INITIATIVE NOT FOUND</h1>
                    </div>
                </div>
                <div className="boardroom-empty">
                    <Compass size={48} className="boardroom-empty-icon" />
                    <div className="boardroom-empty-title">Initiative Not Found</div>
                    <div className="boardroom-empty-desc">This initiative may have been deleted or doesn&apos;t exist.</div>
                </div>
            </div>
        );
    }

    /* ─── Computed ──────────────────────────────────────── */

    const statusColor = INITIATIVE_STATUS_COLORS[initiative.status] || '#94a3b8';
    const priorityColor = PRIORITY_COLORS[initiative.priority as PriorityLevel] || '#94a3b8';
    const completedTasks = tasks.filter(t => t.status === 'VALIDATED').length;
    const progress = tasks.length > 0 ? Math.round((completedTasks / tasks.length) * 100) : 0;
    const pendingApprovals = approvals.filter(a => a.status === 'PENDING');

    /* ─── Status Actions ───────────────────────────────── */

    function getStatusActions(): { label: string; status: InitiativeStatus; variant: string }[] {
        switch (initiative!.status) {
            case 'PLAN_APPROVED': return [{ label: 'Ready for Execution', status: 'READY_FOR_EXECUTION', variant: 'primary' }];
            case 'READY_FOR_EXECUTION': return [{ label: 'Start Execution', status: 'IN_PROGRESS', variant: 'primary' }];
            case 'IN_PROGRESS': return [
                { label: 'Review Ready', status: 'REVIEW_READY', variant: 'primary' },
                { label: 'Waiting on Human', status: 'WAITING_HUMAN_INPUT', variant: 'outline' },
            ];
            case 'WAITING_HUMAN_INPUT': return [{ label: 'Resume', status: 'IN_PROGRESS', variant: 'primary' }];
            case 'REVIEW_READY': return [
                { label: 'Complete', status: 'COMPLETED', variant: 'primary' },
                { label: 'Resume', status: 'IN_PROGRESS', variant: 'outline' },
            ];
            default: return [];
        }
    }

    /* ─── Render ───────────────────────────────────────── */

    return (
        <div className="boardroom-page">
            {/* ── Initiative Info Card ── */}
            <div className="id-info-card">
                <div className="id-info-header">
                    <div className="id-priority-bar" style={{ background: priorityColor }} />
                    <h2 className="id-title">
                        {initiative.title}
                    </h2>
                    <div className="id-actions">
                        <span
                            className="id-status-badge"
                            style={{ color: statusColor, borderColor: statusColor, background: `${statusColor}10` }}
                        >
                            {INITIATIVE_STATUS_LABELS[initiative.status]}
                        </span>

                        {/* Status transition actions */}
                        {getStatusActions().map(a => (
                            <button
                                key={a.status}
                                className={`id-btn ${a.variant === 'primary' ? 'id-btn-primary' : 'id-btn-secondary'} id-btn-sm`}
                                onClick={() => handleStatusChange(a.status)}
                                disabled={!!actionLoading}
                            >
                                {actionLoading === 'status' ? <Loader2 size={14} className="id-running-spinner" /> : null}
                                {a.label}
                            </button>
                        ))}

                        {/* Plan approval actions */}
                        {initiative.status === 'PLAN_IN_REVIEW' && (
                            <>
                                <button
                                    className="id-btn id-btn-primary id-btn-sm"
                                    onClick={() => handlePlanAction('approve')}
                                    disabled={!!actionLoading}
                                >
                                    {actionLoading === 'plan' ? <Loader2 size={14} className="id-running-spinner" /> : <Check size={14} />}
                                    Approve
                                </button>
                                <button
                                    className="id-btn id-btn-secondary id-btn-sm"
                                    onClick={() => handlePlanAction('revision')}
                                    disabled={!!actionLoading}
                                >
                                    Revision
                                </button>
                                <button
                                    className="id-btn id-btn-danger"
                                    onClick={() => handlePlanAction('reject')}
                                    disabled={!!actionLoading}
                                >
                                    <XCircle size={14} />
                                </button>
                            </>
                        )}

                        {/* Delete */}
                        <button
                            className="id-btn id-btn-danger"
                            onClick={() => setShowDeleteConfirm(true)}
                            title="Delete Initiative"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                </div>

                <p className="id-objective">{initiative.objective}</p>

                <div className="id-meta-row">
                    <div>
                        <span className="id-meta-item-label">Priority</span>
                        <div className="id-meta-item-value">{PRIORITY_LABELS[initiative.priority as PriorityLevel] || initiative.priority}</div>
                    </div>
                    {initiative.workType && (
                        <div>
                            <span className="id-meta-item-label">Type</span>
                            <div className="id-meta-item-value">{WORK_TYPE_LABELS[initiative.workType as WorkType] || initiative.workType}</div>
                        </div>
                    )}
                    {initiative.projectName && (
                        <div>
                            <span className="id-meta-item-label">Project</span>
                            <div className="id-meta-item-value">{initiative.projectName}</div>
                        </div>
                    )}
                    <div>
                        <span className="id-meta-item-label">Tasks</span>
                        <div className="id-meta-item-value">{completedTasks}/{tasks.length} ({progress}%)</div>
                    </div>
                    <div>
                        <span className="id-meta-item-label">Created</span>
                        <div className="id-meta-item-value">{new Date(initiative.createdAt).toLocaleDateString()}</div>
                    </div>
                </div>

                {/* Progress bar */}
                <div className="id-progress-wrap">
                    <div className="id-progress-track">
                        <div className="id-progress-bar" style={{ width: `${progress}%` }} />
                    </div>
                </div>
            </div>

            {/* ── Pending Approvals Alert ── */}
            {pendingApprovals.length > 0 && (
                <div className="id-approval-alert">
                    <AlertTriangle size={16} />
                    {pendingApprovals.length} approval{pendingApprovals.length !== 1 ? 's' : ''} pending
                </div>
            )}

            {/* ── Tab Navigation ── */}
            <div className="id-tabs">
                {TABS
                    .filter(tab => !tab.awaitingOnly || initiative.status === 'PLAN_IN_REVIEW')
                    .map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`id-tab ${activeTab === tab.key ? 'active' : ''}`}
                    >
                        {tab.icon} {tab.label}
                        {tab.key === 'approvals' && pendingApprovals.length > 0 && (
                            <span className="id-tab-badge">
                                {pendingApprovals.length}
                            </span>
                        )}
                    </button>
                ))}
            </div>

            {/* ── Plan Review Tab ── */}
            {activeTab === 'plan_review' && (
                <>
                    <div className="boardroom-review">
                        <div className="boardroom-review-header">
                            <span className="boardroom-review-header-title">
                                <ClipboardList size={16} /> Execution Plan Review
                            </span>
                            <span className="boardroom-status-badge" style={{
                                color: '#f59e0b',
                                borderColor: '#f59e0b',
                                background: 'rgba(245,158,11,0.06)',
                            }}>
                                AWAITING YOUR APPROVAL
                            </span>
                        </div>
                        <div className="boardroom-review-body">
                            {/* Objective */}
                            {initiative.objective && (
                                <div className="boardroom-review-section">
                                    <span className="boardroom-review-label">Objective</span>
                                    <div className="boardroom-review-value">{initiative.objective}</div>
                                </div>
                            )}

                            {/* Business Goal */}
                            {initiative.businessGoal && (
                                <div className="boardroom-review-section">
                                    <span className="boardroom-review-label">Business Goal</span>
                                    <div className="boardroom-review-value">{initiative.businessGoal}</div>
                                </div>
                            )}

                            {/* Requested Outcome */}
                            {initiative.requestedOutcome && (
                                <div className="boardroom-review-section">
                                    <span className="boardroom-review-label">Expected Outcome</span>
                                    <div className="boardroom-review-value">{initiative.requestedOutcome}</div>
                                </div>
                            )}

                            {/* Plan Summary */}
                            {initiative.planSummary && (
                                <div className="boardroom-review-section">
                                    <span className="boardroom-review-label">Plan Summary</span>
                                    <div className="boardroom-review-value">{initiative.planSummary}</div>
                                </div>
                            )}

                            {/* Confidence */}
                            {initiative.confidenceScore != null && (
                                <div className="boardroom-review-section">
                                    <span className="boardroom-review-label">AI Confidence</span>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <div className="boardroom-progress-track" style={{ height: 6, flex: 1, maxWidth: 200 }}>
                                            <div className="boardroom-progress-bar" style={{ width: `${initiative.confidenceScore}%` }} />
                                        </div>
                                        <span style={{ fontSize: 13, fontWeight: 800 }}>{initiative.confidenceScore}%</span>
                                    </div>
                                </div>
                            )}

                            <hr className="boardroom-review-divider" />

                            {/* Workstreams */}
                            {workstreams.length > 0 && (
                                <div className="boardroom-review-section">
                                    <span className="boardroom-review-label">Workstreams ({workstreams.length})</span>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                        {workstreams.map((ws, i) => (
                                            <div key={ws.id} className="boardroom-review-task">
                                                <span className="boardroom-review-task-num">{i + 1}</span>
                                                <div className="boardroom-review-task-body">
                                                    <div className="boardroom-review-task-title">{ws.title}</div>
                                                    {ws.description && (
                                                        <div className="boardroom-review-task-meta">
                                                            <span>{ws.description}</span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Tasks */}
                            <div className="boardroom-review-section">
                                <span className="boardroom-review-label">Tasks ({tasks.length})</span>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {tasks.map((task, i) => {
                                        const depNames = task.dependsOnTaskIds
                                            .map(depId => tasks.find(t => t.id === depId)?.title)
                                            .filter(Boolean)
                                            .join(', ');
                                        return (
                                            <div key={task.id} className="boardroom-review-task">
                                                <span className="boardroom-review-task-num">{i + 1}</span>
                                                <div className="boardroom-review-task-body">
                                                    <div className="boardroom-review-task-title">{task.title}</div>
                                                    {task.description && (
                                                        <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 2, lineHeight: 1.5 }}>
                                                            {task.description}
                                                        </div>
                                                    )}
                                                    <div className="boardroom-review-task-meta">
                                                        <span><strong>Assigned:</strong> {task.assignedBrainName || task.assignedBrainType?.replace(/_/g, ' ') || 'Unassigned'}</span>
                                                        {task.requiredSkill && <span><strong>Skill:</strong> {task.requiredSkill}</span>}
                                                        {depNames && <span><strong>Depends on:</strong> {depNames}</span>}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Approval Gates */}
                            {approvals.length > 0 && (
                                <>
                                    <hr className="boardroom-review-divider" />
                                    <div className="boardroom-review-section">
                                        <span className="boardroom-review-label">Governance Gates ({approvals.length})</span>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                            {approvals.map(gate => (
                                                <div key={gate.id} className="boardroom-review-gate">
                                                    <ShieldCheck size={14} />
                                                    <span><strong>{gate.title}</strong></span>
                                                    <span style={{ fontWeight: 400, fontSize: 10 }}>
                                                        {APPROVAL_GATE_LABELS[gate.gateType as ApprovalGateType] || gate.gateType}
                                                        {gate.description && ` — ${gate.description}`}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Approval Actions */}
                            <hr className="boardroom-review-divider" />
                            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                <button
                                    className="id-btn id-btn-danger"
                                    onClick={() => handlePlanAction('reject')}
                                    disabled={!!actionLoading}
                                >
                                    <XCircle size={14} /> Reject Plan
                                </button>
                                <button
                                    className="id-btn id-btn-secondary"
                                    onClick={() => handlePlanAction('revision')}
                                    disabled={!!actionLoading}
                                >
                                    Request Revision
                                </button>
                                <button
                                    className="id-btn id-btn-primary"
                                    onClick={() => handlePlanAction('approve')}
                                    disabled={!!actionLoading}
                                >
                                    {actionLoading === 'plan' ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                                    Approve &amp; Start Execution
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* ── Inline Chat with Company DNA ── */}
                    <div className="boardroom-chat">
                        <div className="boardroom-chat-header">
                            <div className="boardroom-chat-header-icon">
                                <Brain size={14} />
                            </div>
                            <span>Discuss Plan with Company DNA</span>
                        </div>

                        {chatMessages.length === 0 ? (
                            <div className="boardroom-chat-empty">
                                <MessageCircle size={20} style={{ marginBottom: 8, opacity: 0.4 }} />
                                <div>Ask questions about the plan, request changes, or discuss strategy before approval.</div>
                            </div>
                        ) : (
                            <div className="boardroom-chat-messages">
                                {chatMessages.map((msg, i) => (
                                    <div key={i} className="boardroom-chat-msg">
                                        <div className={`boardroom-chat-msg-avatar ${msg.role === 'user' ? 'user' : 'system'}`}>
                                            {msg.role === 'user' ? 'Y' : <Brain size={12} />}
                                        </div>
                                        <div className="boardroom-chat-msg-body">
                                            <div className="boardroom-chat-msg-name">
                                                {msg.role === 'user' ? 'You' : 'Company DNA'}
                                            </div>
                                            <div className="boardroom-chat-msg-text">{msg.content}</div>
                                        </div>
                                    </div>
                                ))}
                                {chatLoading && (
                                    <div className="boardroom-chat-msg">
                                        <div className="boardroom-chat-msg-avatar system">
                                            <Brain size={12} />
                                        </div>
                                        <div className="boardroom-chat-msg-body">
                                            <div className="boardroom-chat-msg-name">Company DNA</div>
                                            <div className="boardroom-chat-msg-text" style={{ color: 'var(--color-text-muted)' }}>
                                                Analyzing plan...
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>
                        )}

                        <div className="boardroom-chat-input-row">
                            <input
                                ref={chatInputRef}
                                className="boardroom-chat-input"
                                type="text"
                                placeholder="Ask Company DNA about this plan..."
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                                disabled={chatLoading}
                            />
                            <button
                                className="id-btn id-btn-primary"
                                onClick={sendChatMessage}
                                disabled={chatLoading || !chatInput.trim()}
                            >
                                {chatLoading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                            </button>
                        </div>
                    </div>
                </>
            )}

            {/* ── Task Table Tab ── */}
            {activeTab === 'tasks' && (
                <div className="id-task-table">
                    <div className="id-task-table-header">
                        <span>Task</span>
                        <span>Assigned To</span>
                        <span>Status</span>
                        <span>Dependency</span>
                        <span>Due</span>
                        <span>Actions</span>
                    </div>

                    {tasks.length === 0 ? (
                        <div className="id-task-empty">
                            No tasks yet. Tasks will appear after plan approval.
                        </div>
                    ) : (
                        tasks.map(task => {
                            const tColor = TASK_STATUS_COLORS[task.status] || '#94a3b8';
                            const depNames = task.dependsOnTaskIds
                                .map(depId => tasks.find(t => t.id === depId)?.title || 'Unknown')
                                .join(', ');
                            const isExecuting = executingTask === task.id;

                            return (
                                <div key={task.id} className="id-task-row">
                                    <div>
                                        <div
                                            className="id-task-title-link"
                                            onClick={() => setViewingTask(task.id)}
                                        >
                                            {task.title}
                                            {task.outputSummary && <span className="id-task-output-tag">● HAS OUTPUT</span>}
                                        </div>
                                        {task.requiredSkill && (
                                            <div className="id-task-skill">
                                                {task.requiredSkill === 'no_matching_skill' ? '⚠ No matching skill' : task.requiredSkill}
                                            </div>
                                        )}
                                    </div>
                                    <div className="id-task-assigned">
                                        {task.assignedBrainName || task.assignedBrainType?.replace(/_/g, ' ') || '—'}
                                    </div>
                                    <span
                                        className="id-task-status"
                                        style={{ color: tColor, borderColor: tColor, background: `${tColor}10` }}
                                    >
                                        {TASK_STATUS_LABELS[task.status]}
                                    </span>
                                    <div className="id-task-dep">
                                        {depNames || '—'}
                                    </div>
                                    <div className="id-task-due">
                                        {task.dueTarget ? new Date(task.dueTarget).toLocaleDateString() : '—'}
                                    </div>
                                    {/* Actions */}
                                    <div className="id-task-actions">
                                        {(task.status === 'APPROVED_TO_RUN' || task.status === 'READY_FOR_REVIEW') && (
                                            <button
                                                className="id-btn id-btn-primary id-btn-sm"
                                                onClick={() => task.status === 'APPROVED_TO_RUN' ? handleTaskExecute(task.id) : handleApproveToRun(task.id)}
                                                disabled={!!executingTask}
                                            >
                                                {isExecuting ? <Loader2 size={10} className="id-running-spinner" /> : task.status === 'APPROVED_TO_RUN' ? <Brain size={10} /> : <Check size={10} />}
                                                {isExecuting ? 'Working...' : task.status === 'APPROVED_TO_RUN' ? 'Execute' : 'Approve to Run'}
                                            </button>
                                        )}
                                        {task.status === 'OUTPUT_READY' && (
                                            <>
                                                <button
                                                    className="id-btn id-btn-success id-btn-sm"
                                                    onClick={() => handleTaskValidate(task.id, 'approve')}
                                                    disabled={!!actionLoading}
                                                >
                                                    <Check size={10} /> Validate
                                                </button>
                                                <button
                                                    className="id-btn id-btn-secondary id-btn-sm"
                                                    onClick={() => handleTaskValidate(task.id, 'revise')}
                                                    disabled={!!actionLoading}
                                                >
                                                    Revise
                                                </button>
                                            </>
                                        )}
                                        <button
                                            className="id-btn id-btn-ghost id-btn-sm"
                                            onClick={() => setViewingTask(task.id)}
                                        >
                                            <Eye size={10} /> Details
                                        </button>
                                        {task.status === 'VALIDATED' && (
                                            <CheckCircle2 size={14} color="#22c55e" />
                                        )}
                                        {task.status === 'BLOCKED' && (
                                            <span className="id-blocked-tag">Blocked</span>
                                        )}
                                        {task.status === 'RUNNING' && (
                                            <Loader2 size={14} className="id-running-spinner" />
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ── Task Detail Modal ── */}
            {viewingTask && (() => {
                const task = tasks.find(t => t.id === viewingTask);
                if (!task) return null;
                const taskArtifacts = artifacts.filter(a => a.taskId === task.id);
                const taskDepNames = task.dependsOnTaskIds
                    .map(depId => tasks.find(t => t.id === depId)?.title)
                    .filter(Boolean);
                const tColor = TASK_STATUS_COLORS[task.status] || '#94a3b8';

                return (
                    <div className="boardroom-plan-overlay" onClick={() => setViewingTask(null)}>
                        <div
                            className="boardroom-plan-card"
                            style={{ width: '90%', maxWidth: 820, maxHeight: '90vh', display: 'flex', flexDirection: 'column', margin: '40px auto' }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Header */}
                            <div style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                padding: '16px 24px', borderBottom: '1px solid var(--color-stroke-subtle)',
                            }}>
                                <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 4 }}>
                                        Task #{task.position + 1} of {tasks.length}
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.01em' }}>
                                        {task.title}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
                                    <span className="id-status-badge" style={{ color: tColor, borderColor: tColor, background: `${tColor}10` }}>
                                        {TASK_STATUS_LABELS[task.status]}
                                    </span>
                                    <button className="id-modal-close" onClick={() => setViewingTask(null)}>
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Body */}
                            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px' }}>

                                {/* ═══ SECTION 1: PROJECT & INITIATIVE CONTEXT ═══ */}
                                <div style={{
                                    background: 'var(--color-bg-surface2)', borderRadius: 10,
                                    border: '1px solid var(--color-stroke-subtle)', padding: '14px 16px',
                                    marginBottom: 20,
                                }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                                        📁 Project & Initiative Context
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: initiative.projectName ? '1fr 1fr' : '1fr', gap: 12, marginBottom: 8 }}>
                                        {initiative.projectName && (
                                            <div>
                                                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Project</div>
                                                <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{initiative.projectName}</div>
                                            </div>
                                        )}
                                        <div>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>Initiative</div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>{initiative.title}</div>
                                        </div>
                                    </div>
                                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                                        {initiative.objective}
                                    </div>
                                    {initiative.businessGoal && (
                                        <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 6, fontStyle: 'italic' }}>
                                            Goal: {initiative.businessGoal}
                                        </div>
                                    )}
                                </div>

                                {/* ═══ SECTION 2: TASK BRIEF (what the AI will execute) ═══ */}
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-accent-primary)', marginBottom: 10 }}>
                                        📋 Task Brief
                                    </div>

                                    {/* Purpose */}
                                    {task.purpose && (
                                        <div style={{ marginBottom: 12 }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Purpose — Why This Task Matters</div>
                                            <div style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6 }}>{task.purpose}</div>
                                        </div>
                                    )}

                                    {/* Description / Prompt */}
                                    {task.description && (
                                        <div style={{
                                            background: 'var(--color-bg-surface2)', borderRadius: 8,
                                            border: '1px solid var(--color-stroke-subtle)',
                                            borderLeft: '3px solid var(--color-accent-primary)',
                                            padding: '12px 14px', marginBottom: 12,
                                        }}>
                                            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>Task Prompt / Instructions</div>
                                            <div style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.7 }}>{task.description}</div>
                                        </div>
                                    )}

                                    {/* Assignment Grid */}
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
                                        <div style={{
                                            padding: '10px 14px', background: 'var(--color-bg-surface2)',
                                            borderRadius: 8, border: '1px solid var(--color-stroke-subtle)',
                                        }}>
                                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>👤 Assigned To</div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-text-primary)' }}>
                                                {task.assignedBrainName || task.assignedBrainType?.replace(/_/g, ' ') || 'Unassigned'}
                                            </div>
                                        </div>
                                        <div style={{
                                            padding: '10px 14px', background: 'var(--color-bg-surface2)',
                                            borderRadius: 8, border: '1px solid var(--color-stroke-subtle)',
                                        }}>
                                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>🧠 Required Skill</div>
                                            <div style={{ fontSize: 13, fontWeight: 700, color: task.requiredSkill === 'no_matching_skill' ? 'var(--color-state-warning)' : 'var(--color-text-primary)' }}>
                                                {task.requiredSkill === 'no_matching_skill' ? '⚠ No matching skill' : task.requiredSkill || 'General'}
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* ═══ SECTION 3: DELIVERABLES — What this task will produce ═══ */}
                                <div style={{ marginBottom: 20 }}>
                                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-accent-secondary)', marginBottom: 10 }}>
                                        📦 Expected Deliverables
                                    </div>

                                    {task.deliverables && Array.isArray(task.deliverables) && task.deliverables.length > 0 ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                            {task.deliverables.map((d: { type: string; description: string }, i: number) => (
                                                <div key={i} style={{
                                                    display: 'flex', alignItems: 'flex-start', gap: 12,
                                                    padding: '10px 14px', background: 'var(--color-bg-surface2)',
                                                    borderRadius: 8, border: '1px solid var(--color-stroke-subtle)',
                                                }}>
                                                    <div style={{
                                                        fontSize: 9, fontWeight: 800, textTransform: 'uppercase',
                                                        letterSpacing: '0.04em', color: 'var(--color-accent-secondary)',
                                                        background: 'rgba(0,212,255,0.1)', padding: '3px 10px',
                                                        borderRadius: 999, whiteSpace: 'nowrap', marginTop: 1, flexShrink: 0,
                                                    }}>
                                                        {d.type || 'output'}
                                                    </div>
                                                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.6 }}>
                                                        {d.description}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div style={{
                                            padding: '12px 14px', background: 'var(--color-bg-surface2)',
                                            borderRadius: 8, border: '1px solid var(--color-stroke-subtle)',
                                            fontSize: 12, color: 'var(--color-text-muted)', fontStyle: 'italic',
                                        }}>
                                            No specific deliverables defined — task will produce a general output document.
                                        </div>
                                    )}
                                </div>

                                {/* ═══ SECTION 4: ACCEPTANCE CRITERIA ═══ */}
                                {task.acceptanceCriteria && (
                                    <div style={{ marginBottom: 20 }}>
                                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-state-success)', marginBottom: 10 }}>
                                            ✅ Acceptance Criteria
                                        </div>
                                        <div style={{
                                            fontSize: 12, color: 'var(--color-text-secondary)', lineHeight: 1.7,
                                            padding: '12px 14px', background: 'var(--color-bg-surface2)',
                                            borderRadius: 8, border: '1px solid var(--color-stroke-subtle)',
                                            borderLeft: '3px solid var(--color-state-success)',
                                        }}>
                                            {task.acceptanceCriteria}
                                        </div>
                                    </div>
                                )}

                                {/* ═══ SECTION 5: INPUTS & CONTEXT ═══ */}
                                {task.inputs && Array.isArray(task.inputs) && task.inputs.length > 0 && (
                                    <div style={{ marginBottom: 20 }}>
                                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 10 }}>
                                            📥 Inputs & Context Data
                                        </div>
                                        <div style={{
                                            padding: '10px 14px', background: 'var(--color-bg-surface2)',
                                            borderRadius: 8, border: '1px solid var(--color-stroke-subtle)',
                                            display: 'flex', flexDirection: 'column', gap: 6,
                                        }}>
                                            {task.inputs.map((inp: { label: string; value: string }, i: number) => (
                                                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 12, alignItems: 'flex-start' }}>
                                                    <span style={{ fontWeight: 700, color: 'var(--color-text-muted)', minWidth: 100, flexShrink: 0 }}>{inp.label}</span>
                                                    <span style={{ color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>{inp.value}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ═══ SECTION 6: DEPENDENCIES ═══ */}
                                {taskDepNames.length > 0 && (
                                    <div style={{ marginBottom: 20 }}>
                                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 10 }}>
                                            🔗 Dependencies
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap' as const, gap: 6 }}>
                                            {taskDepNames.map((name, i) => (
                                                <span key={i} className="id-dep-chip">{name}</span>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* ═══ SECTION 7: GOVERNANCE FLAGS ═══ */}
                                <div style={{
                                    display: 'grid', gridTemplateColumns: task.revisionCount > 0 ? '1fr 1fr 1fr' : '1fr 1fr',
                                    gap: 10, marginBottom: 20,
                                }}>
                                    <div style={{
                                        padding: '10px 14px', background: 'var(--color-bg-surface2)',
                                        borderRadius: 8, border: '1px solid var(--color-stroke-subtle)',
                                    }}>
                                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>Pre-Run Gate</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: task.requiresApprovalBeforeRun ? 'var(--color-state-warning)' : 'var(--color-state-success)' }}>
                                            {task.requiresApprovalBeforeRun ? '🔒 Approval Required' : '✓ Auto-execute'}
                                        </div>
                                    </div>
                                    <div style={{
                                        padding: '10px 14px', background: 'var(--color-bg-surface2)',
                                        borderRadius: 8, border: '1px solid var(--color-stroke-subtle)',
                                    }}>
                                        <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>Post-Run Gate</div>
                                        <div style={{ fontSize: 12, fontWeight: 700, color: task.requiresApprovalAfterRun ? 'var(--color-state-warning)' : 'var(--color-state-success)' }}>
                                            {task.requiresApprovalAfterRun ? '🔒 Validation Required' : '✓ Auto-validate'}
                                        </div>
                                    </div>
                                    {task.revisionCount > 0 && (
                                        <div style={{
                                            padding: '10px 14px', background: 'var(--color-bg-surface2)',
                                            borderRadius: 8, border: '1px solid var(--color-stroke-subtle)',
                                        }}>
                                            <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 4 }}>Revisions</div>
                                            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-state-error)' }}>
                                                {task.revisionCount} revision{task.revisionCount !== 1 ? 's' : ''}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {task.dueTarget && (
                                    <div style={{ marginBottom: 16 }}>
                                        <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 4 }}>📅 Due Date</div>
                                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                            {new Date(task.dueTarget).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                                        </div>
                                    </div>
                                )}

                                <hr className="boardroom-review-divider" />

                                {/* ── Output Section (after execution) ── */}
                                {task.outputSummary && (
                                    <>
                                        <hr className="boardroom-review-divider" />
                                        <div className="boardroom-review-section">
                                            <span className="boardroom-review-label">Output</span>
                                            <div
                                                className="boardroom-artifact-content"
                                                dangerouslySetInnerHTML={{ __html: renderBoardroomMarkdown(task.outputSummary) }}
                                            />
                                        </div>
                                    </>
                                )}

                                {taskArtifacts.length > 0 && (
                                    <div className="boardroom-review-section">
                                        <span className="boardroom-review-label">Artifacts ({taskArtifacts.length})</span>
                                        {taskArtifacts.filter(a => a.artifactType !== 'image').map(artifact => (
                                            <div key={artifact.id} className="boardroom-artifact-card">
                                                <div className="boardroom-artifact-card-header">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                                        <div style={{ fontSize: 14, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.02em' }}>{artifact.title}</div>
                                                        <div className="boardroom-artifact-card-type">
                                                            {artifact.artifactType.replace(/_/g, ' ').toUpperCase()}
                                                        </div>
                                                    </div>
                                                    {artifact.content && (
                                                        <button
                                                            className="boardroom-artifact-preview-btn"
                                                            onClick={() => setPreviewArtifact(artifact)}
                                                        >
                                                            <Eye size={13} /> Preview
                                                        </button>
                                                    )}
                                                </div>
                                                {artifact.content && (
                                                    <div
                                                        className="boardroom-artifact-content"
                                                        dangerouslySetInnerHTML={{ __html: renderBoardroomMarkdown(artifact.content) }}
                                                    />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* ── Interactive Image Viewer ── */}
                                <ImageViewer
                                    artifacts={taskArtifacts}
                                    initiativeId={id as string}
                                    taskId={task.id}
                                    taskTitle={task.title}
                                    taskDescription={task.description}
                                    onRefresh={loadData}
                                />

                                <hr className="boardroom-review-divider" />

                                {/* Actions */}
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button className="id-btn id-btn-secondary" onClick={() => setViewingTask(null)}>
                                        Close
                                    </button>
                                    {(task.status === 'APPROVED_TO_RUN' || task.status === 'READY_FOR_REVIEW') && (
                                        <button
                                            className="id-btn id-btn-primary"
                                            onClick={() => task.status === 'APPROVED_TO_RUN' ? handleTaskExecute(task.id) : handleApproveToRun(task.id)}
                                            disabled={!!executingTask}
                                        >
                                            {executingTask === task.id ? <Loader2 size={14} className="spin" /> : task.status === 'APPROVED_TO_RUN' ? <Brain size={14} /> : <Check size={14} />}
                                            {executingTask === task.id ? 'Working...' : task.status === 'APPROVED_TO_RUN' ? 'Execute Task' : 'Approve to Run'}
                                        </button>
                                    )}
                                    {task.status === 'OUTPUT_READY' && (
                                        <>
                                            <button
                                                className="id-btn id-btn-secondary"
                                                onClick={() => handleTaskValidate(task.id, 'rerun')}
                                                disabled={!!executingTask}
                                            >
                                                {executingTask === task.id ? <Loader2 size={14} className="spin" /> : <Brain size={14} />}
                                                Re-run
                                            </button>
                                            <button
                                                className="id-btn id-btn-secondary"
                                                onClick={() => handleTaskValidate(task.id, 'revise')}
                                            >
                                                Request Revision
                                            </button>
                                            <button
                                                className="id-btn id-btn-primary"
                                                style={{ background: '#22c55e', borderColor: '#22c55e' }}
                                                onClick={() => { handleTaskValidate(task.id, 'approve'); setViewingTask(null); }}
                                            >
                                                <Check size={14} /> Validate Output
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── Workstreams Tab ── */}
            {activeTab === 'workstreams' && (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
                    {workstreams.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', border: '2px solid var(--color-stroke-subtle)', background: 'var(--color-bg-base)' }}>
                            No workstreams defined.
                        </div>
                    ) : (
                        workstreams.map((ws, i) => {
                            const wsTasks = tasks.filter(t => t.workstreamId === ws.id);
                            const wsDone = wsTasks.filter(t => t.status === 'VALIDATED').length;
                            const wsProgress = wsTasks.length > 0 ? Math.round((wsDone / wsTasks.length) * 100) : 0;

                            return (
                                <div key={ws.id} style={{
                                    border: '2px solid var(--color-stroke-subtle)',
                                    background: 'var(--color-bg-base)',
                                    padding: '16px 20px',
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
                                        <span style={{ fontSize: 20, fontWeight: 900, color: 'var(--color-accent-primary)', minWidth: 30, fontVariantNumeric: 'tabular-nums' }}>
                                            {i + 1}
                                        </span>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontSize: 13, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.02em' }}>{ws.title}</div>
                                            {ws.description && (
                                                <div style={{ fontSize: 11, color: 'var(--color-text-muted)', marginTop: 2 }}>{ws.description}</div>
                                            )}
                                        </div>
                                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-text-muted)' }}>
                                            {wsDone}/{wsTasks.length} • {wsProgress}%
                                        </span>
                                    </div>
                                    <div className="boardroom-progress-track" style={{ height: 4 }}>
                                        <div className="boardroom-progress-bar" style={{ width: `${wsProgress}%` }} />
                                    </div>
                                    {wsTasks.length > 0 && (
                                        <div style={{ marginTop: 10, paddingLeft: 42 }}>
                                            {wsTasks.map(t => (
                                                <div key={t.id} style={{
                                                    display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0',
                                                    fontSize: 11, color: 'var(--color-text-secondary)',
                                                    cursor: 'pointer', borderRadius: 6, transition: 'background 0.15s',
                                                }}
                                                    onClick={() => setViewingTask(t.id)}
                                                    onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
                                                    onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
                                                >
                                                    {t.status === 'VALIDATED' ? <CheckCircle2 size={12} color="#22c55e" /> : <Clock size={12} />}
                                                    <span style={{ fontWeight: 600, flex: 1 }}>{t.title}</span>
                                                    <span className="boardroom-status-badge" style={{
                                                        color: TASK_STATUS_COLORS[t.status],
                                                        borderColor: TASK_STATUS_COLORS[t.status],
                                                        background: `${TASK_STATUS_COLORS[t.status]}08`,
                                                        fontSize: 8, padding: '2px 6px',
                                                    }}>
                                                        {TASK_STATUS_LABELS[t.status]}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ── Approvals Tab ── */}
            {activeTab === 'approvals' && (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                    {approvals.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', border: '2px solid var(--color-stroke-subtle)', background: 'var(--color-bg-base)' }}>
                            No approval gates.
                        </div>
                    ) : (
                        approvals.map(approval => {
                            const relatedTask = approval.taskId ? tasks.find(t => t.id === approval.taskId) : null;
                            return (
                                <div key={approval.id} style={{
                                    border: '2px solid var(--color-stroke-subtle)',
                                    background: 'var(--color-bg-base)',
                                    padding: '14px 20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                    gap: 16,
                                }}>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700 }}>{approval.title}</div>
                                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
                                            {APPROVAL_GATE_LABELS[approval.gateType as ApprovalGateType] || approval.gateType}
                                            {approval.description && ` — ${approval.description}`}
                                        </div>
                                        {approval.decisionNote && (
                                            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 4, fontStyle: 'italic' }}>
                                                Note: {approval.decisionNote}
                                            </div>
                                        )}
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        {approval.status === 'PENDING' ? (
                                            <>
                                                <button
                                                    className="id-btn id-btn-secondary"
                                                    onClick={() => openApprovalView(approval.id)}
                                                >
                                                    <FileText size={12} /> View
                                                </button>
                                                <button
                                                    className="id-btn id-btn-primary"
                                                    onClick={() => handleApprovalAction(approval.id, 'approve')}
                                                    disabled={!!actionLoading}
                                                >
                                                    {actionLoading === approval.id ? <Loader2 size={12} className="spin" /> : <Check size={12} />}
                                                    Approve
                                                </button>
                                                <button
                                                    className="id-btn id-btn-danger"
                                                    onClick={() => handleApprovalAction(approval.id, 'reject')}
                                                    disabled={!!actionLoading}
                                                >
                                                    <X size={12} /> Reject
                                                </button>
                                            </>
                                        ) : (
                                            <span className="boardroom-status-badge" style={{
                                                color: approval.status === 'APPROVED' ? '#22c55e' : approval.status === 'REJECTED' ? '#ef4444' : '#f59e0b',
                                                borderColor: approval.status === 'APPROVED' ? '#22c55e' : approval.status === 'REJECTED' ? '#ef4444' : '#f59e0b',
                                                background: approval.status === 'APPROVED' ? 'rgba(34,197,94,0.06)' : approval.status === 'REJECTED' ? 'rgba(239,68,68,0.06)' : 'rgba(245,158,11,0.06)',
                                            }}>
                                                {approval.status}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>
            )}

            {/* ── Approval Detail Modal ── */}
            {viewingApproval && (() => {
                const approval = approvals.find(a => a.id === viewingApproval);
                if (!approval) return null;
                const relatedTask = approval.taskId ? tasks.find(t => t.id === approval.taskId) : null;
                const relatedArtifacts = artifacts.filter(a => a.taskId === approval.taskId);

                return (
                    <div className="boardroom-plan-overlay" onClick={() => setViewingApproval(null)}>
                        <div
                            style={{ width: '90%', maxWidth: 720, maxHeight: '85vh', display: 'flex', flexDirection: 'column', margin: '60px auto' }}
                            onClick={e => e.stopPropagation()}
                        >
                            {/* Modal Header */}
                            <div style={{
                                background: 'var(--color-bg-base)',
                                border: '2px solid var(--color-stroke-subtle)',
                                borderBottom: 'none',
                                padding: '16px 24px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                            }}>
                                <div>
                                    <div style={{ fontSize: 9, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: '#f59e0b', marginBottom: 4 }}>
                                        Review Before Decision
                                    </div>
                                    <div style={{ fontSize: 16, fontWeight: 900, textTransform: 'uppercase' as const, letterSpacing: '0.02em' }}>
                                        {approval.title}
                                    </div>
                                </div>
                                <button
                                    onClick={() => setViewingApproval(null)}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, color: 'var(--color-text-muted)', padding: 4 }}
                                >
                                    ×
                                </button>
                            </div>

                            {/* Modal Body */}
                            <div style={{
                                background: 'var(--color-bg-base)',
                                border: '2px solid var(--color-stroke-subtle)',
                                borderTop: '1px solid var(--color-stroke-subtle)',
                                flex: 1,
                                overflow: 'auto',
                                padding: '20px 24px',
                                display: 'flex',
                                flexDirection: 'column',
                                gap: 16,
                            }}>
                                {/* Gate Info */}
                                <div className="boardroom-review-section">
                                    <span className="boardroom-review-label">Approval Gate</span>
                                    <div className="boardroom-review-value">
                                        {APPROVAL_GATE_LABELS[approval.gateType as ApprovalGateType] || approval.gateType}
                                        {approval.description && ` — ${approval.description}`}
                                    </div>
                                </div>

                                {/* Related Task */}
                                {relatedTask && (
                                    <div className="boardroom-review-section">
                                        <span className="boardroom-review-label">Related Task</span>
                                        <div className="boardroom-review-task">
                                            <div className="boardroom-review-task-body">
                                                <div className="boardroom-review-task-title">{relatedTask.title}</div>
                                                {relatedTask.description && (
                                                    <div style={{ fontSize: 12, color: 'var(--color-text-secondary)', marginTop: 4, lineHeight: 1.6 }}>
                                                        {relatedTask.description}
                                                    </div>
                                                )}
                                                <div className="boardroom-review-task-meta" style={{ marginTop: 6 }}>
                                                    <span><strong>Assigned to:</strong> {relatedTask.assignedBrainName || relatedTask.assignedBrainType?.replace(/_/g, ' ') || 'Unassigned'}</span>
                                                    {relatedTask.requiredSkill && <span><strong>Skill:</strong> {relatedTask.requiredSkill}</span>}
                                                    <span><strong>Status:</strong> {TASK_STATUS_LABELS[relatedTask.status]}</span>
                                                </div>
                                                {relatedTask.outputSummary && (
                                                    <div style={{ marginTop: 8, padding: 10, background: 'var(--color-bg-surface)', border: '1px solid var(--color-stroke-subtle)', fontSize: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap' as const }}>
                                                        {relatedTask.outputSummary}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* No task - show plan-level info */}
                                {!relatedTask && initiative && (
                                    <div className="boardroom-review-section">
                                        <span className="boardroom-review-label">Initiative Context</span>
                                        <div className="boardroom-review-value">{initiative.planSummary || initiative.objective}</div>
                                    </div>
                                )}

                                {/* Related Artifacts */}
                                {relatedArtifacts.length > 0 && (
                                    <div className="boardroom-review-section">
                                        <span className="boardroom-review-label">Artifacts ({relatedArtifacts.length})</span>
                                        {relatedArtifacts.map(artifact => (
                                            <div key={artifact.id} style={{
                                                padding: '10px 14px',
                                                border: '1px solid var(--color-stroke-subtle)',
                                                background: 'var(--color-bg-surface)',
                                                marginTop: 4,
                                            }}>
                                                <div style={{ fontSize: 12, fontWeight: 700 }}>{artifact.title}</div>
                                                <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
                                                    {artifact.artifactType.replace(/_/g, ' ').toUpperCase()}
                                                </div>
                                                {artifact.content && (
                                                    <div style={{ marginTop: 8, fontSize: 12, lineHeight: 1.6, maxHeight: 150, overflow: 'auto', whiteSpace: 'pre-wrap' as const }}>
                                                        {artifact.content}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                <hr className="boardroom-review-divider" />

                                {/* Company DNA Chat */}
                                <div className="boardroom-review-section">
                                    <span className="boardroom-review-label">
                                        <Brain size={12} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                                        Discuss with Company DNA
                                    </span>

                                    {approvalChat.length === 0 ? (
                                        <div style={{ padding: '16px 0', textAlign: 'center', fontSize: 12, color: 'var(--color-text-muted)' }}>
                                            <MessageCircle size={18} style={{ marginBottom: 6, opacity: 0.4 }} />
                                            <div>Ask about this approval gate, its scope, risks, or impact.</div>
                                        </div>
                                    ) : (
                                        <div style={{ maxHeight: 200, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10, padding: '8px 0' }}>
                                            {approvalChat.map((msg, i) => (
                                                <div key={i} className="boardroom-chat-msg">
                                                    <div className={`boardroom-chat-msg-avatar ${msg.role === 'user' ? 'user' : 'system'}`}>
                                                        {msg.role === 'user' ? 'Y' : <Brain size={12} />}
                                                    </div>
                                                    <div className="boardroom-chat-msg-body">
                                                        <div className="boardroom-chat-msg-name">
                                                            {msg.role === 'user' ? 'You' : 'Company DNA'}
                                                        </div>
                                                        <div className="boardroom-chat-msg-text">{msg.content}</div>
                                                    </div>
                                                </div>
                                            ))}
                                            {approvalChatLoading && (
                                                <div className="boardroom-chat-msg">
                                                    <div className="boardroom-chat-msg-avatar system"><Brain size={12} /></div>
                                                    <div className="boardroom-chat-msg-body">
                                                        <div className="boardroom-chat-msg-name">Company DNA</div>
                                                        <div className="boardroom-chat-msg-text" style={{ color: 'var(--color-text-muted)' }}>Analyzing...</div>
                                                    </div>
                                                </div>
                                            )}
                                            <div ref={approvalChatEndRef} />
                                        </div>
                                    )}

                                    <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                                        <input
                                            ref={approvalChatInputRef}
                                            className="boardroom-chat-input"
                                            type="text"
                                            placeholder="Ask about this approval..."
                                            value={approvalChatInput}
                                            onChange={e => setApprovalChatInput(e.target.value)}
                                            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendApprovalChat(); } }}
                                            disabled={approvalChatLoading}
                                        />
                                        <button
                                            className="id-btn id-btn-primary"
                                            onClick={sendApprovalChat}
                                            disabled={approvalChatLoading || !approvalChatInput.trim()}
                                        >
                                            {approvalChatLoading ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                                        </button>
                                    </div>
                                </div>

                                <hr className="boardroom-review-divider" />

                                {/* Decision Buttons */}
                                <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                                    <button
                                        className="id-btn id-btn-secondary"
                                        onClick={() => setViewingApproval(null)}
                                    >
                                        Close
                                    </button>
                                    <button
                                        className="id-btn id-btn-danger"
                                        onClick={() => { handleApprovalAction(approval.id, 'reject'); setViewingApproval(null); }}
                                        disabled={!!actionLoading}
                                    >
                                        <X size={14} /> Reject
                                    </button>
                                    <button
                                        className="id-btn id-btn-primary"
                                        onClick={() => { handleApprovalAction(approval.id, 'approve'); setViewingApproval(null); }}
                                        disabled={!!actionLoading}
                                    >
                                        {actionLoading === approval.id ? <Loader2 size={14} className="spin" /> : <Check size={14} />}
                                        Approve
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* ── Artifacts Tab ── */}
            {activeTab === 'artifacts' && (
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 6 }}>
                    {artifacts.length === 0 ? (
                        <div style={{ padding: 32, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)', border: '2px solid var(--color-stroke-subtle)', background: 'var(--color-bg-base)' }}>
                            No artifacts yet. Artifacts will be generated as tasks are executed.
                        </div>
                    ) : (
                        artifacts.map(artifact => (
                            <div key={artifact.id} style={{
                                border: '2px solid var(--color-stroke-subtle)',
                                background: 'var(--color-bg-base)',
                                padding: '14px 20px',
                            }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                                    <div>
                                        <div style={{ fontSize: 12, fontWeight: 700 }}>{artifact.title}</div>
                                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 2 }}>
                                            {artifact.artifactType.replace(/_/g, ' ').toUpperCase()} • {new Date(artifact.createdAt).toLocaleDateString()}
                                        </div>
                                    </div>
                                    <span className="boardroom-status-badge" style={{
                                        color: artifact.status === 'APPROVED' ? '#22c55e' : '#94a3b8',
                                        borderColor: artifact.status === 'APPROVED' ? '#22c55e' : '#94a3b8',
                                    }}>
                                        {artifact.status}
                                    </span>
                                </div>
                                {artifact.content && (
                                    <div style={{
                                        marginTop: 10, padding: 12,
                                        background: 'var(--color-bg-surface)',
                                        border: '1px solid var(--color-stroke-subtle)',
                                        fontSize: 12,
                                        lineHeight: 1.6,
                                        maxHeight: 200,
                                        overflow: 'auto',
                                        whiteSpace: 'pre-wrap' as const,
                                    }}>
                                        {artifact.content}
                                    </div>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* ── Activity Log Tab ── */}
            {activeTab === 'activity' && (
                <div style={{
                    border: '2px solid var(--color-stroke-subtle)',
                    background: 'var(--color-bg-base)',
                    padding: '16px 20px',
                }}>
                    {events.length === 0 ? (
                        <div style={{ padding: 16, textAlign: 'center', fontSize: 13, color: 'var(--color-text-muted)' }}>
                            No activity yet.
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 0 }}>
                            {events.map(event => (
                                <div key={event.id} style={{
                                    display: 'flex',
                                    gap: 12,
                                    padding: '10px 0',
                                    borderBottom: '1px solid var(--color-stroke-subtle)',
                                }}>
                                    <div style={{
                                        width: 24, height: 24, flexShrink: 0,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: event.actorType === 'system' ? 'var(--color-accent-primary)' : 'var(--color-stroke-subtle)',
                                        color: event.actorType === 'system' ? '#fff' : 'var(--color-text-muted)',
                                        fontSize: 10, fontWeight: 800,
                                    }}>
                                        {event.actorType === 'system' ? <Brain size={12} /> : event.actorLabel?.[0]?.toUpperCase() || '•'}
                                    </div>
                                    <div style={{ flex: 1 }}>
                                        <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-primary)' }}>
                                            <strong>{event.actorLabel || 'System'}</strong>
                                            <span style={{ fontWeight: 400, color: 'var(--color-text-muted)', marginLeft: 6 }}>
                                                {event.action.replace(/_/g, ' ')}
                                            </span>
                                        </div>
                                        {event.description && (
                                            <div style={{ fontSize: 11, color: 'var(--color-text-secondary)', marginTop: 2 }}>
                                                {event.description}
                                            </div>
                                        )}
                                        <div style={{ fontSize: 10, color: 'var(--color-text-muted)', marginTop: 4 }}>
                                            {new Date(event.createdAt).toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ── Plan Summary Section ── */}
            {initiative.planSummary && (
                <div style={{
                    border: '2px solid var(--color-stroke-subtle)',
                    background: 'var(--color-bg-base)',
                    padding: '16px 20px',
                    marginTop: 16,
                }}>
                    <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--color-text-muted)', marginBottom: 8 }}>
                        Plan Summary
                    </div>
                    <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 0 }}>
                        {initiative.planSummary}
                    </p>
                </div>
            )}

            {/* ── Delete Confirmation Modal ── */}
            {showDeleteConfirm && (
                <div className="boardroom-plan-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div
                        className="boardroom-generating-card"
                        style={{ maxWidth: 420, marginTop: 120 }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="boardroom-generating-header">
                            <div className="boardroom-generating-header-icon" style={{ background: '#ef4444' }}>
                                <Trash2 size={16} />
                            </div>
                            <span className="boardroom-generating-header-text">Delete Initiative</span>
                        </div>
                        <div style={{ padding: '24px' }}>
                            <p style={{ fontSize: 13, color: 'var(--color-text-primary)', lineHeight: 1.6, margin: '0 0 6px' }}>
                                Are you sure you want to delete this initiative?
                            </p>
                            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', lineHeight: 1.5, margin: '0 0 20px' }}>
                                This will permanently remove the initiative, all tasks, workstreams, approvals, artifacts, and activity logs. This action cannot be undone.
                            </p>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                                <button
                                    className="id-btn id-btn-secondary"
                                    onClick={() => setShowDeleteConfirm(false)}
                                    disabled={isDeleting}
                                >
                                    Cancel
                                </button>
                                <button
                                    className="id-btn id-btn-danger"
                                    onClick={handleDelete}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                                    {isDeleting ? 'Deleting...' : 'Delete Initiative'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            {/* ═══ Fullscreen Artifact Preview ═══ */}
            {previewArtifact && (
                <div className="boardroom-preview-overlay" onClick={() => setPreviewArtifact(null)}>
                    <div className="boardroom-preview-modal" onClick={e => e.stopPropagation()}>
                        <div className="boardroom-preview-bar">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
                                <Eye size={16} style={{ color: 'var(--color-accent-primary)', flexShrink: 0 }} />
                                <span style={{ fontWeight: 900, fontSize: 14, textTransform: 'uppercase' as const, letterSpacing: '0.02em' }}>
                                    {previewArtifact.title}
                                </span>
                                <span className="boardroom-artifact-card-type">
                                    {previewArtifact.artifactType.replace(/_/g, ' ').toUpperCase()}
                                </span>
                            </div>
                            <button
                                className="boardroom-artifact-preview-btn"
                                onClick={() => setPreviewArtifact(null)}
                                style={{ flexShrink: 0 }}
                            >
                                <Minimize2 size={13} /> Close
                            </button>
                        </div>
                        <div className="boardroom-preview-body">
                            {previewArtifact.content && (
                                <div
                                    className="boardroom-artifact-content"
                                    style={{ maxHeight: 'none', border: 'none', padding: '32px 40px' }}
                                    dangerouslySetInnerHTML={{ __html: renderBoardroomMarkdown(previewArtifact.content) }}
                                />
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* ═══ Delete Confirmation Dialog ═══ */}
            {showDeleteConfirm && (
                <div className="boardroom-plan-overlay" onClick={() => setShowDeleteConfirm(false)}>
                    <div
                        className="boardroom-plan-card"
                        style={{ maxWidth: 440, margin: '120px auto' }}
                        onClick={e => e.stopPropagation()}
                    >
                        <div className="boardroom-plan-header">
                            <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, margin: 0 }}>
                                <AlertTriangle size={16} color="#ef4444" /> Delete Initiative
                            </h3>
                            <button onClick={() => setShowDeleteConfirm(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-muted)', padding: 4 }}>
                                <X size={16} />
                            </button>
                        </div>
                        <div className="boardroom-plan-body">
                            <p style={{ fontSize: 13, color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: '0 0 8px' }}>
                                Are you sure you want to delete <strong style={{ color: 'var(--color-text-primary)' }}>{initiative.title}</strong>?
                            </p>
                            <p style={{ fontSize: 12, color: 'var(--color-text-muted)', margin: 0 }}>
                                This will permanently remove all tasks, workstreams, artifacts, and activity logs. This action cannot be undone.
                            </p>
                        </div>
                        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                            <button className="id-btn id-btn-secondary" onClick={() => setShowDeleteConfirm(false)}>
                                Cancel
                            </button>
                            <button
                                className="id-btn id-btn-danger"
                                onClick={handleDelete}
                                disabled={isDeleting}
                            >
                                {isDeleting ? <Loader2 size={14} className="spin" /> : <Trash2 size={14} />}
                                {isDeleting ? 'Deleting...' : 'Delete Initiative'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
