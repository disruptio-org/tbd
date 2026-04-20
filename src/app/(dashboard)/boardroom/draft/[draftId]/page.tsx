'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { use } from 'react';
import {
    ArrowLeft, Check, X, Loader2, Brain, Sparkles, ChevronDown, ChevronRight,
    Trash2, Plus, Edit3, RotateCcw, Zap, Hand, Shield, AlertTriangle,
    User, Wrench, FileText, Target, ClipboardList, Link2, Settings,
} from 'lucide-react';
import './plan-editor.css';

/* ─── Types ────────────────────────────────────────── */

interface MemberSkill {
    id: string;
    key: string;
    name: string;
    description: string | null;
}

interface TeamMember {
    id: string;
    name: string;
    brainType: string;
    description: string | null;
    skills: MemberSkill[];
}

interface DraftTask {
    title: string;
    description: string;
    purpose: string;
    workstreamTitle: string;
    assignedMemberId: string;
    assignedMemberName: string;
    assignedBrainType: string;
    selectedSkillId: string;
    selectedSkillName: string;
    deliverables: { type: string; description: string }[];
    acceptanceCriteria: string;
    dependsOnTaskTitles: string[];
    requiresApprovalBeforeRun: boolean;
    requiresApprovalAfterRun: boolean;
    dueTargetDays?: number;
}

interface DraftWorkstream {
    title: string;
    description: string;
}

interface DraftGate {
    gateType: string;
    title: string;
    description: string;
    taskTitle: string | null;
}

interface PlanDraft {
    id: string;
    title: string;
    objective: string;
    successCriteria: string | null;
    businessGoal: string | null;
    requestedOutcome: string | null;
    workType: string | null;
    confidenceScore: number | null;
    planSummary: string | null;
    workstreams: DraftWorkstream[];
    tasks: DraftTask[];
    approvalGates: DraftGate[];
    executionMode: string;
    status: string;
    version: number;
    command: string;
}

/* ─── Plan Editor Page ─────────────────────────────── */

