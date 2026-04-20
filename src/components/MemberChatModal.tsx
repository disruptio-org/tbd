'use client';

import { useState, useEffect, useRef } from 'react';
import {
    X, Loader, Send, Zap, MessageCircle, Paperclip, Upload,
    FileText, Check, Search, FolderOpen, Sparkles, ArrowRight,
} from 'lucide-react';
import { useUIFeedback } from '@/components/UIFeedback';
import '@/app/(dashboard)/ai-team/[memberId]/ai-member-workspace.css';
import './MemberChatModal.css';

// ─── Types ────────────────────────────────────────

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    skill?: string;
    timestamp: string;
}

interface SkillDef {
    key: string;
    name: string;
    description: string | null;
}

interface ProjectDoc {
    id: string;
    filename: string;
    mimeType: string;
    size: number;
}

// ─── Avatar helpers ────────────────────────────────

const AVATAR_COLORS = [
    '#2563eb', '#7c3aed', '#0891b2', '#059669', '#d97706',
    '#dc2626', '#4f46e5', '#0d9488', '#be185d', '#65a30d',
];

function getAvatarColor(name: string) {
    let hash = 0;
    for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function getInitials(name: string) {
    return name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
}

function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

// ─── Props ─────────────────────────────────────────

export interface MemberChatModalProps {
    memberId: string;
    memberName: string;
    brainType: string;
    avatarUrl: string | null;
    projectId?: string;
    projectName?: string;
    taskId?: string;
    taskTitle?: string;
    initialPrompt?: string;
    initialSkill?: string;
    docIds?: string[];
    onClose: () => void;
    onTaskDelegated?: () => void;
}

// ─── Component ─────────────────────────────────────

export default function MemberChatModal({
    memberId,
    memberName,
    brainType,
    avatarUrl,
    projectId,
    projectName,
    taskId,
    taskTitle,
    initialPrompt,
    initialSkill,
    docIds: initialDocIds,
    onClose,
    onTaskDelegated,
}: MemberChatModalProps) {
    const { showToast } = useUIFeedback();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Chat state
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [sending, setSending] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);

    // Skills
    const [skills, setSkills] = useState<SkillDef[]>([]);
    const [selectedSkill, setSelectedSkill] = useState<string | null>(initialSkill || null);

    // Document attachment
    const [attachedDocIds, setAttachedDocIds] = useState<string[]>(initialDocIds || []);
    const [showDocPicker, setShowDocPicker] = useState(false);
    const [projectDocs, setProjectDocs] = useState<ProjectDoc[]>([]);
    const [projectDocsLoading, setProjectDocsLoading] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [docSearchQuery, setDocSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);

    // Delegation state
    const [isReady, setIsReady] = useState(false);
    const [delegating, setDelegating] = useState(false);
    const [extractedParams, setExtractedParams] = useState<Record<string, string>>({});

    const firstName = memberName.split(' ')[0];
    const initials = getInitials(memberName);
    const avatarColor = getAvatarColor(memberName);
    const pinnedSkills = skills.slice(0, 5);

    // ─── Load skills ──────────────────────────────────

    useEffect(() => {
        (async () => {
            try {
                const res = await fetch(`/api/ai/skills?assistantType=${brainType}`);
                if (res.ok) {
                    const data = await res.json();
                    setSkills(data.skills || []);
                }
            } catch { /* non-critical */ }
        })();
    }, [brainType]);

    // ─── Load project docs ────────────────────────────

    useEffect(() => {
        if (!projectId) return;
        (async () => {
            setProjectDocsLoading(true);
            try {
                const res = await fetch(`/api/documents/upload?projectId=${projectId}`);
                if (res.ok) {
                    const data = await res.json();
                    const docs = Array.isArray(data) ? data : (data.documents || []);
                    setProjectDocs(docs.map((d: any) => ({
                        id: d.id,
                        filename: d.filename,
                        mimeType: d.mimeType || '',
                        size: d.size || 0,
                    })));
                }
            } catch { /* non-critical */ }
            setProjectDocsLoading(false);
        })();
    }, [projectId]);

    // ─── Auto-send initial prompt ─────────────────────

    const initialSent = useRef(false);
    useEffect(() => {
        if (initialPrompt && !initialSent.current) {
            initialSent.current = true;
            setTimeout(() => handleSendMessage(initialPrompt), 300);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialPrompt]);

    // ─── Auto-scroll ──────────────────────────────────

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, sending]);

    // ─── Send message ─────────────────────────────────

    async function handleSendMessage(overrideText?: string) {
        const text = (overrideText || inputText).trim();
        if (!text || sending) return;

        const userMsg: ChatMessage = {
            id: `u-${Date.now()}`,
            role: 'user',
            content: text,
            skill: selectedSkill || undefined,
            timestamp: new Date().toISOString(),
        };

        setMessages(prev => [...prev, userMsg]);
        if (!overrideText) setInputText('');
        setSending(true);

        try {
            const chatHistory = [...messages, userMsg].map(m => ({
                role: m.role,
                content: m.content,
            }));

            const res = await fetch(`/api/ai/members/${memberId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    sessionId,
                    skillKey: selectedSkill || undefined,
                    projectId: projectId || undefined,
                    messages: chatHistory,
                    extractedParams,
                    contentType: selectedSkill || '',
                    availableContentTypes: skills.map(s => s.key),
                    docIds: attachedDocIds.length > 0 ? attachedDocIds : undefined,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.sessionId) setSessionId(data.sessionId);

                const assistantMsg: ChatMessage = {
                    id: `a-${Date.now()}`,
                    role: 'assistant',
                    content: data.response || 'I received your message.',
                    timestamp: new Date().toISOString(),
                };
                setMessages(prev => [...prev, assistantMsg]);

                // Handle extracted params for delegation
                if (data.extractedParams) {
                    setExtractedParams(prev => ({ ...prev, ...data.extractedParams }));
                }
                if (data.isReady) {
                    setIsReady(true);
                }
            } else {
                showToast('Message failed', 'error');
            }
        } catch {
            showToast('Connection error', 'error');
        }

        setSending(false);
        setSelectedSkill(null);
        setAttachedDocIds([]);
        setShowDocPicker(false);
    }

    // ─── File upload ──────────────────────────────────

    async function handleFileUpload(files: FileList | null) {
        if (!files || files.length === 0) return;
        setUploadingFile(true);
        for (const file of Array.from(files)) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                if (projectId) formData.append('projectId', projectId);
                const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
                if (res.ok) {
                    const doc = await res.json();
                    setProjectDocs(prev => [{ id: doc.id, filename: doc.filename, mimeType: doc.mimeType || '', size: doc.size || 0 }, ...prev]);
                    setAttachedDocIds(prev => prev.includes(doc.id) ? prev : [...prev, doc.id]);
                    showToast(`Uploaded: ${doc.filename}`, 'success');
                } else {
                    const err = await res.json().catch(() => ({}));
                    showToast(err.error || 'Upload failed', 'error');
                }
            } catch {
                showToast('Upload error', 'error');
            }
        }
        setUploadingFile(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    function toggleDocAttachment(docId: string) {
        setAttachedDocIds(prev =>
            prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
        );
    }

    // ─── Delegate task to member ──────────────────────

    async function handleDelegateTask() {
        if (!taskId || delegating) return;
        setDelegating(true);

        try {
            // 1. Assign the task to this AI member
            const res = await fetch(`/api/tasks/${taskId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    aiMemberId: memberId,
                    description: extractedParams.topic
                        ? `${taskTitle || ''}\n\n**AI Brief:** ${Object.entries(extractedParams).map(([k, v]) => `${k}: ${v}`).join(' | ')}`
                        : undefined,
                }),
            });

            // 2. Create assistant_run link for traceability
            await fetch(`/api/tasks/${taskId}/links`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    linkType: 'assistant_run',
                    label: `${memberId}:${memberName}${selectedSkill ? ':' + selectedSkill : ''}`,
                }),
            }).catch(() => {});

            if (res.ok) {
                showToast(`Task delegated to ${firstName}! They'll work on it in the background.`, 'success');

                // 3. Fire background execution (fire-and-forget)
                fetch(`/api/ai/members/${memberId}/execute-task`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        taskId,
                        extractedParams,
                        docIds: initialDocIds || [],
                        skill: selectedSkill || undefined,
                    }),
                }).catch(() => {}); // non-blocking

                onTaskDelegated?.();
                onClose();
            } else {
                showToast('Failed to delegate task', 'error');
            }
        } catch {
            showToast('Delegation error', 'error');
        }

        setDelegating(false);
    }

    // ─── Close on Escape ──────────────────────────────

    useEffect(() => {
        function onKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [onClose]);

    // ─── Render ───────────────────────────────────────

    return (
        <div className="mcm-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="mcm-modal">
                {/* ── Header ── */}
                <div className="mcm-header">
                    <div className="mcm-header-left">
                        <div className="mcm-avatar" style={{ background: avatarUrl ? 'transparent' : avatarColor }}>
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={memberName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            ) : initials}
                        </div>
                        <div className="mcm-header-info">
                            <div className="mcm-header-name">{memberName}</div>
                            <div className="mcm-header-context">
                                {projectName && (
                                    <>
                                        <FolderOpen size={10} />
                                        <span>{projectName}</span>
                                    </>
                                )}
                                {taskTitle && (
                                    <span className="mcm-task-badge">Task: {taskTitle.substring(0, 40)}</span>
                                )}
                            </div>
                        </div>
                    </div>
                    <button className="mcm-close-btn" onClick={onClose} title="Close">
                        <X size={16} />
                    </button>
                </div>

                {/* ── Messages ── */}
                <div className="mcm-messages">
                    {messages.length === 0 && !sending && (
                        <div className="mcm-messages-empty">
                            <MessageCircle size={32} style={{ color: '#52525b' }} />
                            <p>Start a conversation with {firstName}</p>
                            <p style={{ fontSize: 11, color: '#52525b', fontStyle: 'italic' }}>
                                {taskTitle ? `Task: "${taskTitle}"` : `Try: "Good morning, what's the status today?"`}
                            </p>
                        </div>
                    )}

                    {messages.map(msg => (
                        <div key={msg.id} className={`mw-msg ${msg.role}`}>
                            <div className="mw-msg-avatar">
                                {msg.role === 'assistant' ? (
                                    <span className="mw-msg-ai-avatar" style={{ background: avatarUrl ? 'transparent' : avatarColor, overflow: 'hidden' }}>
                                        {avatarUrl ? (
                                            <img src={avatarUrl} alt={firstName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                        ) : initials.charAt(0)}
                                    </span>
                                ) : (
                                    <span style={{ width: 32, height: 32, borderRadius: '50%', background: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#a1a1aa' }}>You</span>
                                )}
                            </div>
                            <div className="mw-msg-body">
                                {msg.skill && (
                                    <span className="mw-msg-skill-badge"><Zap size={8} /> {msg.skill}</span>
                                )}
                                <div className="mw-msg-text">{msg.content}</div>
                            </div>
                        </div>
                    ))}

                    {/* Delegate / Generate Output card */}
                    {isReady && !delegating && (
                        <div style={{ padding: '8px 0' }}>
                            <div className="mcm-delegate-card">
                                <div className="mcm-delegate-header">
                                    <Sparkles size={14} style={{ color: '#D2F000' }} />
                                    <span>{firstName} is ready to work on this task</span>
                                </div>
                                {Object.keys(extractedParams).length > 0 && (
                                    <div className="mcm-delegate-params">
                                        {Object.entries(extractedParams).filter(([k]) => !['language', 'length'].includes(k)).map(([key, val]) => (
                                            <span key={key} className="mcm-delegate-chip">{key}: {val}</span>
                                        ))}
                                    </div>
                                )}
                                <button
                                    className="mcm-delegate-btn"
                                    onClick={handleDelegateTask}
                                    disabled={delegating}
                                >
                                    <ArrowRight size={14} />
                                    Delegate to {firstName} &amp; Generate Output
                                </button>
                                <div className="mcm-delegate-hint">
                                    The task will be assigned to {firstName} who will process it in the background.
                                    You&apos;ll be notified when the draft is ready.
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Delegating indicator */}
                    {delegating && (
                        <div style={{ padding: '16px 0', textAlign: 'center' }}>
                            <Loader size={18} className="spin" style={{ color: '#D2F000' }} />
                            <div style={{ fontSize: 12, color: '#a1a1aa', marginTop: 8 }}>Delegating to {firstName}...</div>
                        </div>
                    )}

                    {/* Typing indicator */}
                    {sending && (
                        <div className="mw-msg assistant">
                            <div className="mw-msg-avatar">
                                <span className="mw-msg-ai-avatar" style={{ background: avatarUrl ? 'transparent' : avatarColor, overflow: 'hidden' }}>
                                    {avatarUrl ? (
                                        <img src={avatarUrl} alt={firstName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                    ) : initials.charAt(0)}
                                </span>
                            </div>
                            <div className="mw-msg-body">
                                <div className="mw-msg-typing"><span /><span /><span /></div>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* ── Skill chips ── */}
                {pinnedSkills.length > 0 && (
                    <div className="mcm-skill-chips">
                        {pinnedSkills.map(skill => (
                            <button
                                key={skill.key}
                                className={`mw-skill-chip ${selectedSkill === skill.key ? 'active' : ''}`}
                                onClick={() => setSelectedSkill(prev => prev === skill.key ? null : skill.key)}
                            >
                                <Zap size={10} /> {skill.name}
                            </button>
                        ))}
                    </div>
                )}

                {/* ── Compose Area ── */}
                <div className="mcm-compose-area">
                    {/* Attached chips */}
                    {attachedDocIds.length > 0 && (
                        <div className="mcm-attached-chips">
                            {attachedDocIds.map(docId => {
                                const doc = projectDocs.find(d => d.id === docId);
                                return (
                                    <div key={docId} className="mw-attached-chip">
                                        <FileText size={12} />
                                        <span className="mw-chip-name">{doc?.filename || 'Document'}</span>
                                        <button className="mw-chip-remove" onClick={() => setAttachedDocIds(prev => prev.filter(id => id !== docId))}>
                                            <X size={10} />
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* Composer row */}
                    <div className="mcm-composer-row">
                        {/* Attach button */}
                        <div style={{ position: 'relative' }}>
                            <button
                                className={`mw-attach-btn ${showDocPicker ? 'active' : ''}`}
                                onClick={() => setShowDocPicker(!showDocPicker)}
                                title="Attach documents"
                            >
                                <Paperclip size={16} />
                                {attachedDocIds.length > 0 && (
                                    <span className="mw-attach-badge">{attachedDocIds.length}</span>
                                )}
                            </button>

                            {/* Doc Picker */}
                            {showDocPicker && (
                                <div className="mw-doc-picker">
                                    <div className="mw-doc-picker-header">
                                        <span>Attach Documents</span>
                                        <button className="mw-doc-picker-close" onClick={() => setShowDocPicker(false)}><X size={14} /></button>
                                    </div>
                                    <div
                                        className={`mw-doc-upload-zone ${isDragging ? 'dragging' : ''}`}
                                        onClick={() => fileInputRef.current?.click()}
                                        onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                                        onDragLeave={() => setIsDragging(false)}
                                        onDrop={e => { e.preventDefault(); setIsDragging(false); handleFileUpload(e.dataTransfer.files); }}
                                    >
                                        {uploadingFile ? (
                                            <div className="mw-doc-uploading"><Loader size={14} className="spin" /> Uploading...</div>
                                        ) : (
                                            <>
                                                <Upload size={16} style={{ color: '#71717a' }} />
                                                <div className="mw-doc-upload-label">Drop files or <span>browse</span></div>
                                                <div className="mw-doc-upload-hint">PDF, DOCX, TXT, images</div>
                                            </>
                                        )}
                                    </div>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        multiple
                                        style={{ display: 'none' }}
                                        onChange={e => handleFileUpload(e.target.files)}
                                        accept=".pdf,.doc,.docx,.txt,.md,.csv,.xls,.xlsx,.png,.jpg,.jpeg,.gif,.webp"
                                    />

                                    {projectId && (
                                        <>
                                            <div className="mw-doc-picker-divider" />
                                            <div className="mw-doc-picker-section">Project Documents</div>
                                            <div className="mw-doc-search">
                                                <Search size={12} />
                                                <input
                                                    placeholder="Search documents..."
                                                    value={docSearchQuery}
                                                    onChange={e => setDocSearchQuery(e.target.value)}
                                                />
                                            </div>
                                            <div className="mw-doc-list">
                                                {projectDocsLoading ? (
                                                    <div className="mw-doc-empty"><Loader size={12} className="spin" /> Loading...</div>
                                                ) : (() => {
                                                    const filtered = projectDocs.filter(d =>
                                                        !docSearchQuery || d.filename.toLowerCase().includes(docSearchQuery.toLowerCase())
                                                    );
                                                    if (filtered.length === 0) {
                                                        return <div className="mw-doc-empty">No documents found</div>;
                                                    }
                                                    return filtered.map(doc => (
                                                        <button
                                                            key={doc.id}
                                                            className={`mw-doc-item ${attachedDocIds.includes(doc.id) ? 'selected' : ''}`}
                                                            onClick={() => toggleDocAttachment(doc.id)}
                                                        >
                                                            <div className="mw-doc-item-check">
                                                                {attachedDocIds.includes(doc.id) && <Check size={10} />}
                                                            </div>
                                                            <span className="mw-doc-item-name">{doc.filename}</span>
                                                            <span className="mw-doc-item-size">{formatFileSize(doc.size)}</span>
                                                        </button>
                                                    ));
                                                })()}
                                            </div>
                                        </>
                                    )}

                                    {!projectId && (
                                        <>
                                            <div className="mw-doc-picker-divider" />
                                            <div className="mw-doc-empty" style={{ paddingBottom: 12 }}>
                                                No project context selected
                                            </div>
                                        </>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <input
                            type="text"
                            className="mw-composer-input"
                            placeholder={`Talk to ${firstName}...`}
                            value={inputText}
                            onChange={e => setInputText(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
                            disabled={sending}
                            autoFocus
                        />

                        {/* Send */}
                        <button
                            className="mw-send-btn"
                            onClick={() => handleSendMessage()}
                            disabled={!inputText.trim() || sending}
                        >
                            {sending ? <Loader size={14} className="spin" /> : <Send size={14} />}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
