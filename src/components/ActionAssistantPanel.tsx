'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useWhisper } from '@/lib/useWhisper';
import {
    Sparkles, X, Send, Mic, ExternalLink, Check,
    AlertTriangle, HelpCircle, Loader2,
    Megaphone, DollarSign, Package, Search, Brain, CheckSquare, Compass,
    Plus, Clock, ChevronLeft, MessageSquare,
} from 'lucide-react';
import './ActionAssistant.css';

/* ─── Types ──────────────────────────────────────────── */

interface Message {
    id: string;
    role: 'USER' | 'ASSISTANT' | 'SYSTEM';
    content: string;
    inputMode: 'TEXT' | 'VOICE';
    timestamp: Date;
}

interface ActionRunState {
    id: string;
    status: string;
    interpretation?: string;
    intentType?: string;
    targetModule?: string;
    executionMode?: 'direct' | 'handoff' | 'workspace';
    clarificationQuestion?: string;
    clarificationOptions?: string[];
    missingParams?: string[];
    confirmationSummary?: string;
    resultSummary?: string;
    deepLink?: string;
    inlinePreview?: string;
    groundingStatus?: string;
    // Handoff (V2)
    handoffTarget?: string;
    handoffMemberName?: string;
    handoffMemberId?: string;
    handoffDeepLink?: string;
    prefilledPrompt?: string;
    // Workspace (V2)
    workspaceTarget?: string;
    workspaceDeepLink?: string;
    workspaceState?: Record<string, unknown>;
    // Intake (V2)
    intakePreview?: {
        sourceType: string;
        extractedTasks: Array<{ title: string; assignee?: string; dueDate?: string; priority?: string }>;
        extractedDecisions: string[];
        extractedOwners: string[];
        extractedDeadlines: string[];
        inferredProject?: string;
    };
}

interface SessionSummary {
    id: string;
    status: string;
    startedAt: string;
    messageCount?: number;
    firstUserMessage?: string;
}

/* ─── Panel Component ────────────────────────────────── */

