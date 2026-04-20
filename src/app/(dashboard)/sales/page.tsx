'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUIFeedback } from '@/components/UIFeedback';
import WorkspaceSelector, { ProjectWorkspace } from '@/components/WorkspaceSelector';
import AIAssistantChat, { type ChatMessage } from '@/components/AIAssistantChat';
import LeadDiscoveryPanel from '@/components/LeadDiscoveryPanel';
import { useAssistantSkills } from '@/lib/useAssistantSkills';
import {
    DollarSign, Sparkles, Clock,
    Play, Trash2, Copy, Download, Eye, Plus,
} from 'lucide-react';
import './sales.css';

const SECTION_ORDER: [string, string][] = [
    ['subject', 'Subject'], ['greeting', 'Greeting'], ['body', 'Body'], ['cta', 'CTA'],
    ['shortVariant', 'Short Version'], ['shortMessage', 'Short Message'], ['expandedMessage', 'Expanded Message'],
    ['followUpMessage', 'Follow-Up'], ['objective', 'Objective'], ['hypotheses', 'Hypotheses'],
    ['keyQuestions', 'Key Questions'], ['likelyPainPoints', 'Pain Points'], ['nextStepGoal', 'Next Step'],
    ['talkingPoints', 'Talking Points'], ['executiveSummary', 'Executive Summary'],
    ['clientChallenge', 'Client Challenge'], ['proposedSolution', 'Proposed Solution'],
    ['expectedValue', 'Expected Value'], ['suggestedScope', 'Suggested Scope'],
    ['nextSteps', 'Next Steps'], ['objection', 'Objection'],
    ['recommendedResponse', 'Recommended Response'], ['reframingAngle', 'Reframing'],
    ['followUpQuestion', 'Follow-Up Question'], ['buyerRole', 'Buyer Profile'],
    ['keyValueAngle', 'Value Angle'], ['painFraming', 'Pain Framing'],
    ['positioningStatement', 'Positioning'], ['suggestedCTA', 'Suggested CTA'],
    ['adaptationNotes', 'Adaptation Notes'], ['meetingObjective', 'Meeting Objective'],
    ['attendeeContext', 'Attendee Context'], ['keyTopics', 'Key Topics'],
    ['questionsToAsk', 'Questions'], ['thingsToAvoid', 'Avoid'],
    ['desiredOutcome', 'Desired Outcome'], ['materialsToHave', 'Materials'],
    ['prospectOverview', 'Prospect Overview'], ['whyTheyFit', 'Why They Fit'],
    ['identifiedNeeds', 'Identified Needs'], ['ourRelevantOffer', 'Our Relevant Offer'],
    ['suggestedApproach', 'Suggested Approach'], ['keyRisks', 'Risks'],
    ['recommendedNextAction', 'Recommended Next Action'],
];

const LOADING_STEPS = ['Loading company context...', 'Analyzing prospect...', 'Preparing sales angle...', 'Writing output...'];

