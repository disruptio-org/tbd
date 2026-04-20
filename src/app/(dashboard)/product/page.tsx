'use client';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useUIFeedback } from '@/components/UIFeedback';
import WorkspaceSelector, { ProjectWorkspace } from '@/components/WorkspaceSelector';
import ReactMarkdown from 'react-markdown';
import AIAssistantChat, { type ChatMessage } from '@/components/AIAssistantChat';
import { useAssistantSkills } from '@/lib/useAssistantSkills';
import {
    Package,
    Sparkles, Clock, Play, Trash2, Copy, Eye, Plus, Download,
} from 'lucide-react';
import './product.css';

const SECTION_ORDER: [string, string][] = [];

const LOADING_STEPS = [
    'Loading company context...', 'Analyzing product requirements...',
    'Structuring output...', 'Generating detailed document...', 'Finalizing and formatting...',
];

function formatDate(d: string) { return new Date(d).toLocaleDateString('en-US', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); }
function formatDateShort(d: string) { const dt = new Date(d); return `${dt.toLocaleDateString('en-US', { month: 'short', day: '2-digit' })} · ${dt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`; }

interface GenerationResult { generationRunId: string; outputType: string; title: string; content: string; summary: string; vibeCodingBlock: string; usedCompanyProfile: boolean; [key: string]: unknown; }
interface HistoryItem { id: string; outputType: string; title: string; inputPrompt: string; audienceType: string; detailLevel: string; status: string; createdAt: string; }

/* ═══════════════════════════════════════════════════════
   Page Component
   ═══════════════════════════════════════════════════════ */
