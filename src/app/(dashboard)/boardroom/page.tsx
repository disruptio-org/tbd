'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
    Compass, Send, Loader2,
    Clock, Pause,
    FileText, Brain,
} from 'lucide-react';
import {
    INITIATIVE_STATUS_LABELS,
    INITIATIVE_STATUS_COLORS,
    PRIORITY_COLORS,
    WORK_TYPE_LABELS,
} from '@/lib/boardroom/constants';
import type { InitiativeStatus, WorkType } from '@/lib/boardroom/constants';
import './boardroom.css';

/* ─── Types ────────────────────────────────────────────── */

interface InitiativeRow {
    id: string;
    title: string;
    objective: string;
    status: InitiativeStatus;
    priority: string;
    workType: string | null;
    projectId: string | null;
    projectName: string | null;
    taskCount: number;
    completedTaskCount: number;
    progress: number;
    teamBrainTypes: string[];
    pendingApprovals: number;
    confidenceScore: number | null;
    createdAt: string;
    updatedAt: string;
}

interface Summary {
    total: number;
    planDraft: number;
    planInReview: number;
    planRevision: number;
    planApproved: number;
    readyForExecution: number;
    inProgress: number;
    waitingHumanInput: number;
    reviewReady: number;
    completed: number;
    cancelled: number;
}

/* ─── Helpers ──────────────────────────────────────────── */