function fmtDate(d: string) { return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function fmtDateShort(d: string) { const dt = new Date(d); return `${dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} · ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`; }

interface GenerationResult { generationRunId: string; taskType: string; title: string; content: string; contentStructured: Record<string, string>; summary: string; usedCompanyProfile: boolean; [key: string]: unknown; }
interface HistoryItem { id: string; taskType: string; title: string; inputPrompt: string; tone: string; buyerRole: string; prospectCompanyName: string; createdAt: string; }

/* ═══════════════════════════════════════════════════════
   Page Component
   ═══════════════════════════════════════════════════════ */
export default function SalesPage() {
    const { showToast, showConfirm } = useUIFeedback();
    const searchParams = useSearchParams();
    const [tab, setTab] = useState<'create' | 'history'>(() => {
        if (typeof window !== 'undefined') {
            const urlTab = new URLSearchParams(window.location.search).get('tab');
            if (urlTab === 'leads') return 'create';
        }
        return 'create';
    });

    // When coming from /leads redirect, show lead discovery directly
    const [showLeadDiscovery, setShowLeadDiscovery] = useState(() => {
        if (typeof window !== 'undefined') {
            return new URLSearchParams(window.location.search).get('tab') === 'leads';
        }
        return false;
    });

    // Sync from URL search params (for redirect from /leads)
    useEffect(() => {
        const urlTab = searchParams.get('tab');
        if (urlTab === 'leads') {
            setTab('create');
            setShowLeadDiscovery(true);
        }
    }, [searchParams]);
    const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);

    // Dynamic skills from DB
    const { skills: contentTypes } = useAssistantSkills('SALES');
    function typeLabel(v: string) { return contentTypes.find(t => t.value === v)?.label || v; }

    // Generation
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<GenerationResult | null>(null);

    // History
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [viewingItem, setViewingItem] = useState<{ title: string; content: string; taskType: string } | null>(null);

    // Conversation continuity
    const currentMessagesRef = useRef<ChatMessage[]>([]);
    const [initialMessages, setInitialMessages] = useState<ChatMessage[] | undefined>(undefined);

    // New session modal
    const [showNewSessionModal, setShowNewSessionModal] = useState(false);
    const [sessionKey, setSessionKey] = useState(0);

    // Task assignment (from tasks page)
    const [taskInput, setTaskInput] = useState<string | undefined>(undefined);
    const [taskContentType, setTaskContentType] = useState<string | undefined>(undefined);
    const [taskId, setTaskId] = useState<string | undefined>(undefined);

    function startNewSession() {
        setResult(null);
        setInitialMessages(undefined);
        currentMessagesRef.current = [];
        setShowNewSessionModal(false);
        setShowLeadDiscovery(false);
        setSessionKey(k => k + 1);
        setTab('create');
    }
    function handleCreate() {
        if (result || currentMessagesRef.current.length > 1) {
            setShowNewSessionModal(true);
        } else {
            startNewSession();
        }
    }

    const loadHistory = useCallback(() => { fetch('/api/sales/history').then(r => r.json()).then(d => setHistory(d.runs || [])).catch(() => {}); }, []);

    useEffect(() => {
        if (tab === 'history') loadHistory();
    }, [tab, loadHistory]);

    /* ─── Handle URL params (task assignment) ────── */
    useEffect(() => {
        const urlPrompt = searchParams.get('prompt');
        const urlSkill = searchParams.get('skill');
        const urlProjectId = searchParams.get('projectId');
        const urlTaskId = searchParams.get('taskId');
        const urlRunId = searchParams.get('runId');
        // Auto-select workspace from projectId
        if (urlProjectId) {
            setWorkspace({ id: urlProjectId, name: '', description: null, contextText: null });
        }
        if (urlTaskId) setTaskId(urlTaskId);
        if (urlRunId) handleContinueHistory(urlRunId);
        if (urlPrompt) {
            setTaskInput(urlPrompt);
            if (urlSkill) setTaskContentType(urlSkill.toUpperCase());
            setShowLeadDiscovery(false);
            setSessionKey(k => k + 1);
            setTab('create');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ─── Generate ──────────────────────────────────────── */
    async function handleGenerate(params: Record<string, unknown>, refinement?: { action: string; previousOutput: string }) {
        setLoading(true);
        try {
            const payload: Record<string, unknown> = {
                taskType: params.taskType || 'OUTREACH_EMAIL',
                prospectCompanyName: params.prospectCompanyName,
                prospectWebsite: params.prospectWebsite,
                prospectIndustry: params.prospectIndustry,
                prospectLocation: params.prospectLocation,
                buyerRole: params.buyerRole || 'CEO',
                objective: params.objective,
                painOpportunity: params.painOpportunity,
                offerToPosition: params.offerToPosition,
                tone: params.tone || 'Professional',
                language: params.language || undefined,
                length: params.length || 'medium',
                callToAction: params.callToAction,
                useCompanyContext: true,
                projectId: workspace?.id,
            };
            if (refinement) { payload.refinementAction = refinement.action; payload.previousOutput = refinement.previousOutput; }

            const res = await fetch('/api/sales/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || 'Error generating', 'error'); return; }
            setResult(data);
            if (taskId && data.generationRunId) {
                fetch(`/api/tasks/${taskId}/links`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ linkType: 'assistant_run', entityId: data.generationRunId }),
                }).catch(() => {});
            }
            showToast('Sales content generated!', 'success');
        } catch { showToast('Connection error', 'error'); }
        finally { setLoading(false); }
    }

    function handleRefine(action: string, previousOutput: string) {
        if (!result) return;
        handleGenerate({ taskType: result.taskType }, { action, previousOutput });
    }

    function handleCopy(text: string) { navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success')).catch(() => showToast('Error', 'error')); }

    async function handleViewHistory(id: string) { const res = await fetch(`/api/sales/history/${id}`); const data = await res.json(); if (data.run) setViewingItem({ title: data.run.title || data.run.inputPrompt?.substring(0, 60), content: data.run.outputText || data.run.content || '', taskType: data.run.taskType }); }

    async function handleContinueHistory(id: string) {
        const res = await fetch(`/api/sales/history/${id}`);
        const data = await res.json();
        if (!data.run) return;
        const run = data.run;
        const savedMessages: ChatMessage[] = run.generationContext?.conversationLog || [];
        if (savedMessages.length === 0) {
            if (run.inputPrompt) savedMessages.push({ role: 'user', content: run.inputPrompt });
            if (run.outputText || run.content) savedMessages.push({ role: 'assistant', content: run.outputText || run.content || '' });
        }
        setResult({ generationRunId: id, taskType: run.taskType, title: run.title || run.inputPrompt?.substring(0, 60), content: run.outputText || '', contentStructured: {}, summary: '', usedCompanyProfile: false });
        setInitialMessages(savedMessages.length > 0 ? savedMessages : undefined);
        setTab('create');
    }

    function handleDeleteHistory(id: string) {
        showConfirm('Delete this record?', async () => { await fetch('/api/sales/history', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); setHistory(h => h.filter(x => x.id !== id)); showToast('Deleted', 'success'); });
    }

    function handleExport(content: string, title: string) {
        const tt = result?.taskType || 'OUTREACH_EMAIL';
        const typeName = contentTypes.find(t => t.value === tt)?.label || tt;
        const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        const md = [
            `# ${title}`,
            '',
            `> **Type:** ${typeName}  `,
            `> **Generated:** ${date}  `,
            workspace ? `> **Workspace:** ${workspace.name}  ` : null,
            `> **Powered by:** Nousio Sales Assistant`,
            '',
            '---',
            '',
            content,
            '',
            '---',
            '',
            `*Exported from Nousio on ${date}*`,
        ].filter(line => line !== null).join('\n');

        const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${title.replace(/[^a-z0-9]/gi, '_').substring(0, 60)}.md`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Exported as Markdown!', 'success');
    }

    return (
        <div className="sal-page">
            {/* ─── Persistent Header Shell ─────────────── */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><DollarSign size={20} strokeWidth={2} /></span>
                    <h1>Sales Assistant</h1>
                </div>
                <div className="assistant-page-tabs">
                    <button className={`assistant-tab ${tab === 'create' ? 'active' : ''}`} onClick={handleCreate}><Plus size={14} strokeWidth={2} /> New</button>
                    <button className={`assistant-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}><Clock size={14} strokeWidth={2} /> History</button>
                </div>
                <div className="assistant-page-workspace">
                    <WorkspaceSelector selectedId={workspace?.id} onSelect={setWorkspace} />
                </div>
            </div>

            {tab === 'create' && !showLeadDiscovery && (
                <AIAssistantChat
                    key={sessionKey}
                    assistantType="SALES"
                    contentTypes={contentTypes}
                    workspace={workspace}
                    generating={loading}
                    result={result}
                    sectionOrder={SECTION_ORDER}
                    onGenerate={handleGenerate}
                    onRefine={handleRefine}
                    onSave={() => {}}
                    onCopy={handleCopy}
                    onExport={handleExport}
                    headerIcon={<DollarSign size={18} strokeWidth={2} />}
                    loadingSteps={LOADING_STEPS}
                    onContentTypeSelect={(type) => {
                        if (type === 'LEAD_DISCOVERY') setShowLeadDiscovery(true);
                    }}
                    initialMessages={initialMessages}
                    onMessagesChange={(msgs) => { currentMessagesRef.current = msgs; }}
                    initialInput={taskInput}
                    initialContentType={taskContentType}
                />
            )}

            {tab === 'create' && showLeadDiscovery && (
                <div>
                    <div style={{ padding: '0 24px 16px' }}>
                        <button
                            className="btn btn-ghost btn-sm"
                            onClick={() => setShowLeadDiscovery(false)}
                            style={{ gap: 6 }}
                        >
                            ← Back to content types
                        </button>
                    </div>
                    <LeadDiscoveryPanel />
                </div>
            )}

            {/* ─── HISTORY ──────────────────────────────── */}
            {tab === 'history' && (
                <div className="assistant-history-content">
                    <div className="assistant-history-header">
                        <h2>HISTORY</h2>
                        <p>Continue previous work or review past sales content</p>
                    </div>
                    <button className="history-new-btn" onClick={startNewSession}><Plus size={14} strokeWidth={2} /> Start New Task</button>
                    {history.length === 0 ? (
                        <div className="sal-empty"><span className="sal-empty-icon"><Clock size={32} strokeWidth={1.5} /></span><h3>No history yet</h3><p>Content you generate will appear here.</p><button className="btn btn-primary" onClick={() => setTab('create')}>Create Content</button></div>
                    ) : (() => {
                        const [latest, ...rest] = history;
                        const recent = rest.slice(0, 2);
                        const older = rest.slice(2);
                        return (
                            <>
                                <div className="history-hero">
                                    <div className="history-hero-content">
                                        <div className="history-hero-label">Continue where you left off</div>
                                        <h3 className="history-hero-title">{latest.title || latest.inputPrompt?.substring(0, 80)}</h3>
                                        <div className="history-hero-meta">
                                            <span>{typeLabel(latest.taskType)}</span>
                                            <span>{fmtDateShort(latest.createdAt)}</span>
                                            {latest.prospectCompanyName && <span>{latest.prospectCompanyName}</span>}
                                        </div>
                                    </div>
                                    <div className="history-hero-actions">
                                        <button className="btn btn-primary" onClick={() => handleContinueHistory(latest.id)}><Play size={14} strokeWidth={2} /> Continue</button>
                                    </div>
                                </div>
                                {recent.length > 0 && (<><div className="history-section-label">Recent</div><div className="history-card-grid">{recent.map(h => (
                                    <div key={h.id} className="history-card">
                                        <div className="history-card-top"><span className="history-card-type">{typeLabel(h.taskType)}</span><span className="history-card-date">{fmtDateShort(h.createdAt)}</span></div>
                                        <h3 className="history-card-title">{h.title || h.inputPrompt?.substring(0, 80)}</h3>
                                        {(h.prospectCompanyName || h.buyerRole) && (<div className="history-card-meta">{h.prospectCompanyName && <span>{h.prospectCompanyName}</span>}{h.buyerRole && <span>{h.buyerRole}</span>}</div>)}
                                        <div className="history-card-actions">
                                            <button className="btn btn-primary" onClick={() => handleContinueHistory(h.id)}><Play size={12} strokeWidth={2} /> Continue</button>
                                            <button className="btn btn-secondary" onClick={() => handleViewHistory(h.id)}><Eye size={12} strokeWidth={2} /> View</button>
                                            <button className="btn-delete" onClick={() => handleDeleteHistory(h.id)}><Trash2 size={12} strokeWidth={2} /> Delete</button>
                                        </div>
                                    </div>
                                ))}</div></>)}
                                {older.length > 0 && (<><div className="history-section-label">Older</div><div className="history-card-grid older">{older.map(h => (
                                    <div key={h.id} className="history-card">
                                        <div className="history-card-top"><span className="history-card-type">{typeLabel(h.taskType)}</span><span className="history-card-date">{fmtDateShort(h.createdAt)}</span></div>
                                        <h3 className="history-card-title">{h.title || h.inputPrompt?.substring(0, 80)}</h3>
                                        {(h.prospectCompanyName || h.buyerRole) && (<div className="history-card-meta">{h.prospectCompanyName && <span>{h.prospectCompanyName}</span>}{h.buyerRole && <span>{h.buyerRole}</span>}</div>)}
                                        <div className="history-card-actions">
                                            <button className="btn btn-primary" onClick={() => handleContinueHistory(h.id)}><Play size={12} strokeWidth={2} /> Continue</button>
                                            <button className="btn btn-secondary" onClick={() => handleViewHistory(h.id)}><Eye size={12} strokeWidth={2} /> View</button>
                                            <button className="btn-delete" onClick={() => handleDeleteHistory(h.id)}><Trash2 size={12} strokeWidth={2} /> Delete</button>
                                        </div>
                                    </div>
                                ))}</div></>)}
                            </>
                        );
                    })()}
                </div>
            )}

            {/* ─── VIEW ITEM MODAL ──────────────────────── */}
            {viewingItem && (
                <div className="modal-backdrop" onClick={() => setViewingItem(null)}>
                    <div className="sal-dialog" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>{viewingItem.title}</h3>
                            <span className="sal-result-badge">{typeLabel(viewingItem.taskType)}</span>
                        </div>
                        <div className="md-content" style={{ fontSize: 14, lineHeight: 1.7, maxHeight: '60vh', overflow: 'auto', color: 'var(--color-text-primary)' }}>
                            {viewingItem.content}
                        </div>
                        <div className="sal-dialog-footer">
                            <button className="btn btn-secondary" onClick={() => handleCopy(viewingItem.content)}><Copy size={14} strokeWidth={2} /> Copy</button>
                            <button className="btn btn-secondary" onClick={() => handleExport(viewingItem.content, viewingItem.title)}><Download size={14} strokeWidth={2} /> Export</button>
                            <button className="btn btn-primary" onClick={() => setViewingItem(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

            {/* ─── NEW SESSION CONFIRMATION MODAL ───────── */}
            {showNewSessionModal && (
                <div className="new-session-modal-backdrop" onClick={() => setShowNewSessionModal(false)}>
                    <div className="new-session-modal" onClick={e => e.stopPropagation()}>
                        <h3>Start a new task?</h3>
                        <p>Your current progress will be saved in History.</p>
                        <div className="new-session-modal-actions">
                            <button className="btn btn-secondary" onClick={() => setShowNewSessionModal(false)}>Cancel</button>
                            <button className="btn btn-primary" onClick={startNewSession}><Plus size={14} strokeWidth={2} /> Start New</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
