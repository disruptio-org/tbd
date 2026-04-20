'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUIFeedback } from '@/components/UIFeedback';
import WorkspaceSelector, { ProjectWorkspace } from '@/components/WorkspaceSelector';
import AIAssistantChat, { type ChatMessage } from '@/components/AIAssistantChat';
import { useAssistantSkills } from '@/lib/useAssistantSkills';
import {
    Building2,
    Sparkles, Clock, Play, Trash2, Copy, Download, Eye, Plus,
} from 'lucide-react';
import '../marketing/marketing.css';

const SECTION_ORDER: [string, string][] = [
    ['hook', 'Executive Summary'], ['headline', 'Title'], ['body', 'Analysis'], ['sections', 'Sections'],
];

const LOADING_STEPS = ['Loading company context...', 'Analyzing market data...', 'Building strategic insights...', 'Preparing recommendations...'];

interface GenerationResult {
    generationRunId: string; contentType: string; title: string;
    content: string; contentStructured: Record<string, string>; summary: string; usedCompanyProfile: boolean;
    [key: string]: unknown;
}
interface HistoryItem { id: string; contentType: string; title: string; inputPrompt: string; status: string; createdAt: string; }

function formatDate(d: string) { return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function formatDateShort(d: string) { const dt = new Date(d); return `${dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} · ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`; }

export default function CompanyAdvisorPage() {
    const { showToast, showConfirm } = useUIFeedback();
    const searchParams = useSearchParams();
    const [tab, setTab] = useState<'create' | 'history'>('create');
    const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);

    // Dynamic skills from DB
    const { skills: contentTypes } = useAssistantSkills('COMPANY_ADVISOR');
    function typeLabel(value: string) { return contentTypes.find(t => t.value === value)?.label || value; }

    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<GenerationResult | null>(null);
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [viewingItem, setViewingItem] = useState<{ title: string; content: string; contentType: string } | null>(null);
    const currentMessagesRef = useRef<ChatMessage[]>([]);
    const [initialMessages, setInitialMessages] = useState<ChatMessage[] | undefined>(undefined);

    const [showNewSessionModal, setShowNewSessionModal] = useState(false);
    const [sessionKey, setSessionKey] = useState(0);
    function startNewSession() {
        setResult(null); setInitialMessages(undefined); currentMessagesRef.current = []; setShowNewSessionModal(false); setSessionKey(k => k + 1); setTab('create');
    }
    function handleCreate() {
        if (result || currentMessagesRef.current.length > 1) { setShowNewSessionModal(true); } else { startNewSession(); }
    }

    const loadHistory = useCallback(() => {
        fetch('/api/company-advisor/history').then(r => r.json()).then(d => setHistory(d.runs || [])).catch(() => {});
    }, []);
    useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);

    // Task assignment (from tasks page)
    const [taskInput, setTaskInput] = useState<string | undefined>(undefined);
    const [taskContentType, setTaskContentType] = useState<string | undefined>(undefined);
    const [taskId, setTaskId] = useState<string | undefined>(undefined);

    /* ─── Handle URL params (task assignment) ────── */
    useEffect(() => {
        const urlPrompt = searchParams.get('prompt');
        const urlSkill = searchParams.get('skill');
        const urlProjectId = searchParams.get('projectId');
        const urlTaskId = searchParams.get('taskId');
        const urlRunId = searchParams.get('runId');
        if (urlProjectId) setWorkspace({ id: urlProjectId, name: '', description: null, contextText: null });
        if (urlTaskId) setTaskId(urlTaskId);
        if (urlRunId) handleContinueHistory(urlRunId);
        if (urlPrompt) {
            setTaskInput(urlPrompt);
            if (urlSkill) setTaskContentType(urlSkill.toUpperCase());
            setSessionKey(k => k + 1);
            setTab('create');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    async function handleGenerate(params: Record<string, unknown>, refinement?: { action: string; previousOutput: string }) {
        setLoading(true);
        try {
            const payload: Record<string, unknown> = {
                contentType: params.contentType || 'STRATEGY_BRIEF',
                topic: params.topic, audience: params.audience, goal: params.goal,
                tone: params.tone || 'Professional', language: params.language || undefined,
                length: params.length || 'medium', useCompanyContext: true, projectId: workspace?.id,
            };
            if (refinement) { payload.refinementAction = refinement.action; payload.previousOutput = refinement.previousOutput; }
            const res = await fetch('/api/company-advisor/generate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || 'Error generating content', 'error'); return; }
            setResult(data);
            if (taskId && data.generationRunId) {
                fetch(`/api/tasks/${taskId}/links`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ linkType: 'assistant_run', entityId: data.generationRunId }),
                }).catch(() => {});
            }
            showToast('Content generated!', 'success');
        } catch { showToast('Server connection error', 'error'); } finally { setLoading(false); }
    }

    function handleRefine(action: string, previousOutput: string) {
        if (!result) return;
        handleGenerate({ contentType: result.contentType }, { action, previousOutput });
    }

    function handleCopy(text: string) { navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success')).catch(() => showToast('Error copying', 'error')); }

    async function handleViewHistory(id: string) {
        const res = await fetch(`/api/company-advisor/history/${id}`); const data = await res.json();
        if (data.run) setViewingItem({ title: data.run.title || data.run.inputPrompt?.substring(0, 60), content: data.run.outputText || '', contentType: data.run.contentType });
    }

    async function handleContinueHistory(id: string) {
        const res = await fetch(`/api/company-advisor/history/${id}`); const data = await res.json();
        if (!data.run) return;
        const run = data.run;
        const savedMessages: ChatMessage[] = run.generationContext?.conversationLog || [];
        if (savedMessages.length === 0) {
            if (run.inputPrompt) savedMessages.push({ role: 'user', content: run.inputPrompt });
            if (run.outputText || run.content) savedMessages.push({ role: 'assistant', content: run.outputText || run.content || '' });
        }
        setResult({ generationRunId: id, contentType: run.contentType, title: run.title || run.inputPrompt?.substring(0, 60), content: run.outputText || '', contentStructured: {}, summary: '', usedCompanyProfile: false });
        setInitialMessages(savedMessages.length > 0 ? savedMessages : undefined);
        setTab('create');
    }

    function handleDeleteHistory(id: string) {
        showConfirm('Delete this record?', async () => { await fetch('/api/company-advisor/history', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); setHistory(h => h.filter(x => x.id !== id)); showToast('Deleted', 'success'); });
    }

    function handleExport(content: string, title: string) {
        const ct = result?.contentType || 'STRATEGY_BRIEF';
        const typeName = contentTypes.find(t => t.value === ct)?.label || ct;
        const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        const md = [
            `# ${title}`,
            '',
            `> **Type:** ${typeName}  `,
            `> **Generated:** ${date}  `,
            workspace ? `> **Workspace:** ${workspace.name}  ` : null,
            `> **Powered by:** Nousio Company Advisor`,
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
        <div className="mkt-page">
            {/* ─── Persistent Header Shell ─────────────── */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><Building2 size={20} strokeWidth={2} /></span>
                    <h1>Company Advisor</h1>
                </div>
                <div className="assistant-page-tabs">
                    <button className={`assistant-tab ${tab === 'create' ? 'active' : ''}`} onClick={handleCreate}><Plus size={14} strokeWidth={2} /> New</button>
                    <button className={`assistant-tab ${tab === 'history' ? 'active' : ''}`} onClick={() => setTab('history')}><Clock size={14} strokeWidth={2} /> History</button>
                </div>
                <div className="assistant-page-workspace">
                    <WorkspaceSelector selectedId={workspace?.id} onSelect={setWorkspace} />
                </div>
            </div>

            {tab === 'create' && (
                <AIAssistantChat
                    key={sessionKey}
                    assistantType="COMPANY_ADVISOR"
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
                    headerIcon={<Building2 size={18} strokeWidth={2} />}
                    loadingSteps={LOADING_STEPS}
                    initialMessages={initialMessages}
                    onMessagesChange={(msgs) => { currentMessagesRef.current = msgs; }}
                    initialInput={taskInput}
                    initialContentType={taskContentType}
                />
            )}

            {/* ─── HISTORY ──────────────────────────────── */}
            {tab === 'history' && (
                <div className="assistant-history-content">
                    <div className="assistant-history-header">
                        <h2>HISTORY</h2>
                        <p>Continue previous work or review past strategic content</p>
                    </div>
                    <button className="history-new-btn" onClick={startNewSession}><Plus size={14} strokeWidth={2} /> Start New Task</button>
                    {history.length === 0 ? (
                        <div className="mkt-empty">
                            <span className="mkt-empty-icon"><Clock size={32} strokeWidth={1.5} /></span><h3>No history yet</h3>
                            <p>Content you generate will appear here.</p>
                            <button className="btn btn-primary" onClick={() => setTab('create')}>Create Content</button>
                        </div>
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
                                        <div className="history-hero-meta"><span>{typeLabel(latest.contentType)}</span><span>{formatDateShort(latest.createdAt)}</span></div>
                                    </div>
                                    <div className="history-hero-actions"><button className="btn btn-primary" onClick={() => handleContinueHistory(latest.id)}><Play size={14} strokeWidth={2} /> Continue</button></div>
                                </div>
                                {recent.length > 0 && (<><div className="history-section-label">Recent</div><div className="history-card-grid">{recent.map(h => (
                                    <div key={h.id} className="history-card">
                                        <div className="history-card-top"><span className="history-card-type">{typeLabel(h.contentType)}</span><span className="history-card-date">{formatDateShort(h.createdAt)}</span></div>
                                        <h3 className="history-card-title">{h.title || h.inputPrompt?.substring(0, 80)}</h3>
                                        <div className="history-card-actions">
                                            <button className="btn btn-primary" onClick={() => handleContinueHistory(h.id)}><Play size={12} strokeWidth={2} /> Continue</button>
                                            <button className="btn btn-secondary" onClick={() => handleViewHistory(h.id)}><Eye size={12} strokeWidth={2} /> View</button>
                                            <button className="btn-delete" onClick={() => handleDeleteHistory(h.id)}><Trash2 size={12} strokeWidth={2} /> Delete</button>
                                        </div>
                                    </div>
                                ))}</div></>)}
                                {older.length > 0 && (<><div className="history-section-label">Older</div><div className="history-card-grid older">{older.map(h => (
                                    <div key={h.id} className="history-card">
                                        <div className="history-card-top"><span className="history-card-type">{typeLabel(h.contentType)}</span><span className="history-card-date">{formatDateShort(h.createdAt)}</span></div>
                                        <h3 className="history-card-title">{h.title || h.inputPrompt?.substring(0, 80)}</h3>
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
                    <div className="mkt-save-dialog" style={{ maxWidth: 640 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>{viewingItem.title}</h3>
                            <span className="mkt-result-badge">{typeLabel(viewingItem.contentType)}</span>
                        </div>
                        <div className="mkt-result-content md-content" style={{ padding: 0, maxHeight: '60vh', overflowY: 'auto' }}>
                            {viewingItem.content}
                        </div>
                        <div className="mkt-save-footer">
                            <button className="btn btn-secondary" onClick={() => handleCopy(viewingItem.content)}><Copy size={14} strokeWidth={2} /> Copy</button>
                            <button className="btn btn-secondary" onClick={() => handleExport(viewingItem.content, viewingItem.title)}><Download size={14} strokeWidth={2} /> Export</button>
                            <button className="btn btn-primary" onClick={() => setViewingItem(null)}>Close</button>
                        </div>
                    </div>
                </div>
            )}

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