export default function PlanEditorPage({ params }: { params: Promise<{ draftId: string }> }) {
    const { draftId } = use(params);
    const router = useRouter();

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [draft, setDraft] = useState<PlanDraft | null>(null);
    const [members, setMembers] = useState<TeamMember[]>([]);
    const [approving, setApproving] = useState(false);
    const [regenerating, setRegenerating] = useState(false);
    const [regenerateFeedback, setRegenerateFeedback] = useState('');
    const [showRegenerate, setShowRegenerate] = useState(false);
    const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
    const [expandedWorkstreams, setExpandedWorkstreams] = useState<Set<string>>(new Set());
    const [executionMode, setExecutionMode] = useState<'AUTO_CHAIN' | 'MANUAL'>('MANUAL');

    /* ─── Load Data ─────────────────────────────────── */

    const loadDraft = useCallback(async () => {
        try {
            const res = await fetch(`/api/boardroom/plan-drafts/${draftId}`);
            const data = await res.json();
            if (res.ok && data.draft) {
                setDraft(data.draft);
                setExecutionMode(data.draft.executionMode === 'AUTO_CHAIN' ? 'AUTO_CHAIN' : 'MANUAL');
                const wsTitles = new Set<string>((data.draft.workstreams || []).map((ws: DraftWorkstream) => ws.title));
                setExpandedWorkstreams(wsTitles);
            }
        } catch { /* ignore */ }
    }, [draftId]);

    const loadMembers = useCallback(async () => {
        try {
            const res = await fetch('/api/boardroom/members-with-skills');
            const data = await res.json();
            setMembers(data.members || []);
        } catch { /* ignore */ }
    }, []);

    useEffect(() => {
        (async () => {
            setLoading(true);
            await Promise.all([loadDraft(), loadMembers()]);
            setLoading(false);
        })();
    }, [loadDraft, loadMembers]);

    /* ─── Save Draft ────────────────────────────────── */

    async function saveDraft(updates: Partial<PlanDraft>, changeNote?: string) {
        if (!draft) return;
        setSaving(true);
        try {
            const res = await fetch(`/api/boardroom/plan-drafts/${draftId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...updates, _changeNote: changeNote || 'Plan edited' }),
            });
            const data = await res.json();
            if (res.ok && data.draft) setDraft(data.draft);
        } catch (err) {
            console.error('[plan-editor] Save error:', err);
        }
        setSaving(false);
    }

    /* ─── Approve Plan ──────────────────────────────── */

    async function handleApprovePlan() {
        if (!draft || approving) return;
        setApproving(true);
        try {
            const res = await fetch(`/api/boardroom/plan-drafts/${draftId}/approve`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ executionMode }),
            });
            const data = await res.json();
            if (res.ok && data.initiativeId) {
                router.push(`/boardroom/${data.initiativeId}`);
            }
        } catch (err) {
            console.error('[plan-editor] Approve error:', err);
        }
        setApproving(false);
    }

    /* ─── Regenerate Plan ───────────────────────────── */

    async function handleRegenerate() {
        if (!draft || regenerating) return;
        setRegenerating(true);
        try {
            const res = await fetch(`/api/boardroom/plan-drafts/${draftId}/regenerate`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedback: regenerateFeedback }),
            });
            const data = await res.json();
            if (res.ok && data.draft) {
                setDraft(data.draft);
                setShowRegenerate(false);
                setRegenerateFeedback('');
            }
        } catch (err) {
            console.error('[plan-editor] Regenerate error:', err);
        }
        setRegenerating(false);
    }

    /* ─── Task Editing ──────────────────────────────── */

    function updateTask(index: number, updates: Partial<DraftTask>) {
        if (!draft) return;
        const newTasks = [...draft.tasks];
        newTasks[index] = { ...newTasks[index], ...updates };
        setDraft({ ...draft, tasks: newTasks });
    }

    function removeTask(index: number) {
        if (!draft) return;
        const removedTitle = draft.tasks[index].title;
        const newTasks = draft.tasks.filter((_, i) => i !== index);
        // Clean up dependency references
        for (const t of newTasks) {
            t.dependsOnTaskTitles = (t.dependsOnTaskTitles || []).filter(d => d !== removedTitle);
        }
        saveDraft({ tasks: newTasks }, `Removed task: ${removedTitle}`);
    }

    function addTask(workstreamTitle: string) {
        if (!draft) return;
        const newTask: DraftTask = {
            title: `New Task ${draft.tasks.length + 1}`,
            description: '',
            purpose: '',
            workstreamTitle,
            assignedMemberId: '',
            assignedMemberName: '',
            assignedBrainType: '',
            selectedSkillId: '',
            selectedSkillName: '',
            deliverables: [],
            acceptanceCriteria: '',
            dependsOnTaskTitles: [],
            requiresApprovalBeforeRun: true,
            requiresApprovalAfterRun: true,
        };
        const newTasks = [...draft.tasks, newTask];
        setDraft({ ...draft, tasks: newTasks });
        setEditingTaskIndex(newTasks.length - 1);
    }

    function moveTask(index: number, direction: number) {
        if (!draft) return;
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= draft.tasks.length) return;
        const newTasks = [...draft.tasks];
        [newTasks[index], newTasks[newIndex]] = [newTasks[newIndex], newTasks[index]];
        setDraft({ ...draft, tasks: newTasks });
    }

    /* ─── Workstream Editing ────────────────────────── */

    function addWorkstream() {
        if (!draft) return;
        const newWs: DraftWorkstream = {
            title: `Phase ${draft.workstreams.length + 1}`,
            description: '',
        };
        setDraft({ ...draft, workstreams: [...draft.workstreams, newWs] });
        setExpandedWorkstreams(prev => new Set([...prev, newWs.title]));
    }

    function removeWorkstream(index: number) {
        if (!draft) return;
        const title = draft.workstreams[index].title;
        const newWs = draft.workstreams.filter((_, i) => i !== index);
        // Reassign orphaned tasks to first workstream
        const newTasks = draft.tasks.map(t =>
            t.workstreamTitle === title ? { ...t, workstreamTitle: newWs[0]?.title || '' } : t
        );
        saveDraft({ workstreams: newWs, tasks: newTasks }, `Removed workstream: ${title}`);
    }

    /* ─── Selected member's skills helper ───────────── */

    function getSkillsForMember(memberId: string): MemberSkill[] {
        const member = members.find(m => m.id === memberId);
        return member?.skills || [];
    }

    /* ─── Rendering ─────────────────────────────────── */

    if (loading || !draft) {
        return (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 80, gap: 16, minHeight: '60vh' }}>
                <div className="spinner" />
                <span style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--color-text-muted)' }}>Loading Plan</span>
            </div>
        );
    }

    // Group tasks by workstream
    const tasksByWorkstream = new Map<string, { task: DraftTask; index: number }[]>();
    for (const ws of draft.workstreams) {
        tasksByWorkstream.set(ws.title, []);
    }
    tasksByWorkstream.set('_unassigned', []);
    draft.tasks.forEach((task, index) => {
        const key = task.workstreamTitle && tasksByWorkstream.has(task.workstreamTitle) ? task.workstreamTitle : '_unassigned';
        tasksByWorkstream.get(key)!.push({ task, index });
    });

    const confidenceClass = draft.confidenceScore != null
        ? draft.confidenceScore >= 70 ? 'success' : draft.confidenceScore >= 40 ? 'warning' : 'danger'
        : '';

    return (
        <div className="plan-editor">
            {/* ─── Header ─── */}
            <div className="pe-header">
                <button className="pe-back-btn" onClick={() => router.push('/boardroom')}>
                    <ArrowLeft size={16} />
                </button>
                <div className="pe-header-content">
                    <div className="pe-version-tag">
                        <Sparkles size={10} />
                        PLAN EDITOR — v{draft.version}
                    </div>
                    <input
                        className="pe-title-input"
                        value={draft.title}
                        onChange={e => setDraft({ ...draft, title: e.target.value })}
                        onBlur={() => saveDraft({ title: draft.title }, 'Title changed')}
                    />
                </div>
                {saving && <Loader2 size={14} className="pe-saving-indicator" />}
            </div>

            {/* ─── Plan Meta ─── */}
            <div className="pe-meta-grid">
                <div className="pe-card pe-meta-card">
                    <label className="pe-label">
                        <Target size={11} /> Objective
                    </label>
                    <textarea
                        className="pe-textarea"
                        value={draft.objective}
                        onChange={e => setDraft({ ...draft, objective: e.target.value })}
                        onBlur={() => saveDraft({ objective: draft.objective })}
                    />
                </div>
                <div className="pe-card pe-meta-card">
                    <label className="pe-label">
                        <ClipboardList size={11} /> Success Criteria
                    </label>
                    <textarea
                        className="pe-textarea"
                        value={draft.successCriteria || ''}
                        onChange={e => setDraft({ ...draft, successCriteria: e.target.value })}
                        onBlur={() => saveDraft({ successCriteria: draft.successCriteria })}
                    />
                </div>
            </div>

            {/* ─── Stats Row ─── */}
            <div className="pe-stats-row">
                {draft.confidenceScore != null && (
                    <div className="pe-stat-chip">
                        <span className="pe-stat-label">Confidence</span>
                        <span className={`pe-stat-value ${confidenceClass}`}>{draft.confidenceScore}%</span>
                    </div>
                )}
                {draft.workType && (
                    <div className="pe-stat-chip">
                        <span className="pe-stat-label">Work Type</span>
                        <span className="pe-stat-value">{draft.workType}</span>
                    </div>
                )}
                <div className="pe-stat-chip">
                    <span className="pe-stat-label">Execution Mode</span>
                    <div className="pe-mode-toggle">
                        <button
                            className={`pe-mode-btn ${executionMode === 'AUTO_CHAIN' ? 'active' : ''}`}
                            onClick={() => setExecutionMode('AUTO_CHAIN')}
                        >
                            <Zap size={11} /> Auto-Chain
                        </button>
                        <button
                            className={`pe-mode-btn ${executionMode === 'MANUAL' ? 'active' : ''}`}
                            onClick={() => setExecutionMode('MANUAL')}
                        >
                            <Hand size={11} /> Manual
                        </button>
                    </div>
                </div>
                <div className="pe-counts">
                    <FileText size={13} /> {draft.tasks.length} tasks · {draft.workstreams.length} workstreams · {draft.approvalGates.length} gates
                </div>
            </div>

            {/* ─── Workstreams & Tasks ─── */}
            <div style={{ marginBottom: 24 }}>
                <div className="pe-section-header">
                    <span className="pe-section-title">Workstreams &amp; Tasks</span>
                    <button className="pe-ghost-btn" onClick={addWorkstream}>
                        <Plus size={12} /> Add Workstream
                    </button>
                </div>

                {draft.workstreams.map((ws, wsIdx) => {
                    const wsTasks = tasksByWorkstream.get(ws.title) || [];
                    const isExpanded = expandedWorkstreams.has(ws.title);

                    return (
                        <div key={wsIdx} className="pe-card pe-workstream">
                            {/* Workstream Header */}
                            <div
                                className="pe-ws-header"
                                onClick={() => {
                                    const next = new Set(expandedWorkstreams);
                                    if (isExpanded) next.delete(ws.title); else next.add(ws.title);
                                    setExpandedWorkstreams(next);
                                }}
                            >
                                <span className="pe-ws-chevron">
                                    {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                </span>
                                <input
                                    className="pe-ws-title-input"
                                    style={{ fontSize: 14 }}
                                    value={ws.title}
                                    onClick={e => e.stopPropagation()}
                                    onChange={e => {
                                        const oldTitle = ws.title;
                                        const newTitle = e.target.value;
                                        const newWs = [...draft.workstreams];
                                        newWs[wsIdx] = { ...ws, title: newTitle };
                                        const newTasks = draft.tasks.map(t =>
                                            t.workstreamTitle === oldTitle ? { ...t, workstreamTitle: newTitle } : t
                                        );
                                        setDraft({ ...draft, workstreams: newWs, tasks: newTasks });
                                    }}
                                    onBlur={() => saveDraft({ workstreams: draft.workstreams, tasks: draft.tasks })}
                                />
                                <span className="pe-ws-count">{wsTasks.length} task{wsTasks.length !== 1 ? 's' : ''}</span>
                                {draft.workstreams.length > 1 && (
                                    <button className="pe-ghost-btn danger" onClick={e => { e.stopPropagation(); removeWorkstream(wsIdx); }} style={{ padding: 4 }}>
                                        <Trash2 size={12} />
                                    </button>
                                )}
                            </div>

                            {/* Tasks within workstream */}
                            {isExpanded && (
                                <div className="pe-ws-body">
                                    {wsTasks.map(({ task, index }) => (
                                        <TaskCard
                                            key={index}
                                            task={task}
                                            index={index}
                                            isEditing={editingTaskIndex === index}
                                            members={members}
                                            allTaskTitles={draft.tasks.map(t => t.title)}
                                            onEdit={() => setEditingTaskIndex(editingTaskIndex === index ? null : index)}
                                            onUpdate={(updates) => updateTask(index, updates)}
                                            onSave={() => saveDraft({ tasks: draft.tasks }, `Task "${task.title}" edited`)}
                                            onRemove={() => removeTask(index)}
                                            onMove={(dir) => moveTask(index, dir)}
                                            getSkillsForMember={getSkillsForMember}
                                        />
                                    ))}
                                    <button className="pe-add-task-btn" onClick={() => addTask(ws.title)}>
                                        <Plus size={12} /> Add Task
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* ─── Approval Gates ─── */}
            <div className="pe-card pe-gates-card">
                <div className="pe-label" style={{ marginBottom: 12 }}>
                    <Shield size={12} /> Approval Gates ({draft.approvalGates.length})
                </div>
                {draft.approvalGates.length === 0 && (
                    <div style={{ fontSize: 12, color: 'var(--color-text-muted)', padding: '8px 0' }}>No approval gates configured</div>
                )}
                {draft.approvalGates.map((gate, gIdx) => (
                    <div key={gIdx} className="pe-gate-row">
                        <AlertTriangle size={14} className="pe-gate-icon" />
                        <span className="pe-gate-title">{gate.title}</span>
                        <span className="pe-gate-type">{gate.gateType}</span>
                        <button className="pe-ghost-btn danger" onClick={() => {
                            const newGates = draft.approvalGates.filter((_, i) => i !== gIdx);
                            saveDraft({ approvalGates: newGates }, `Removed gate: ${gate.title}`);
                        }} style={{ padding: 4 }}>
                            <X size={12} />
                        </button>
                    </div>
                ))}
            </div>

            {/* ─── Action Bar ─── */}
            <div className="pe-action-bar">
                <button className="pe-ghost-btn" onClick={() => setShowRegenerate(!showRegenerate)}>
                    <RotateCcw size={14} /> Request Changes
                </button>
                <button className="pe-ghost-btn" onClick={() => router.push('/boardroom')}>
                    <X size={14} /> Discard
                </button>
                <div style={{ flex: 1 }} />
                <button
                    className="pe-cta-approve"
                    onClick={handleApprovePlan}
                    disabled={approving}
                >
                    {approving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Check size={14} />}
                    Approve &amp; Lock Plan
                </button>
            </div>

            {/* ─── Regenerate Panel ─── */}
            {showRegenerate && (
                <div className="pe-card pe-regen-panel">
                    <div className="pe-label" style={{ marginBottom: 8 }}>
                        <Brain size={12} /> Describe what you want changed
                    </div>
                    <textarea
                        className="pe-textarea"
                        value={regenerateFeedback}
                        onChange={e => setRegenerateFeedback(e.target.value)}
                        placeholder="e.g. Add a research phase before content creation, change marketing member to sales..."
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                        <button className="pe-cta-regenerate" onClick={handleRegenerate} disabled={regenerating}>
                            {regenerating ? <Loader2 size={12} style={{ animation: 'spin 1s linear infinite' }} /> : <Brain size={12} />}
                            Regenerate Plan
                        </button>
                        <button className="pe-ghost-btn" onClick={() => setShowRegenerate(false)}>Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
}

/* ─── Task Card Component ──────────────────────────── */

function TaskCard({
    task, index, isEditing, members, allTaskTitles,
    onEdit, onUpdate, onSave, onRemove, onMove, getSkillsForMember,
}: {
    task: DraftTask;
    index: number;
    isEditing: boolean;
    members: TeamMember[];
    allTaskTitles: string[];
    onEdit: () => void;
    onUpdate: (updates: Partial<DraftTask>) => void;
    onSave: () => void;
    onRemove: () => void;
    onMove: (dir: number) => void;
    getSkillsForMember: (id: string) => MemberSkill[];
}) {
    const memberSkills = getSkillsForMember(task.assignedMemberId);
    const assignedMember = members.find(m => m.id === task.assignedMemberId);

    return (
        <div className="pe-task-row">
            {/* Compact row */}
            <div className="pe-task-summary" onClick={onEdit}>
                <span className="pe-task-num">#{index + 1}</span>
                <span className="pe-task-title">{task.title || 'Untitled Task'}</span>
                {assignedMember && (
                    <span className="pe-chip pe-chip-member">
                        <User size={10} /> {assignedMember.name}
                    </span>
                )}
                {task.selectedSkillName ? (
                    <span className="pe-chip pe-chip-skill">
                        <Wrench size={10} /> {task.selectedSkillName}
                    </span>
                ) : task.assignedMemberId && memberSkills.length === 0 ? (
                    <span className="pe-chip pe-chip-skill no-match">
                        <AlertTriangle size={10} /> no skills mapped
                    </span>
                ) : null}
                {(task.dependsOnTaskTitles || []).length > 0 && (
                    <span className="pe-chip pe-chip-dep">
                        <Link2 size={10} /> {task.dependsOnTaskTitles.length}
                    </span>
                )}
                <button className="pe-edit-icon" onClick={e => { e.stopPropagation(); onEdit(); }}>
                    <Edit3 size={12} />
                </button>
            </div>

            {/* Expanded editor */}
            {isEditing && (
                <div className="pe-task-editor">
                    {/* Title */}
                    <div>
                        <label className="pe-field-label">Title</label>
                        <input className="pe-field-input" value={task.title} onChange={e => onUpdate({ title: e.target.value })} onBlur={onSave} />
                    </div>
                    {/* Description */}
                    <div>
                        <label className="pe-field-label">Description</label>
                        <textarea className="pe-field-input textarea" value={task.description || ''} onChange={e => onUpdate({ description: e.target.value })} onBlur={onSave} />
                    </div>
                    {/* Purpose */}
                    <div>
                        <label className="pe-field-label">Purpose</label>
                        <input className="pe-field-input" value={task.purpose || ''} onChange={e => onUpdate({ purpose: e.target.value })} onBlur={onSave} placeholder="Why this task matters..." />
                    </div>
                    {/* Acceptance criteria */}
                    <div>
                        <label className="pe-field-label">Acceptance Criteria</label>
                        <input className="pe-field-input" value={task.acceptanceCriteria || ''} onChange={e => onUpdate({ acceptanceCriteria: e.target.value })} onBlur={onSave} placeholder="How we judge success..." />
                    </div>
                    {/* Member + Skill row */}
                    <div className="pe-field-row">
                        <div>
                            <label className="pe-field-label"><User size={10} /> Assigned Member</label>
                            <select
                                className="pe-field-select"
                                value={task.assignedMemberId || ''}
                                onChange={e => {
                                    const member = members.find(m => m.id === e.target.value);
                                    onUpdate({
                                        assignedMemberId: e.target.value,
                                        assignedMemberName: member?.name || '',
                                        assignedBrainType: member?.brainType || '',
                                        selectedSkillId: '',
                                        selectedSkillName: '',
                                    });
                                    onSave();
                                }}
                            >
                                <option value="">Select member...</option>
                                {members.map(m => (
                                    <option key={m.id} value={m.id}>{m.name} ({m.brainType})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="pe-field-label"><Wrench size={10} /> Selected Skill</label>
                            <select
                                className="pe-field-select"
                                value={task.selectedSkillId || ''}
                                onChange={e => {
                                    const skill = memberSkills.find(s => s.id === e.target.value);
                                    onUpdate({ selectedSkillId: e.target.value, selectedSkillName: skill?.name || '' });
                                    onSave();
                                }}
                                disabled={!task.assignedMemberId}
                            >
                                <option value="">Select skill...</option>
                                {memberSkills.map(s => (
                                    <option key={s.id} value={s.id}>{s.name}</option>
                                ))}
                            </select>
                            {task.assignedMemberId && memberSkills.length === 0 && (
                                <div className="pe-skills-warning">
                                    <AlertTriangle size={10} /> No skills assigned to this member
                                </div>
                            )}
                        </div>
                    </div>
                    {/* Dependencies */}
                    <div>
                        <label className="pe-field-label"><Link2 size={10} /> Dependencies</label>
                        <div className="pe-dep-grid">
                            {allTaskTitles.filter(t => t !== task.title).map(title => (
                                <button
                                    key={title}
                                    className={`pe-dep-btn ${(task.dependsOnTaskTitles || []).includes(title) ? 'active' : ''}`}
                                    onClick={() => {
                                        const deps = task.dependsOnTaskTitles || [];
                                        const newDeps = deps.includes(title) ? deps.filter(d => d !== title) : [...deps, title];
                                        onUpdate({ dependsOnTaskTitles: newDeps });
                                        onSave();
                                    }}
                                >
                                    {title}
                                </button>
                            ))}
                        </div>
                    </div>
                    {/* Approval toggles */}
                    <div className="pe-toggle-row">
                        <label className="pe-toggle-label">
                            <input type="checkbox" checked={task.requiresApprovalBeforeRun} onChange={e => { onUpdate({ requiresApprovalBeforeRun: e.target.checked }); onSave(); }} />
                            <Settings size={11} /> Review before run
                        </label>
                        <label className="pe-toggle-label">
                            <input type="checkbox" checked={task.requiresApprovalAfterRun} onChange={e => { onUpdate({ requiresApprovalAfterRun: e.target.checked }); onSave(); }} />
                            <Shield size={11} /> Validate output
                        </label>
                    </div>
                    {/* Actions */}
                    <div className="pe-task-actions">
                        <button className="pe-ghost-btn" onClick={() => onMove(-1)}>↑ Move Up</button>
                        <button className="pe-ghost-btn" onClick={() => onMove(1)}>↓ Move Down</button>
                        <div style={{ flex: 1 }} />
                        <button className="pe-ghost-btn danger" onClick={onRemove}>
                            <Trash2 size={10} /> Remove
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