export default function ActionAssistantPanel({
    isOpen,
    onClose,
    assistantName,
}: {
    isOpen: boolean;
    onClose: () => void;
    assistantName: string;
}) {
    const pathname = usePathname();
    const router = useRouter();

    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [pendingAction, setPendingAction] = useState<ActionRunState | null>(null);
    const [showHistory, setShowHistory] = useState(false);
    const [sessions, setSessions] = useState<SessionSummary[]>([]);
    const [loadingSessions, setLoadingSessions] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    // Voice input
    const { isRecording, startRecording, stopRecording, transcript } = useWhisper();

    // Scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isLoading]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [input]);

    // Apply voice transcript
    useEffect(() => {
        if (transcript && !isRecording) {
            setInput(prev => (prev ? prev + ' ' : '') + transcript);
        }
    }, [transcript, isRecording]);

    // Reset on close
    useEffect(() => {
        if (!isOpen) {
            setIsLoading(false);
            setShowHistory(false);
        }
    }, [isOpen]);

    // ─── Start new conversation ───────────────────────

    const startNewConversation = useCallback(() => {
        setMessages([]);
        setSessionId(null);
        setPendingAction(null);
        setInput('');
        setShowHistory(false);
    }, []);

    // ─── Load session history ─────────────────────────

    const loadSessions = useCallback(async () => {
        setLoadingSessions(true);
        try {
            const res = await fetch('/api/assistant/sessions');
            const data = await res.json();
            setSessions(data.sessions || []);
        } catch {
            console.error('[ActionAssistant] Failed to load sessions');
        } finally {
            setLoadingSessions(false);
        }
    }, []);

    // ─── Load a previous session ──────────────────────

    const loadSession = useCallback(async (sid: string) => {
        try {
            const res = await fetch(`/api/assistant/sessions/${sid}`);
            const data = await res.json();
            if (data.session) {
                setSessionId(sid);
                // API returns { session, messages, actionRuns } at top level
                const msgs = data.messages || [];
                setMessages(msgs.map((m: { id: string; role: string; content: string; inputMode: string; createdAt: string }) => ({
                    id: m.id,
                    role: m.role as Message['role'],
                    content: m.content,
                    inputMode: m.inputMode as Message['inputMode'],
                    timestamp: new Date(m.createdAt),
                })));
                setPendingAction(null);
                setShowHistory(false);
            }
        } catch {
            console.error('[ActionAssistant] Failed to load session');
        }
    }, []);

    // ─── Send message ────────────────────────────────

    const sendMessage = useCallback(async (text?: string, opts?: { respondingToActionId?: string; confirmAction?: boolean }) => {
        const msg = text || input.trim();
        if (!msg && opts?.confirmAction === undefined) return;

        // Add user message to UI
        if (msg) {
            const userMsg: Message = {
                id: crypto.randomUUID(),
                role: 'USER',
                content: msg,
                inputMode: 'TEXT',
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, userMsg]);
            setInput('');
        }

        setIsLoading(true);
        setPendingAction(null);

        try {
            const res = await fetch('/api/assistant/message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    sessionId,
                    message: msg,
                    inputMode: 'TEXT',
                    pageContext: {
                        route: pathname,
                    },
                    respondingToActionId: opts?.respondingToActionId,
                    confirmAction: opts?.confirmAction,
                }),
            });

            const data = await res.json();

            if (data.sessionId) setSessionId(data.sessionId);

            // ALWAYS add assistant response to message history
            let newMsgId: string | null = null;
            if (data.assistantMessage) {
                newMsgId = crypto.randomUUID();
                const assistantMsg: Message = {
                    id: newMsgId,
                    role: 'ASSISTANT',
                    content: data.assistantMessage,
                    inputMode: 'TEXT',
                    timestamp: new Date(),
                };
                setMessages(prev => [...prev, assistantMsg]);
            }

            // Handle action state — store the message ID so we can hide
            // only the bubble that the card visually replaces
            if (data.actionRun) {
                setPendingAction({ ...data.actionRun, _linkedMsgId: newMsgId });
            }
        } catch (err) {
            console.error('[ActionAssistant] Error:', err);
            setMessages(prev => [...prev, {
                id: crypto.randomUUID(),
                role: 'ASSISTANT',
                content: 'Something went wrong. Please try again.',
                inputMode: 'TEXT',
                timestamp: new Date(),
            }]);
        } finally {
            setIsLoading(false);
        }
    }, [input, sessionId, pathname]);

    // ─── Key handler ─────────────────────────────────

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    };

    // ─── Voice toggle ────────────────────────────────

    const toggleVoice = () => {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    };

    // ─── Navigate to deep link ───────────────────────

    const handleDeepLink = (link: string) => {
        onClose();
        router.push(link);
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="action-assistant-overlay" onClick={onClose} />
            <div className="action-assistant-panel">
                {/* Header */}
                <div className="aa-panel-header">
                    <div className="aa-panel-header-left">
                        {showHistory ? (
                            <button className="aa-header-action" onClick={() => setShowHistory(false)} title="Back to chat">
                                <ChevronLeft size={16} />
                            </button>
                        ) : (
                            <div className="aa-panel-header-icon">
                                <Sparkles size={16} />
                            </div>
                        )}
                        <span className="aa-panel-header-name">
                            {showHistory ? 'Conversations' : assistantName}
                        </span>
                    </div>
                    <div className="aa-header-actions">
                        {!showHistory && (
                            <>
                                <button
                                    className="aa-header-action"
                                    onClick={() => { setShowHistory(true); loadSessions(); }}
                                    title="Conversation history"
                                >
                                    <Clock size={14} />
                                </button>
                                {(messages.length > 0 || sessionId) && (
                                    <button
                                        className="aa-header-action new"
                                        onClick={startNewConversation}
                                        title="New conversation"
                                    >
                                        <Plus size={14} />
                                    </button>
                                )}
                            </>
                        )}
                        <button className="aa-panel-close" onClick={onClose} aria-label="Close assistant">
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {/* History View */}
                {showHistory ? (
                    <div className="aa-messages">
                        <button className="aa-new-conversation-btn" onClick={startNewConversation}>
                            <Plus size={14} />
                            New Conversation
                        </button>
                        {loadingSessions ? (
                            <div className="aa-loading">
                                <Loader2 size={14} className="aa-spin" />
                                <span>Loading</span>
                            </div>
                        ) : sessions.length === 0 ? (
                            <div className="aa-empty-state">
                                <div className="aa-empty-icon">
                                    <MessageSquare size={22} />
                                </div>
                                <div className="aa-empty-title">No conversations yet</div>
                                <div className="aa-empty-desc">Start a new conversation to see it here.</div>
                            </div>
                        ) : (
                            <div className="aa-session-list">
                                {sessions.map((s) => (
                                    <button
                                        key={s.id}
                                        className={`aa-session-item ${s.id === sessionId ? 'active' : ''}`}
                                        onClick={() => loadSession(s.id)}
                                    >
                                        <div className="aa-session-item-top">
                                            <MessageSquare size={14} />
                                            <span className="aa-session-item-preview">
                                                {s.firstUserMessage || 'Conversation'}
                                            </span>
                                        </div>
                                        <div className="aa-session-item-meta">
                                            <span>{new Date(s.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                            <span className={`aa-session-status ${s.status.toLowerCase()}`}>{s.status}</span>
                                        </div>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    /* Chat View */
                    <>
                <div className="aa-messages">
                    {messages.length === 0 && !isLoading && (
                        <div className="aa-empty-state">
                            <div className="aa-empty-icon">
                                <Sparkles size={22} />
                            </div>
                            <div className="aa-empty-title">How can I help?</div>
                            <div className="aa-empty-desc">
                                Type or speak a command. I can create tasks, route to your AI team, parse notes, and launch workspaces.
                            </div>
                            <div className="aa-suggestion-chips">
                                <button className="aa-suggestion-chip" onClick={() => sendMessage('Create a task to review the homepage')}>
                                    Create a task
                                </button>
                                <button className="aa-suggestion-chip" onClick={() => sendMessage('Write a LinkedIn post about our product launch')}>
                                    Ask Marketing Lead
                                </button>
                                <button className="aa-suggestion-chip" onClick={() => sendMessage('Open boardroom with a new initiative')}>
                                    Open Boardroom
                                </button>
                            </div>
                        </div>
                    )}

                    {messages.map((msg) => {
                        // Hide the specific message that the action card replaces
                        const isHiddenByActionCard = pendingAction
                            && (pendingAction as ActionRunState & { _linkedMsgId?: string })._linkedMsgId === msg.id;
                        if (isHiddenByActionCard) return null;

                        return (
                            <div key={msg.id} className={`aa-message ${msg.role.toLowerCase()}`}>
                                <div className="aa-message-bubble">{msg.content}</div>
                                <span className="aa-message-time">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </span>
                            </div>
                        );
                    })}

                    {/* Active action card */}
                    {pendingAction && renderActionCard(pendingAction, sendMessage, handleDeepLink, startNewConversation)}

                    {/* Loading */}
                    {isLoading && (
                        <div className="aa-loading">
                            <Loader2 size={14} className="aa-spin" />
                            <span>Processing</span>
                            <div className="aa-loading-dots">
                                <span /><span /><span />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input */}
                <div className="aa-input-bar">
                    <button
                        className={`aa-input-btn mic ${isRecording ? 'recording' : ''}`}
                        onClick={toggleVoice}
                        title={isRecording ? 'Stop recording' : 'Start voice input'}
                    >
                        <Mic size={16} />
                    </button>
                    <textarea
                        ref={textareaRef}
                        className="aa-input-textarea"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder={`Ask ${assistantName} anything...`}
                        rows={1}
                        disabled={isLoading}
                    />
                    <button
                        className="aa-input-btn"
                        onClick={() => sendMessage()}
                        disabled={!input.trim() || isLoading}
                        title="Send"
                    >
                        <Send size={16} />
                    </button>
                </div>
                </>
                )}
            </div>
        </>
    );
}

/* ─── Module Badge Helper ────────────────────────────── */

const MODULE_INFO: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    tasks: { label: 'Tasks', icon: <CheckSquare size={12} />, color: '#f97316' },
    navigation: { label: 'Navigate', icon: <Compass size={12} />, color: '#64748b' },
    initiative: { label: 'Initiative', icon: <Compass size={12} />, color: '#8b5cf6' },
    handoff: { label: 'Routing', icon: <ExternalLink size={12} />, color: '#06b6d4' },
    workspace: { label: 'Workspace', icon: <ExternalLink size={12} />, color: '#10b981' },
};

function ModuleBadge({ module }: { module?: string }) {
    if (!module) return null;
    const info = MODULE_INFO[module];
    if (!info) return null;
    return (
        <span className="aa-module-badge" style={{ borderColor: info.color, color: info.color }}>
            {info.icon}
            {info.label}
        </span>
    );
}

/* ─── Action Card Renderer ───────────────────────────── */

function renderActionCard(
    action: ActionRunState,
    sendMessage: (text?: string, opts?: { respondingToActionId?: string; confirmAction?: boolean }) => void,
    handleDeepLink: (link: string) => void,
    onNewConversation: () => void,
) {
    // Clarification
    if (action.status === 'WAITING_CLARIFICATION') {
        const missingParams = action.missingParams || [];

        return (
            <div className="aa-action-card clarification">
                <div className="aa-action-card-header">
                    <div className="aa-action-card-label">
                        <HelpCircle size={12} />
                        What I need from you
                    </div>
                    <ModuleBadge module={action.targetModule} />
                </div>

                {/* Show what the assistant understood */}
                {action.interpretation && (
                    <div className="aa-action-card-interpretation">
                        I understood: <strong>&ldquo;{action.interpretation}&rdquo;</strong>
                    </div>
                )}

                {/* Structured missing fields list */}
                {missingParams.length > 0 && (
                    <div className="aa-clarify-fields">
                        <div className="aa-clarify-fields-label">Please provide:</div>
                        <div className="aa-clarify-fields-list">
                            {missingParams.map((param) => (
                                <button
                                    key={param}
                                    className="aa-clarify-field-item"
                                    onClick={() => setFocusOnTextarea()}
                                >
                                    <span className="aa-clarify-field-dot" />
                                    <span className="aa-clarify-field-name">{formatParamLabel(param)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Quick options if available */}
                {action.clarificationOptions && action.clarificationOptions.length > 0 && (
                    <div className="aa-clarify-options">
                        {action.clarificationOptions.map((opt) => (
                            <button
                                key={opt}
                                className="aa-clarify-option"
                                onClick={() => sendMessage(opt, { respondingToActionId: action.id })}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                )}

                {/* Hint text */}
                <div className="aa-clarify-hint">
                    Type your response below or pick an option above
                </div>
            </div>
        );
    }

    // Confirmation
    if (action.status === 'WAITING_CONFIRMATION') {
        return (
            <div className="aa-action-card confirmation">
                <div className="aa-action-card-header">
                    <div className="aa-action-card-label">
                        <AlertTriangle size={12} />
                        Confirm action
                    </div>
                    <ModuleBadge module={action.targetModule} />
                </div>
                {action.interpretation && (
                    <div className="aa-action-card-text">{action.interpretation}</div>
                )}
                <div className="aa-confirm-actions">
                    <button
                        className="aa-confirm-btn cancel"
                        onClick={() => sendMessage('cancel', { respondingToActionId: action.id, confirmAction: false })}
                    >
                        Cancel
                    </button>
                    <button
                        className="aa-confirm-btn confirm"
                        onClick={() => sendMessage('confirm', { respondingToActionId: action.id, confirmAction: true })}
                    >
                        Confirm →
                    </button>
                </div>
            </div>
        );
    }

    // Routed (V2 — handoff to team member)
    if (action.status === 'ROUTED') {
        return (
            <div className="aa-action-card routed">
                <div className="aa-action-card-header">
                    <div className="aa-action-card-label">
                        <ExternalLink size={12} />
                        Routed
                    </div>
                    <ModuleBadge module="handoff" />
                </div>
                <div className="aa-action-card-text">
                    {action.resultSummary || `Routed to ${action.handoffMemberName || 'team member'}.`}
                </div>
                {action.prefilledPrompt && (
                    <div className="aa-routed-prompt">
                        <span className="aa-routed-prompt-label">Context prepared:</span>
                        <span className="aa-routed-prompt-text">&ldquo;{action.prefilledPrompt.slice(0, 120)}{action.prefilledPrompt.length > 120 ? '...' : ''}&rdquo;</span>
                    </div>
                )}
                {action.handoffDeepLink && (
                    <button className="aa-result-link routed" onClick={() => handleDeepLink(action.handoffDeepLink!)}>
                        <ExternalLink size={12} />
                        Open {action.handoffMemberName || 'Team Member'} Chat →
                    </button>
                )}
                <button className="aa-new-conversation-btn compact" onClick={onNewConversation}>
                    <Plus size={12} />
                    New Conversation
                </button>
            </div>
        );
    }

    // Workspace launched (V2)
    if (action.status === 'WORKSPACE_LAUNCHED') {
        return (
            <div className="aa-action-card workspace-launch">
                <div className="aa-action-card-header">
                    <div className="aa-action-card-label">
                        <Compass size={12} />
                        Workspace Ready
                    </div>
                    <ModuleBadge module="workspace" />
                </div>
                <div className="aa-action-card-text">
                    {action.resultSummary || `${action.workspaceTarget || 'Workspace'} is ready with your context.`}
                </div>
                {action.workspaceDeepLink && (
                    <button className="aa-result-link workspace" onClick={() => handleDeepLink(action.workspaceDeepLink!)}>
                        <ExternalLink size={12} />
                        Open {action.workspaceTarget ? action.workspaceTarget.charAt(0).toUpperCase() + action.workspaceTarget.slice(1) : 'Workspace'} →
                    </button>
                )}
                <button className="aa-new-conversation-btn compact" onClick={onNewConversation}>
                    <Plus size={12} />
                    New Conversation
                </button>
            </div>
        );
    }

    // Intake preview (V2 — parsed notes)
    if (action.status === 'INTAKE_PREVIEW' && action.intakePreview) {
        const intake = action.intakePreview;
        return (
            <div className="aa-action-card intake-preview">
                <div className="aa-action-card-header">
                    <div className="aa-action-card-label">
                        <CheckSquare size={12} />
                        Notes Parsed
                    </div>
                </div>
                {intake.extractedTasks.length > 0 && (
                    <div className="aa-intake-section">
                        <div className="aa-intake-section-label">Tasks ({intake.extractedTasks.length})</div>
                        <div className="aa-intake-task-list">
                            {intake.extractedTasks.map((t, i) => (
                                <div key={i} className="aa-intake-task">
                                    <span className="aa-intake-task-bullet">◻</span>
                                    <span>{t.title}</span>
                                    {t.assignee && <span className="aa-intake-tag">{t.assignee}</span>}
                                    {t.dueDate && <span className="aa-intake-tag date">{t.dueDate}</span>}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                {intake.extractedDecisions.length > 0 && (
                    <div className="aa-intake-section">
                        <div className="aa-intake-section-label">Decisions ({intake.extractedDecisions.length})</div>
                        {intake.extractedDecisions.map((d, i) => (
                            <div key={i} className="aa-intake-decision">→ {d}</div>
                        ))}
                    </div>
                )}
                <div className="aa-confirm-actions">
                    <button
                        className="aa-confirm-btn cancel"
                        onClick={() => sendMessage('cancel', { respondingToActionId: action.id, confirmAction: false })}
                    >
                        Cancel
                    </button>
                    <button
                        className="aa-confirm-btn confirm"
                        onClick={() => sendMessage('confirm', { respondingToActionId: action.id, confirmAction: true })}
                    >
                        Create {intake.extractedTasks.length} Tasks →
                    </button>
                </div>
            </div>
        );
    }

    // Success
    if (action.status === 'SUCCESS') {
        return (
            <div className="aa-action-card result-success">
                <div className="aa-action-card-header">
                    <div className="aa-action-card-label">
                        <Check size={12} />
                        Completed
                    </div>
                    <ModuleBadge module={action.targetModule} />
                </div>
                {action.resultSummary && (
                    <div className="aa-action-card-text">{action.resultSummary}</div>
                )}
                {action.inlinePreview && (
                    <div className="aa-inline-preview">{action.inlinePreview}</div>
                )}
                <div className="aa-action-card-footer">
                    {action.deepLink && (
                        <button className="aa-result-link" onClick={() => handleDeepLink(action.deepLink!)}>
                            <ExternalLink size={12} />
                            Open result
                        </button>
                    )}
                </div>
                <button className="aa-new-conversation-btn compact" onClick={onNewConversation}>
                    <Plus size={12} />
                    New Conversation
                </button>
            </div>
        );
    }

    // Failure
    if (action.status === 'FAILED') {
        return (
            <div className="aa-action-card result-failure">
                <div className="aa-action-card-header">
                    <div className="aa-action-card-label">
                        <AlertTriangle size={12} />
                        Failed
                    </div>
                    <ModuleBadge module={action.targetModule} />
                </div>
                {action.resultSummary && (
                    <div className="aa-action-card-text">{action.resultSummary}</div>
                )}
                {action.deepLink && (
                    <button className="aa-result-link" onClick={() => handleDeepLink(action.deepLink!)}>
                        <ExternalLink size={12} />
                        {action.intentType === 'route_to_marketing' || action.intentType === 'route_to_product' || action.intentType === 'route_to_sales' || action.intentType === 'route_to_knowledge'
                            ? 'Set up Team Member'
                            : 'View Details'}
                    </button>
                )}
                <button className="aa-new-conversation-btn compact" onClick={onNewConversation}>
                    <Plus size={12} />
                    New Conversation
                </button>
            </div>
        );
    }

    return null;
}

/* ─── Helpers ────────────────────────────────────────── */

function formatParamLabel(param: string): string {
    const labels: Record<string, string> = {
        contentType: 'Content type',
        topic: 'Topic or subject',
        audience: 'Target audience',
        tone: 'Tone of voice',
        goal: 'Goal or objective',
        title: 'Title',
        description: 'Description',
        boardId: 'Task board',
        boardName: 'Task board',
        columnName: 'Column / Status',
        projectId: 'Project',
        priority: 'Priority level',
        query: 'Search query',
        industry: 'Industry',
        region: 'Region or location',
        target: 'Page to navigate to',
        assignee: 'Assigned to',
        dueDate: 'Due date',
        'task details/description': 'Task details',
        'due date': 'Due date',
    };
    return labels[param] || param.replace(/([A-Z])/g, ' $1').replace(/_/g, ' ').replace(/^\w/, c => c.toUpperCase()).trim();
}

function setFocusOnTextarea() {
    const textarea = document.querySelector('.aa-input-textarea') as HTMLTextAreaElement;
    if (textarea) textarea.focus();
}