export default function ProductPage() {
    const { showToast, showConfirm } = useUIFeedback();
    const searchParams = useSearchParams();
    const [tab, setTab] = useState<'create' | 'history'>('create');
    const [workspace, setWorkspace] = useState<ProjectWorkspace | null>(null);

    // Dynamic skills from DB
    const { skills: contentTypes } = useAssistantSkills('PRODUCT');
    function typeLabel(value: string) { return contentTypes.find(t => t.value === value)?.label || value; }

    // Generation
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<GenerationResult | null>(null);

    // History
    const [history, setHistory] = useState<HistoryItem[]>([]);
    const [viewingItem, setViewingItem] = useState<{ title: string; content: string; outputType: string } | null>(null);

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

    const loadHistory = useCallback(() => { fetch('/api/product/history').then(r => r.json()).then(d => setHistory(d.runs || [])).catch(() => {}); }, []);
    useEffect(() => { if (tab === 'history') loadHistory(); }, [tab, loadHistory]);

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
        // Store taskId for linking after generation
        if (urlTaskId) setTaskId(urlTaskId);
        // Resume from history
        if (urlRunId) {
            handleContinueHistory(urlRunId);
        }
        // Task → Assistant: auto-send prompt
        if (urlPrompt) {
            setTaskInput(urlPrompt);
            if (urlSkill) setTaskContentType(urlSkill.toUpperCase());
            setSessionKey(k => k + 1);
            setTab('create');
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ─── Generate ──────────────────────────────────────── */
    async function handleGenerate(params: Record<string, unknown>, refinement?: { action: string; previousOutput: string }) {
        setLoading(true);
        try {
            const productTitle = (params.productOrFeature || params.productTitle || '') as string;
            const inputPromptParts = [
                params.problemSolved,
                params.problemStatement,
                params.keyBenefits,
                params.businessGoal,
                params.targetPersona ? `Target persona: ${params.targetPersona}` : null,
                params.constraints ? `Constraints: ${params.constraints}` : null,
            ].filter(Boolean) as string[];
            const inputPrompt = inputPromptParts.length > 0
                ? inputPromptParts.join('\n\n')
                : productTitle || `Generate ${params.outputType || 'product documentation'}`;

            const payload: Record<string, unknown> = {
                outputType: params.outputType || 'PRD',
                title: productTitle,
                inputPrompt,
                structuredInput: {
                    targetUser: params.targetPersona || params.targetUsers,
                    businessGoal: params.keyBenefits || params.businessGoal,
                    constraints: params.constraints,
                },
                audienceType: params.audienceType || 'mixed',
                detailLevel: params.detailLevel || 'detailed',
                useCompanyKnowledge: true,
                projectId: workspace?.id,
                conversationLog: currentMessagesRef.current.filter(m => !m.isParams),
            };
            if (refinement) { payload.refinementAction = refinement.action; payload.previousOutput = refinement.previousOutput; }

            const res = await fetch('/api/product/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            const data = await res.json();
            if (!res.ok) { showToast(data.error || 'Error generating output', 'error'); return; }
            setResult(data);
            // Update TaskLink with the generation run ID (so task can Resume)
            if (taskId && data.generationRunId) {
                fetch(`/api/tasks/${taskId}/links`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ linkType: 'assistant_run', entityId: data.generationRunId }),
                }).catch(() => {});
            }
            showToast('Product output generated!', 'success');
        } catch { showToast('Server connection error', 'error'); }
        finally { setLoading(false); }
    }

    function handleRefine(action: string, previousOutput: string) {
        if (!result) return;
        handleGenerate({ outputType: result.outputType }, { action, previousOutput });
    }

    function handleCopy(text: string) { navigator.clipboard.writeText(text).then(() => showToast('Copied!', 'success')).catch(() => showToast('Error', 'error')); }

    async function handleViewHistory(id: string) { const res = await fetch(`/api/product/history/${id}`); const data = await res.json(); if (data.run) setViewingItem({ title: data.run.title || data.run.inputPrompt?.substring(0, 60), content: data.run.outputText || data.run.content || '', outputType: data.run.outputType }); }

    async function handleContinueHistory(id: string) {
        const res = await fetch(`/api/product/history/${id}`);
        const data = await res.json();
        if (!data.run) return;
        const run = data.run;
        const savedMessages: ChatMessage[] = run.generationContext?.conversationLog || [];
        if (savedMessages.length === 0) {
            if (run.inputPrompt) savedMessages.push({ role: 'user', content: run.inputPrompt });
            if (run.outputText || run.content) savedMessages.push({ role: 'assistant', content: run.outputText || run.content || '' });
        }
        setResult({ generationRunId: id, outputType: run.outputType, title: run.title || run.inputPrompt?.substring(0, 60), content: run.outputText || '', summary: '', vibeCodingBlock: '', usedCompanyProfile: false });
        setInitialMessages(savedMessages.length > 0 ? savedMessages : undefined);
        setTab('create');
    }

    function handleDeleteHistory(id: string) {
        showConfirm('Delete this record?', async () => { await fetch('/api/product/history', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) }); setHistory(h => h.filter(x => x.id !== id)); showToast('Deleted', 'success'); });
    }

    function handleExport(content: string, title: string) {
        const outputType = result?.outputType || 'Document';
        const typeName = contentTypes.find(t => t.value === outputType)?.label || outputType;
        const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

        // Build a beautifully formatted .md file
        const md = [
            `# ${title}`,
            '',
            `> **Type:** ${typeName}  `,
            `> **Generated:** ${date}  `,
            workspace ? `> **Workspace:** ${workspace.name}  ` : null,
            `> **Powered by:** Nousio Product Assistant`,
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
        <div className="prd-page">
            {/* ─── Persistent Header Shell ─────────────── */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <span className="assistant-page-icon"><Package size={20} strokeWidth={2} /></span>
                    <h1>Product Assistant</h1>
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
                    assistantType="PRODUCT"
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
                    headerIcon={<Package size={18} strokeWidth={2} />}
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
                        <p>Continue previous work or review past product outputs</p>
                    </div>
                    <button className="history-new-btn" onClick={startNewSession}><Plus size={14} strokeWidth={2} /> Start New Task</button>
                    {history.length === 0 ? (
                        <div className="prd-empty"><span className="prd-empty-icon"><Clock size={32} strokeWidth={1.5} /></span><h3>No history yet</h3><p>Product outputs you generate will appear here.</p><button className="btn btn-primary" onClick={() => setTab('create')}>Create Output</button></div>
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
                                        <div className="history-hero-meta"><span>{typeLabel(latest.outputType)}</span><span>{formatDateShort(latest.createdAt)}</span></div>
                                    </div>
                                    <div className="history-hero-actions"><button className="btn btn-primary" onClick={() => handleContinueHistory(latest.id)}><Play size={14} strokeWidth={2} /> Continue</button></div>
                                </div>
                                {recent.length > 0 && (<><div className="history-section-label">Recent</div><div className="history-card-grid">{recent.map(h => (
                                    <div key={h.id} className="history-card">
                                        <div className="history-card-top"><span className="history-card-type">{typeLabel(h.outputType)}</span><span className="history-card-date">{formatDateShort(h.createdAt)}</span></div>
                                        <h3 className="history-card-title">{h.title || h.inputPrompt?.substring(0, 80)}</h3>
                                        {(h.audienceType || h.detailLevel) && (<div className="history-card-meta">{h.audienceType && <span>{h.audienceType}</span>}{h.detailLevel && <span>{h.detailLevel}</span>}</div>)}
                                        <div className="history-card-actions">
                                            <button className="btn btn-primary" onClick={() => handleContinueHistory(h.id)}><Play size={12} strokeWidth={2} /> Continue</button>
                                            <button className="btn btn-secondary" onClick={() => handleViewHistory(h.id)}><Eye size={12} strokeWidth={2} /> View</button>
                                            <button className="btn-delete" onClick={() => handleDeleteHistory(h.id)}><Trash2 size={12} strokeWidth={2} /> Delete</button>
                                        </div>
                                    </div>
                                ))}</div></>)}
                                {older.length > 0 && (<><div className="history-section-label">Older</div><div className="history-card-grid older">{older.map(h => (
                                    <div key={h.id} className="history-card">
                                        <div className="history-card-top"><span className="history-card-type">{typeLabel(h.outputType)}</span><span className="history-card-date">{formatDateShort(h.createdAt)}</span></div>
                                        <h3 className="history-card-title">{h.title || h.inputPrompt?.substring(0, 80)}</h3>
                                        {(h.audienceType || h.detailLevel) && (<div className="history-card-meta">{h.audienceType && <span>{h.audienceType}</span>}{h.detailLevel && <span>{h.detailLevel}</span>}</div>)}
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
                    <div className="prd-save-dialog" style={{ maxWidth: 700 }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <h3 style={{ margin: 0 }}>{viewingItem.title}</h3>
                            <span className="prd-result-badge">{typeLabel(viewingItem.outputType)}</span>
                        </div>
                        <div className="md-content" style={{ fontSize: 14, lineHeight: 1.7, maxHeight: '60vh', overflow: 'auto', color: 'var(--color-text-primary)' }}>
                            <ReactMarkdown>{viewingItem.content}</ReactMarkdown>
                        </div>
                        <div className="prd-save-footer">
                            <button className="btn btn-secondary" onClick={() => handleCopy(viewingItem.content)}><Copy size={14} strokeWidth={2} /> Copy</button>
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