function getBrainInitials(brainType: string): string {
    return brainType.replace(/^CUSTOM_/, '').split('_').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

const BRAIN_COLORS: Record<string, string> = {
    MARKETING: '#8b5cf6',
    SALES: '#ef4444',
    PRODUCT_ASSISTANT: '#2563eb',
    COMPANY: '#111111',
};

function getBrainColor(brainType: string): string {
    return BRAIN_COLORS[brainType] || '#64748b';
}

const SUGGESTION_COMMANDS = [
    'Create a website for this project',
    'Launch a LinkedIn campaign',
    'Find 10 top-fit leads',
    'Write product documentation',
    'Design and implement a new feature',
];

/* ─── Main Page ────────────────────────────────────────── */

export default function BoardroomPage() {
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [initiatives, setInitiatives] = useState<InitiativeRow[]>([]);
    const [summary, setSummary] = useState<Summary | null>(null);
    const [pendingApprovals, setPendingApprovals] = useState(0);

    const [command, setCommand] = useState('');
    const [isPlanning, setIsPlanning] = useState(false);
    const [planningStep, setPlanningStep] = useState(0);
    const [planningElapsed, setPlanningElapsed] = useState(0);
    const planningTimer = useRef<ReturnType<typeof setInterval> | null>(null);

    const [projects, setProjects] = useState<{ id: string; name: string }[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    // Pre-planning questionnaire
    interface ClarifyQuestion {
        id: string;
        label: string;
        question: string;
        placeholder: string;
        required: boolean;
    }
    const [showQuestionnaire, setShowQuestionnaire] = useState(false);
    const [clarifyQuestions, setClarifyQuestions] = useState<ClarifyQuestion[]>([]);
    const [clarifyAnswers, setClarifyAnswers] = useState<Record<string, string>>({});
    const [isClarifying, setIsClarifying] = useState(false);

    /* ─── Data Loading ─────────────────────────────────── */

    const loadSummary = useCallback(async () => {
        try {
            const res = await fetch('/api/boardroom/summary');
            const data = await res.json();
            setSummary(data.summary);
            setPendingApprovals(data.pendingApprovals || 0);
        } catch { /* ignore */ }
    }, []);

    const loadInitiatives = useCallback(async () => {
        try {
            const res = await fetch('/api/boardroom/initiatives');
            const data = await res.json();
            setInitiatives(data.initiatives || []);
        } catch { /* ignore */ }
    }, []);

    const loadProjects = useCallback(async () => {
        try {
            const res = await fetch('/api/projects');
            const data = await res.json();
            setProjects(data.projects || []);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await Promise.all([loadSummary(), loadInitiatives(), loadProjects()]);
            setLoading(false);
        })();
    }, [loadSummary, loadInitiatives, loadProjects]);

    /* ─── Command Execution ────────────────────────────── */

    async function handleCommand() {
        if (!command.trim() || isPlanning || isClarifying) return;

        // Step 1: Get clarifying questions
        setIsClarifying(true);
        try {
            const res = await fetch('/api/boardroom/clarify', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: command.trim(),
                    projectId: selectedProjectId || null,
                }),
            });
            const data = await res.json();
            if (res.ok && data.questions?.length > 0) {
                setClarifyQuestions(data.questions);
                setClarifyAnswers({});
                setShowQuestionnaire(true);
            } else {
                // No questions or error — proceed directly
                await executePlan();
            }
        } catch (error) {
            console.error('[boardroom] Clarify error:', error);
            await executePlan(); // Fallback: plan without questions
        }
        setIsClarifying(false);
    }

    async function executePlan(answers?: { label: string; question: string; answer: string }[]) {
        setShowQuestionnaire(false);
        setIsPlanning(true);
        setPlanningStep(0);
        setPlanningElapsed(0);

        const stepInterval = setInterval(() => {
            setPlanningStep(prev => (prev < 4 ? prev + 1 : prev));
        }, 2200);
        const timeInterval = setInterval(() => {
            setPlanningElapsed(prev => prev + 1);
        }, 1000);
        planningTimer.current = stepInterval;

        try {
            const res = await fetch('/api/boardroom/command', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    command: command.trim(),
                    projectId: selectedProjectId || null,
                    clarificationAnswers: answers || null,
                }),
            });
            const data = await res.json();
            if (res.ok && data.planDraftId) {
                router.push(`/boardroom/draft/${data.planDraftId}`);
            } else {
                console.error('[boardroom] Command error:', data.error);
            }
        } catch (error) {
            console.error('[boardroom] Command error:', error);
        }

        clearInterval(stepInterval);
        clearInterval(timeInterval);
        planningTimer.current = null;
        setIsPlanning(false);
    }

    function handleSubmitClarifications() {
        const answers = clarifyQuestions
            .filter(q => clarifyAnswers[q.id]?.trim())
            .map(q => ({
                label: q.label,
                question: q.question,
                answer: clarifyAnswers[q.id].trim(),
            }));
        executePlan(answers);
    }

    /* ─── Loading ──────────────────────────────────────── */

    const PLANNING_STEPS = [
        'Interpreting command',
        'Classifying work type',
        'Identifying team members',
        'Building execution plan',
        'Setting approval gates',
    ];

    if (loading) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 64, gap: 16 }}>
                <div style={{ width: 32, height: 32, border: '3px solid var(--color-stroke-subtle)', borderTopColor: 'var(--color-accent-primary)', borderRadius: '0%', animation: 'spin 700ms linear infinite' }} />
                <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--color-text-muted)' }}>Loading Boardroom</span>
            </div>
        );
    }

    /* ─── Render ───────────────────────────────────────── */

    return (
        <div className="boardroom-page">
            {/* ── Executive Command Bar ── */}
            <div className="boardroom-command">
                <div className="boardroom-command-label">
                    <Brain size={12} /> COMMAND COMPANY DNA
                </div>
                <div className="boardroom-command-row">
                    <input
                        className="boardroom-command-input"
                        value={command}
                        onChange={e => setCommand(e.target.value)}
                        placeholder="Tell Company DNA what you need..."
                        onKeyDown={e => { if (e.key === 'Enter') handleCommand(); }}
                        disabled={isPlanning}
                    />
                    {projects.length > 0 && (
                        <select
                            className="boardroom-command-input"
                            style={{ flex: '0 0 200px', fontSize: 12 }}
                            value={selectedProjectId}
                            onChange={e => setSelectedProjectId(e.target.value)}
                        >
                            <option value="">All Projects</option>
                            {projects.map(p => (
                                <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                        </select>
                    )}
                    <button
                        className="boardroom-command-btn"
                        onClick={handleCommand}
                        disabled={!command.trim() || isPlanning || isClarifying}
                    >
                        {isPlanning ? <Loader2 size={14} className="spin" /> : isClarifying ? <Loader2 size={14} className="spin" /> : <Send size={14} />}
                        {isPlanning ? 'PLANNING...' : isClarifying ? 'ANALYZING...' : 'EXECUTE'}
                    </button>
                </div>
                <div className="boardroom-command-suggestions">
                    {SUGGESTION_COMMANDS.map(s => (
                        <button
                            key={s}
                            className="boardroom-suggestion-chip"
                            onClick={() => setCommand(s)}
                        >
                            {s}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Summary Strip ── */}
            {summary && (
                <div className="boardroom-summary-strip">
                    <div className="boardroom-summary-card active">
                        <span className="boardroom-summary-count">{summary.planDraft + summary.planInReview + summary.planRevision}</span>
                        <span className="boardroom-summary-label">Planning</span>
                    </div>
                    <div className={`boardroom-summary-card ${summary.planApproved + summary.readyForExecution > 0 ? 'warning' : ''}`}>
                        <span className="boardroom-summary-count">{summary.planApproved + summary.readyForExecution}</span>
                        <span className="boardroom-summary-label">Ready</span>
                    </div>
                    <div className="boardroom-summary-card active">
                        <span className="boardroom-summary-count">{summary.inProgress}</span>
                        <span className="boardroom-summary-label">Executing</span>
                    </div>
                    <div className={`boardroom-summary-card ${summary.waitingHumanInput > 0 ? 'warning' : ''}`}>
                        <span className="boardroom-summary-count">{summary.waitingHumanInput}</span>
                        <span className="boardroom-summary-label">Waiting On You</span>
                    </div>
                    <div className="boardroom-summary-card success">
                        <span className="boardroom-summary-count">{summary.completed}</span>
                        <span className="boardroom-summary-label">Completed</span>
                    </div>
                    <div className={`boardroom-summary-card ${summary.reviewReady > 0 ? 'warning' : ''}`}>
                        <span className="boardroom-summary-count">{summary.reviewReady}</span>
                        <span className="boardroom-summary-label">Review Ready</span>
                    </div>
                </div>
            )}

            {/* ── Initiative List ── */}
            <div className="boardroom-section-header">
                <h3 className="boardroom-section-title">
                    <FileText size={16} /> Initiatives
                </h3>
                {pendingApprovals > 0 && (
                    <span style={{ fontSize: 11, fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                        {pendingApprovals} approval{pendingApprovals !== 1 ? 's' : ''} pending
                    </span>
                )}
            </div>

            {initiatives.length === 0 ? (
                <div className="boardroom-empty">
                    <Compass size={48} className="boardroom-empty-icon" />
                    <div className="boardroom-empty-title">No Initiatives Yet</div>
                    <div className="boardroom-empty-desc">
                        Use the command bar above to tell Company DNA what you need.
                        It will analyze your request, assemble the right team, and create a governed execution plan.
                    </div>
                </div>
            ) : (
                <div className="boardroom-initiative-list">
                    {initiatives.map(init => {
                        const statusColor = INITIATIVE_STATUS_COLORS[init.status] || '#94a3b8';
                        const priorityColor = PRIORITY_COLORS[init.priority as keyof typeof PRIORITY_COLORS] || '#94a3b8';
                        const nextAction = init.pendingApprovals > 0
                            ? `${init.pendingApprovals} approval${init.pendingApprovals !== 1 ? 's' : ''} needed`
                            : init.status === 'WAITING_HUMAN_INPUT'
                            ? 'Needs your input'
                            : init.status === 'IN_PROGRESS'
                            ? `${init.completedTaskCount}/${init.taskCount} tasks done`
                            : init.status === 'READY_FOR_EXECUTION'
                            ? 'Ready to start'
                            : INITIATIVE_STATUS_LABELS[init.status];

                        return (
                            <div
                                key={init.id}
                                className="boardroom-initiative-row"
                                onClick={() => router.push(`/boardroom/${init.id}`)}
                            >
                                <div
                                    className="boardroom-initiative-bar"
                                    style={{ background: priorityColor }}
                                />
                                <div className="boardroom-initiative-main">
                                    <div className="boardroom-initiative-title">{init.title}</div>
                                    <div className="boardroom-initiative-meta">
                                        {init.projectName && (
                                            <span className="boardroom-initiative-project">{init.projectName}</span>
                                        )}
                                        {init.workType && (
                                            <span className="boardroom-initiative-worktype">
                                                {WORK_TYPE_LABELS[init.workType as WorkType] || init.workType}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <span
                                    className="boardroom-status-badge"
                                    style={{ color: statusColor, borderColor: statusColor, background: `${statusColor}08` }}
                                >
                                    {INITIATIVE_STATUS_LABELS[init.status]}
                                </span>
                                <div className="boardroom-progress">
                                    <div className="boardroom-progress-track">
                                        <div className="boardroom-progress-bar" style={{ width: `${init.progress}%` }} />
                                    </div>
                                    <span className="boardroom-progress-text">{init.progress}%</span>
                                </div>
                                <div className="boardroom-team">
                                    {init.teamBrainTypes.slice(0, 4).map((bt, i) => (
                                        <span
                                            key={i}
                                            className="boardroom-team-avatar"
                                            style={{ background: getBrainColor(bt) }}
                                            title={bt}
                                        >
                                            {getBrainInitials(bt)}
                                        </span>
                                    ))}
                                    {init.teamBrainTypes.length > 4 && (
                                        <span className="boardroom-team-more">+{init.teamBrainTypes.length - 4}</span>
                                    )}
                                </div>
                                <span className={`boardroom-next-action ${init.pendingApprovals > 0 ? 'approval-needed' : ''}`}>
                                    {nextAction}
                                </span>
                            </div>
                        );
                    })}
                </div>
            )}


            {/* ── Pre-Planning Questionnaire Modal ── */}
            {showQuestionnaire && (
                <div className="boardroom-plan-overlay" onClick={() => setShowQuestionnaire(false)}>
                    <div
                        style={{
                            width: '90%', maxWidth: 640, margin: '60px auto',
                            background: 'var(--color-bg-surface)', border: '1px solid var(--color-stroke-subtle)',
                            borderRadius: 'var(--radius-card)', boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
                            animation: 'scaleIn 0.2s ease',
                        }}
                        onClick={e => e.stopPropagation()}
                    >
                        {/* Header */}
                        <div style={{
                            padding: '16px 24px', borderBottom: '1px solid var(--color-stroke-subtle)',
                            display: 'flex', alignItems: 'center', gap: 10,
                        }}>
                            <Brain size={16} style={{ color: 'var(--color-accent-primary)' }} />
                            <div style={{ flex: 1 }}>
                                <div style={{ fontSize: 9, fontWeight: 700, textTransform: 'uppercase' as const, letterSpacing: '0.08em', color: 'var(--color-text-muted)', marginBottom: 2 }}>
                                    Company DNA — Pre-Planning
                                </div>
                                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-primary)' }}>
                                    Before I plan, let me ask a few questions.
                                </div>
                            </div>
                        </div>

                        {/* Command preview */}
                        <div style={{
                            padding: '10px 24px', background: 'var(--color-bg-surface2)',
                            borderBottom: '1px solid var(--color-stroke-subtle)',
                            fontSize: 12, color: 'var(--color-text-secondary)',
                        }}>
                            <span style={{ fontWeight: 700, color: 'var(--color-text-muted)', marginRight: 8, fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Your command:</span>
                            {command}
                        </div>

                        {/* Questions */}
                        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16, maxHeight: '50vh', overflow: 'auto' }}>
                            {clarifyQuestions.map((q, i) => (
                                <div key={q.id}>
                                    <div style={{
                                        fontSize: 11, fontWeight: 700, color: 'var(--color-text-primary)',
                                        marginBottom: 6, display: 'flex', alignItems: 'center', gap: 8,
                                    }}>
                                        <span style={{
                                            fontSize: 9, fontWeight: 800, color: 'var(--color-accent-secondary)',
                                            background: 'rgba(0,212,255,0.1)', padding: '2px 8px',
                                            borderRadius: 999, flexShrink: 0,
                                        }}>
                                            Q{i + 1}
                                        </span>
                                        {q.question}
                                    </div>
                                    <textarea
                                        value={clarifyAnswers[q.id] || ''}
                                        onChange={e => setClarifyAnswers(prev => ({ ...prev, [q.id]: e.target.value }))}
                                        placeholder={q.placeholder || 'Type your answer...'}
                                        rows={2}
                                        style={{
                                            width: '100%', padding: '10px 12px', fontSize: 13,
                                            background: 'var(--color-bg-surface2)', color: 'var(--color-text-primary)',
                                            border: '1px solid var(--color-stroke-subtle)', borderRadius: 8,
                                            fontFamily: 'var(--font-family)', resize: 'vertical',
                                            outline: 'none', transition: 'border-color 0.15s',
                                        }}
                                        onFocus={e => { e.target.style.borderColor = 'var(--color-accent-primary)'; }}
                                        onBlur={e => { e.target.style.borderColor = 'var(--color-stroke-subtle)'; }}
                                    />
                                </div>
                            ))}
                        </div>

                        {/* Actions */}
                        <div style={{
                            padding: '14px 24px', borderTop: '1px solid var(--color-stroke-subtle)',
                            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                        }}>
                            <button
                                onClick={() => { setShowQuestionnaire(false); executePlan(); }}
                                style={{
                                    background: 'transparent', border: '1px solid var(--color-stroke-subtle)',
                                    color: 'var(--color-text-muted)', padding: '8px 16px', borderRadius: 8,
                                    fontSize: 11, fontWeight: 700, cursor: 'pointer',
                                    fontFamily: 'var(--font-family)', textTransform: 'uppercase', letterSpacing: '0.04em',
                                }}
                            >
                                Skip & Plan Directly
                            </button>
                            <button
                                onClick={handleSubmitClarifications}
                                style={{
                                    background: 'var(--color-accent-primary)', border: '1px solid var(--color-accent-primary)',
                                    color: '#fff', padding: '8px 20px', borderRadius: 8,
                                    fontSize: 12, fontWeight: 700, cursor: 'pointer',
                                    fontFamily: 'var(--font-family)', display: 'flex', alignItems: 'center', gap: 6,
                                }}
                            >
                                <Send size={13} />
                                Generate Plan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Planning Overlay ── */}
            {isPlanning && (
                <div className="boardroom-plan-overlay">
                    <div className="boardroom-generating">
                        <div className="boardroom-generating-card">
                            <div className="boardroom-generating-header">
                                <div className="boardroom-generating-header-icon">
                                    <Brain size={16} />
                                </div>
                                <span className="boardroom-generating-header-text">Company DNA</span>
                            </div>

                            <div className="boardroom-generating-body">
                                <div className="boardroom-generating-spinner" />
                                <div className="boardroom-generating-text">
                                    Analyzing your command
                                </div>

                                <div className="boardroom-generating-steps">
                                    {PLANNING_STEPS.map((step, i) => (
                                        <div
                                            key={step}
                                            className={`boardroom-generating-step ${i < planningStep ? 'done' : i === planningStep ? 'active' : ''}`}
                                        >
                                            <div className="boardroom-generating-step-dot" />
                                            {step}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="boardroom-generating-footer">
                                <span className="boardroom-generating-time">
                                    {planningElapsed}s elapsed
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
