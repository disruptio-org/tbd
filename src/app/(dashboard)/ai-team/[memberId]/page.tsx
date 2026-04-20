'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useUIFeedback } from '@/components/UIFeedback';
import {
    ArrowLeft, Settings, Zap, Loader, Send, Mic, Clock,
    LayoutGrid, List, RefreshCw, CheckCircle2, AlertCircle,
    Eye, ChevronRight, Bot, User, Sparkles, MessageCircle,
    BarChart3, History, Brain, Save, TrendingUp, Target, Award, Activity,
    FolderOpen, ExternalLink, FileText, Paperclip, Upload, X, Check, Search,
    ThumbsUp, RotateCcw, CheckCheck,
} from 'lucide-react';
import './ai-member-workspace.css';
import { ArtifactBubble, type BubbleState, type ArtifactMeta } from '@/components/artifacts/ArtifactBubble';
import { ArtifactViewer } from '@/components/artifacts/ArtifactViewer';

// ─── Avatar helper ──────────────────────────────────────

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

// ─── Types ───────────────────────────────────────────────

interface BrainMember {
    id: string;
    brainType: string;
    name: string;
    description: string | null;
    status: string;
    isEnabled: boolean;
    configJson?: {
        identity?: {
            displayName?: string;
            avatarUrl?: string;
            tonePreset?: string;
            communicationStyle?: string;
            personalityTraits?: string[];
            formality?: number;
            assertiveness?: number;
        };
        taskBehavior?: {
            autonomyLevel?: number;
        };
    };
}

interface SkillItem {
    id: string;
    name: string;
    key: string;
    icon: string | null;
    description: string | null;
    status: string;
}

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
    skillKey?: string;
    actionRun?: {
        id: string;
        status: string;
        resultSummary?: string;
        inlinePreview?: string;
        deepLink?: string;
        intentType?: string;
        targetModule?: string;
    };
}

interface WorkItem {
    id: string;
    title: string;
    status: 'working' | 'needs_approval' | 'blocked' | 'done';
    sourceType: 'task' | 'initiative';
    sourceId: string;
    linkedOutputId?: string;
    requiresApproval: boolean;
    updatedAt: string;
    description?: string;
    progressStep?: string;
}

interface ApprovalItem {
    id: string;
    title: string;
    description: string;
    status: 'waiting' | 'approved' | 'rejected';
    sourceType: string;
}

type TabKey = 'workspace' | 'history' | 'skills' | 'configuration' | 'performance';

const TAB_CONFIG: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: 'workspace', label: 'Workspace', icon: <MessageCircle size={14} /> },
    { key: 'history', label: 'History', icon: <History size={14} /> },
    { key: 'skills', label: 'Skills', icon: <Zap size={14} /> },
    { key: 'configuration', label: 'Configuration', icon: <Settings size={14} /> },
    { key: 'performance', label: 'Performance', icon: <BarChart3 size={14} /> },
];

// ─── Component ────────────────────────────────────────────

export default function AIMemberWorkspacePage() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const { showToast } = useUIFeedback();
    const memberId = params.memberId as string;

    // Core state
    const [loading, setLoading] = useState(true);
    const [member, setMember] = useState<BrainMember | null>(null);
    const [skills, setSkills] = useState<SkillItem[]>([]);
    const [activeTab, setActiveTab] = useState<TabKey>('workspace');

    // Conversation state
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [inputText, setInputText] = useState('');
    const [selectedSkill, setSelectedSkill] = useState<string | null>(null);
    const [sending, setSending] = useState(false);
    const [sessionId, setSessionId] = useState<string | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // Project context state
    const [projects, setProjects] = useState<Array<{ id: string; name: string }>>([]);
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    // Briefing state
    const [briefingText, setBriefingText] = useState<string | null>(null);
    const [briefingStats, setBriefingStats] = useState<{ working: number; needsApproval: number; blocked: number; done: number } | null>(null);
    const [refreshingBriefing, setRefreshingBriefing] = useState(false);

    // Approvals state
    const [approvals, setApprovals] = useState<ApprovalItem[]>([]);

    // Tasks state
    const [workItems, setWorkItems] = useState<WorkItem[]>([]);
    const [taskView, setTaskView] = useState<'board' | 'table'>('board');
    const [executingTaskId, setExecutingTaskId] = useState<string | null>(null);
    const [selectedTask, setSelectedTask] = useState<WorkItem | null>(null);
    const [taskActionLoading, setTaskActionLoading] = useState(false);

    // History state
    const [historySessions, setHistorySessions] = useState<Array<{ id: string; startedAt: string; status: string; messageCount: number; lastMessage?: string }>>([]);
    const [historyLoading, setHistoryLoading] = useState(false);

    // Configuration state
    const [configEditing, setConfigEditing] = useState(false);
    const [configName, setConfigName] = useState('');
    const [configDesc, setConfigDesc] = useState('');
    const [configSaving, setConfigSaving] = useState(false);

    // Performance state (computed from tasks/approvals data)

    // Artifact state (Design & Brand Director)
    const [artifactId, setArtifactId] = useState<string | null>(null);
    const [bubbleState, setBubbleState] = useState<BubbleState>('collecting');
    const [artifactMeta, setArtifactMeta] = useState<ArtifactMeta>({});
    const [artifactProgressIndex, setArtifactProgressIndex] = useState(0);
    const [artifactVersions, setArtifactVersions] = useState<any[]>([]);
    const [artifactData, setArtifactData] = useState<any | null>(null);
    const [viewerOpen, setViewerOpen] = useState(false);
    const [isIterating, setIsIterating] = useState(false);

    // All agents support drafting artifacts based on the skills system
    const isArtifactAgent = true;

    // Document attachment state
    const [attachedDocIds, setAttachedDocIds] = useState<string[]>([]);
    const [showDocPicker, setShowDocPicker] = useState(false);
    const [projectDocs, setProjectDocs] = useState<Array<{ id: string; filename: string; mimeType: string; size: number }>>([]);
    const [projectDocsLoading, setProjectDocsLoading] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);
    const [docSearchQuery, setDocSearchQuery] = useState('');
    const [isDragging, setIsDragging] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // ─── Load member ─────────────────────────────────────

    const loadMember = useCallback(async () => {
        try {
            const res = await fetch(`/api/ai/brains/${memberId}`);
            if (!res.ok) { router.push('/ai-team'); return; }
            const data = await res.json();
            setMember(data.brain as BrainMember);
        } catch {
            showToast('Error loading AI member', 'error');
            router.push('/ai-team');
        }
        setLoading(false);
    }, [memberId, router, showToast]);

    // ─── Load projects ────────────────────────────────────

    const loadProjects = useCallback(async () => {
        try {
            const res = await fetch('/api/projects');
            if (res.ok) {
                const data = await res.json();
                setProjects((data.projects || []).map((p: any) => ({ id: p.id, name: p.name })));
            }
        } catch { /* non-critical */ }
    }, []);

    // ─── Load skills ─────────────────────────────────────

    const loadSkills = useCallback(async () => {
        if (!member) return;
        try {
            const assistantType = member.brainType === 'COMPANY' ? 'COMPANY' : member.brainType;
            const res = await fetch(`/api/ai/skills?assistantType=${assistantType}`);
            const data = await res.json();
            setSkills((data.skills || []).filter((s: SkillItem) => s.status === 'ACTIVE').slice(0, 8));
        } catch { setSkills([]); }
    }, [member]);

    // ─── Load briefing ────────────────────────────────────

    const loadBriefing = useCallback(async () => {
        setRefreshingBriefing(true);
        try {
            const res = await fetch(`/api/ai/members/${memberId}/briefing`);
            if (res.ok) {
                const data = await res.json();
                setBriefingText(data.briefingText || null);
                setBriefingStats(data.stats || null);
            }
        } catch { /* non-critical */ }
        setRefreshingBriefing(false);
    }, [memberId]);

    // ─── Load approvals ──────────────────────────────────

    const loadApprovals = useCallback(async () => {
        try {
            const res = await fetch(`/api/ai/members/${memberId}/approvals`);
            if (res.ok) {
                const data = await res.json();
                setApprovals(data.items || []);
            }
        } catch { /* non-critical */ }
    }, [memberId]);

    // ─── Load tasks ──────────────────────────────────────

    const loadTasks = useCallback(async () => {
        try {
            const res = await fetch(`/api/ai/members/${memberId}/tasks`);
            if (res.ok) {
                const data = await res.json();
                setWorkItems(data.items || []);
            }
        } catch { /* non-critical */ }
    }, [memberId]);

    // ─── Initial load ─────────────────────────────────────

    // ─── Load history sessions ────────────────────────────

    const loadHistory = useCallback(async () => {
        setHistoryLoading(true);
        try {
            const res = await fetch(`/api/ai/members/${memberId}/history`);
            if (res.ok) {
                const data = await res.json();
                setHistorySessions(data.sessions || []);
            }
        } catch { /* non-critical */ }
        setHistoryLoading(false);
    }, [memberId]);

    // ─── Load project documents ──────────────────────────

    const loadProjectDocs = useCallback(async (projId: string) => {
        if (!projId) { setProjectDocs([]); return; }
        setProjectDocsLoading(true);
        try {
            const res = await fetch(`/api/documents/upload?projectId=${projId}`);
            if (res.ok) {
                const data = await res.json();
                // /api/documents/upload GET returns a plain array
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
    }, []);

    // Auto-load project docs when project changes
    useEffect(() => {
        if (selectedProjectId) {
            loadProjectDocs(selectedProjectId);
        } else {
            setProjectDocs([]);
        }
    }, [selectedProjectId, loadProjectDocs]);

    // ─── File upload handler ─────────────────────────────

    async function handleFileUpload(files: FileList | null) {
        if (!files || files.length === 0) return;
        setUploadingFile(true);
        for (const file of Array.from(files)) {
            try {
                const formData = new FormData();
                formData.append('file', file);
                if (selectedProjectId) formData.append('projectId', selectedProjectId);
                const res = await fetch('/api/documents/upload', { method: 'POST', body: formData });
                if (res.ok) {
                    const doc = await res.json();
                    // Add to projectDocs list
                    setProjectDocs(prev => [{ id: doc.id, filename: doc.filename, mimeType: doc.mimeType || '', size: doc.size || 0 }, ...prev]);
                    // Auto-attach
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

    function formatFileSize(bytes: number): string {
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    }

    // ─── Save config ─────────────────────────────────────

    async function handleSaveConfig() {
        setConfigSaving(true);
        try {
            const res = await fetch(`/api/ai/brains/${memberId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: configName, description: configDesc }),
            });
            if (res.ok) {
                showToast('Configuration saved', 'success');
                setConfigEditing(false);
                loadMember();
            } else {
                showToast('Error saving configuration', 'error');
            }
        } catch {
            showToast('Connection error', 'error');
        }
        setConfigSaving(false);
    }

    useEffect(() => { loadMember(); loadProjects(); }, [loadMember, loadProjects]);
    useEffect(() => {
        if (member) {
            loadSkills();
            loadBriefing();
            loadApprovals();
            loadTasks();
            setConfigName(member.name);
            setConfigDesc(member.description || '');
        }
    }, [member, loadSkills, loadBriefing, loadApprovals, loadTasks]);

    // Auto-poll tasks when there's active processing
    useEffect(() => {
        const hasProcessing = workItems.some(
            i => i.progressStep && !['done', 'error'].includes(i.progressStep) && i.status === 'working'
        );
        if (!hasProcessing || !member) return;
        const interval = setInterval(() => loadTasks(), 5000);
        return () => clearInterval(interval);
    }, [workItems, member, loadTasks]);

    // Load history when switching to history tab
    useEffect(() => {
        if (activeTab === 'history' && member) {
            loadHistory();
        }
    }, [activeTab, member, loadHistory]);

    // Initialize selectedProjectId from URL params (e.g. when coming from task delegation)
    useEffect(() => {
        const urlProjectId = searchParams.get('projectId');
        if (urlProjectId && projects.length > 0 && !selectedProjectId) {
            const match = projects.find(p => p.id === urlProjectId);
            if (match) {
                setSelectedProjectId(urlProjectId);
            }
        }
    }, [projects, searchParams, selectedProjectId]);

    // ─── Auto-scroll messages ─────────────────────────────

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ─── Send message ─────────────────────────────────────

    async function handleSend() {
        if (!inputText.trim() || sending) return;

        const userMsg: ChatMessage = {
            id: crypto.randomUUID(),
            role: 'user',
            content: inputText.trim(),
            timestamp: new Date().toISOString(),
            skillKey: selectedSkill || undefined,
        };
        setMessages(prev => [...prev, userMsg]);
        setInputText('');
        setSending(true);

        try {
            // Build chat history for the conversational pipeline
            const chatHistory = [...messages, userMsg].map(m => ({
                role: m.role,
                content: m.content,
            }));

            const res = await fetch(`/api/ai/members/${memberId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: userMsg.content,
                    sessionId,
                    skillKey: selectedSkill || undefined,
                    projectId: selectedProjectId || undefined,
                    messages: chatHistory,
                    extractedParams: artifactMeta,
                    contentType: selectedSkill || '',
                    availableContentTypes: skills.map(s => s.key),
                    docIds: attachedDocIds.length > 0 ? attachedDocIds : undefined,
                }),
            });

            const contentType = res.headers.get('content-type') || '';
            if (!contentType.includes('application/json')) {
                console.error('[chat] Non-JSON response:', res.status, contentType);
                showToast('Server returned an unexpected response. Please refresh.', 'error');
                setSending(false);
                return;
            }

            const data = await res.json();

            if (res.ok) {
                if (data.sessionId) setSessionId(data.sessionId);
                const aiMsg: ChatMessage = {
                    id: crypto.randomUUID(),
                    role: 'assistant',
                    content: data.response || 'I received your message.',
                    timestamp: new Date().toISOString(),
                    actionRun: data.actionRun || undefined,
                };
                setMessages(prev => [...prev, aiMsg]);

                // ── Artifact state detection ──
                if (isArtifactAgent && data.actionRun?.targetModule === 'design') {
                    const run = data.actionRun;
                    if (run.status === 'SUCCESS' && run.resultSummary) {
                        setBubbleState('generated');
                    }
                } else if (isArtifactAgent) {
                    // Use extractedParams from the conversational pipeline if available
                    if (data.extractedParams && Object.keys(data.extractedParams).length > 0) {
                        const ep = data.extractedParams;
                        const newMeta: ArtifactMeta = {
                            audience: (ep.audience as string) || artifactMeta.audience,
                            goal: (ep.goal as string) || artifactMeta.goal,
                            contentType: (ep.contentType as string) || (ep.outputType as string) || artifactMeta.contentType,
                            topic: (ep.topic as string) || (ep.productOrFeature as string) || artifactMeta.topic,
                        };
                        setArtifactMeta(newMeta);

                        if (data.isReady) {
                            setBubbleState('ready');
                        } else {
                            // Check if we have enough to show progress
                            const required = ['contentType', 'topic'];
                            const filled = required.filter(k => newMeta[k as keyof ArtifactMeta]);
                            setBubbleState(filled.length >= 2 ? 'ready' : 'collecting');
                        }
                    } else {
                        // Fallback: parse assistant text for slot-filling cues
                        const msg = (data.response || '').toLowerCase();
                        const newMeta = { ...artifactMeta };
                        if (msg.includes('audience') && userMsg.content.length < 100) {
                            newMeta.audience = userMsg.content;
                        }
                        if (msg.includes('goal') && userMsg.content.length < 100) {
                            newMeta.goal = userMsg.content;
                        }
                        if (msg.includes('wireframe') || msg.includes('wireframing')) {
                            newMeta.contentType = 'wireframe';
                        }
                        if (msg.includes('topic') || msg.includes('page')) {
                            newMeta.topic = userMsg.content;
                        }
                        setArtifactMeta(newMeta);

                        // Check readiness
                        const required = ['contentType', 'topic'];
                        const filled = required.filter(k => newMeta[k as keyof ArtifactMeta]);
                        if (filled.length >= 2) {
                            setBubbleState('ready');
                        } else {
                            setBubbleState('collecting');
                        }
                    }
                }
            } else {
                console.error('[chat] API error:', data);
                showToast(data.error || 'Message failed', 'error');
            }
        } catch (err) {
            console.error('[chat] Fetch error:', err);
            showToast('Connection error', 'error');
        }

        setSending(false);
        setSelectedSkill(null);
        setAttachedDocIds([]);
        setShowDocPicker(false);
    }

    // ─── Approve handler ──────────────────────────────────

    async function handleApprove(approvalId: string) {
        try {
            const res = await fetch(`/api/ai/members/${memberId}/approvals`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ approvalId, action: 'approve' }),
            });
            if (res.ok) {
                showToast('Approved!', 'success');
                loadApprovals();
                loadTasks();
            }
        } catch {
            showToast('Error approving', 'error');
        }
    }

    // ─── Loading ──────────────────────────────────────────

    if (loading || !member) {
        return (
            <div className="mw-loading">
                <div className="spinner" />
            </div>
        );
    }

    const memberName = member.configJson?.identity?.displayName || member.name;
    const firstName = memberName.split(' ')[0];
    const initials = getInitials(memberName);
    const avatarColor = getAvatarColor(memberName);
    const avatarUrl = member.configJson?.identity?.avatarUrl || null;
    const roleLabel = member.description
        || member.brainType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    const isActive = member.status === 'ACTIVE' && member.isEnabled;
    const pinnedSkills = skills.slice(0, 5);

    // ─── Render ───────────────────────────────────────────

    return (
        <div className="mw-page">
            {/* ═══ FIXED PAGE HEADER (Nousio Standard) ═══ */}
            <div className="assistant-page-header">
                <div className="assistant-page-title">
                    <button className="mw-back-btn" onClick={() => router.push('/team')} title="Back to Team">
                        <ArrowLeft size={16} />
                    </button>
                    <div className="mw-avatar" style={{ background: avatarUrl ? 'transparent' : avatarColor, overflow: 'hidden' }}>
                        {avatarUrl ? (
                            <img src={avatarUrl} alt={memberName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                        ) : (
                            initials
                        )}
                    </div>
                    <h1>{memberName}</h1>
                    <span className={`mw-status-dot ${isActive ? 'active' : 'inactive'}`} />
                    <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--color-text-secondary)', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>
                        {isActive ? 'Active' : 'Inactive'}
                    </span>
                </div>
                <div className="mw-header-right">
                    <button className="btn btn-primary" onClick={() => setActiveTab('skills')}>
                        <Zap size={14} /> Run Skill
                    </button>
                    <button className="btn btn-secondary" onClick={() => router.push(`/settings/ai-brain/${member.brainType.toLowerCase()}`)}>
                        <Settings size={14} /> Configure
                    </button>
                </div>
            </div>

            {/* ═══ TABS ═══ */}
            <nav className="mw-tabs">
                {TAB_CONFIG.map(tab => (
                    <button
                        key={tab.key}
                        className={`mw-tab ${activeTab === tab.key ? 'active' : ''}`}
                        onClick={() => setActiveTab(tab.key)}
                    >
                        {tab.icon} {tab.label}
                    </button>
                ))}
            </nav>

            {/* ═══ WORKSPACE TAB ═══ */}
            {activeTab === 'workspace' && (
                <div className="mw-workspace">
                    {/* ── Two-column layout: Conversation (left) + Today (right) ── */}
                    <div className="mw-main-grid">
                        {/* ── CONVERSATION PANEL ── */}
                        <div className="mw-conversation">
                            <div className="mw-conv-header">
                                <div className="mw-conv-title">
                                    <MessageCircle size={16} />
                                    <span>Talk to {firstName}</span>
                                </div>
                                <div className="mw-conv-actions">
                                    <div className="mw-project-select-wrapper">
                                        <FolderOpen size={12} className="mw-project-select-icon" />
                                        <select
                                            className="mw-project-select"
                                            value={selectedProjectId}
                                            onChange={e => setSelectedProjectId(e.target.value)}
                                        >
                                            <option value="">All Projects</option>
                                            {projects.map(p => (
                                                <option key={p.id} value={p.id}>{p.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <button className="mw-icon-btn" title="Voice (coming soon)" disabled>
                                        <Mic size={14} />
                                    </button>
                                    <button className="mw-icon-btn" title="History" onClick={() => setActiveTab('history')}>
                                        <Clock size={14} />
                                    </button>
                                </div>
                            </div>

                            {/* Message thread */}
                            <div className="mw-messages">
                                {messages.length === 0 && (
                                    <div className="mw-messages-empty">
                                        <Bot size={32} style={{ opacity: 0.2 }} />
                                        <p>Start a conversation with {firstName}.</p>
                                        <p className="mw-messages-hint">Try: &quot;Good morning, what&apos;s the status today?&quot;</p>
                                    </div>
                                )}
                                {messages.map(msg => (
                                    <div key={msg.id} className={`mw-msg ${msg.role}`}>
                                        <div className="mw-msg-avatar">
                                            {msg.role === 'user' ? (
                                                <User size={14} />
                                            ) : (
                                                <span className="mw-msg-ai-avatar" style={{ background: avatarUrl ? 'transparent' : avatarColor, overflow: 'hidden' }}>
                                                    {avatarUrl ? (
                                                        <img src={avatarUrl} alt={firstName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                                    ) : (
                                                        initials.charAt(0)
                                                    )}
                                                </span>
                                            )}
                                        </div>
                                        <div className="mw-msg-body">
                                            <div className="mw-msg-meta">
                                                <span className="mw-msg-sender">{msg.role === 'user' ? 'You' : firstName}</span>
                                                <span className="mw-msg-time">
                                                    {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                </span>
                                            </div>
                                            <div className="mw-msg-text">{msg.content}</div>
                                            {msg.skillKey && (
                                                <span className="mw-msg-skill-badge"><Zap size={10} /> {msg.skillKey}</span>
                                            )}
                                            {/* Inline result preview */}
                                            {msg.actionRun && (msg.actionRun.resultSummary || msg.actionRun.inlinePreview || msg.actionRun.deepLink) && (
                                                <div className="mw-msg-result-card">
                                                    <div className="mw-msg-result-header">
                                                        <FileText size={12} />
                                                        <span>Result Output</span>
                                                        {msg.actionRun.targetModule && (
                                                            <span className="mw-msg-result-module">{msg.actionRun.targetModule}</span>
                                                        )}
                                                    </div>
                                                    {(msg.actionRun.inlinePreview || msg.actionRun.resultSummary) && (
                                                        <div className="mw-msg-result-body">
                                                            {msg.actionRun.inlinePreview || msg.actionRun.resultSummary}
                                                        </div>
                                                    )}
                                                    {msg.actionRun.deepLink && (
                                                        <a
                                                            href={msg.actionRun.deepLink}
                                                            className="mw-msg-result-link"
                                                            onClick={(e) => { e.preventDefault(); router.push(msg.actionRun!.deepLink!); }}
                                                        >
                                                            <ExternalLink size={11} /> View Full Result
                                                        </a>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ))}
                                {/* ── Artifact Bubble (Design agents) ── */}
                                {isArtifactAgent && messages.length > 0 && (() => {
                                    const resolveType = (typeKey?: string) => skills.find(s => s.key === typeKey)?.name || typeKey;
                                    const mappedMeta = { ...artifactMeta, contentType: resolveType(artifactMeta.contentType) };
                                    
                                    return (
                                    <div style={{ margin: '12px 0' }}>
                                        <ArtifactBubble
                                            agentName={member?.name || 'NOUSIO'}
                                            agentRole={member?.brainType === 'DESIGN_BRAND' ? 'Design & Brand Director' : member?.description || ''}
                                            state={bubbleState}
                                            metadata={mappedMeta}
                                            missingFields={['contentType', 'topic'].filter(k => !mappedMeta[k as keyof ArtifactMeta])}
                                            progressIndex={artifactProgressIndex}
                                            currentVersion={artifactVersions.length > 0 ? {
                                                label: `v${artifactVersions[artifactVersions.length - 1].versionNumber}`,
                                                title: artifactData?.title || 'Generating...',
                                                summary: artifactData?.summary || '',
                                            } : undefined}
                                            onGenerate={async () => {
                                                setBubbleState('generating');
                                                setArtifactProgressIndex(0);
                                                const t1 = setTimeout(() => setArtifactProgressIndex(1), 800);
                                                const t2 = setTimeout(() => setArtifactProgressIndex(2), 1600);
                                                try {
                                                    // Create artifact if not yet created
                                                    let artId = artifactId;
                                                    if (!artId) {
                                                        const createRes = await fetch('/api/artifacts', {
                                                            method: 'POST',
                                                            headers: { 'Content-Type': 'application/json' },
                                                            body: JSON.stringify({
                                                                sessionId: sessionId || crypto.randomUUID(),
                                                                agentId: memberId,
                                                                artifactType: mappedMeta.contentType || 'draft',
                                                                title: `${mappedMeta.contentType || 'Draft'} — ${mappedMeta.topic || 'Draft'}`,
                                                                metadata: mappedMeta,
                                                            }),
                                                        });
                                                        if (createRes.ok) {
                                                            const createData = await createRes.json();
                                                            artId = createData.artifact.id;
                                                            setArtifactId(artId!);
                                                            setArtifactData(createData.artifact);
                                                        } else {
                                                            throw new Error('Failed to create artifact');
                                                        }
                                                    }
                                                    // Generate
                                                    const genRes = await fetch(`/api/artifacts/${artId}/generate`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({
                                                            prompt: `Create a ${mappedMeta.contentType || 'draft'} for ${mappedMeta.topic || 'the request'}. Audience: ${mappedMeta.audience || 'general'}. Goal: ${mappedMeta.goal || 'inform'}.`,
                                                            metadata: mappedMeta,
                                                        }),
                                                    });
                                                    clearTimeout(t1); clearTimeout(t2);
                                                    if (genRes.ok) {
                                                        const genData = await genRes.json();
                                                        setArtifactVersions([genData.version]);
                                                        setArtifactData(genData.artifact);
                                                        setBubbleState('generated');
                                                        showToast('Artifact generated successfully', 'success');
                                                    } else {
                                                        setBubbleState('ready');
                                                        showToast('Generation failed', 'error');
                                                    }
                                                } catch (err) {
                                                    clearTimeout(t1); clearTimeout(t2);
                                                    setBubbleState('ready');
                                                    showToast('Generation error', 'error');
                                                    console.error('[artifact gen]', err);
                                                }
                                            }}
                                            onView={() => setViewerOpen(true)}
                                            onRegenerate={async () => {
                                                if (!artifactId) return;
                                                setBubbleState('generating');
                                                setArtifactProgressIndex(0);
                                                const t1 = setTimeout(() => setArtifactProgressIndex(1), 800);
                                                const t2 = setTimeout(() => setArtifactProgressIndex(2), 1600);
                                                try {
                                                    const res = await fetch(`/api/artifacts/${artifactId}/generate`, {
                                                        method: 'POST',
                                                        headers: { 'Content-Type': 'application/json' },
                                                        body: JSON.stringify({ prompt: `Regenerate ${artifactData?.title}`, metadata: mappedMeta }),
                                                    });
                                                    clearTimeout(t1); clearTimeout(t2);
                                                    if (res.ok) {
                                                        const data = await res.json();
                                                        setArtifactVersions(prev => [...prev, data.version]);
                                                        setArtifactData(data.artifact);
                                                        setBubbleState('generated');
                                                    } else { setBubbleState('ready'); showToast('Regeneration failed', 'error'); }
                                                } catch { clearTimeout(t1); clearTimeout(t2); setBubbleState('ready'); }
                                            }}
                                            onExport={() => {
                                                const current = artifactVersions[artifactVersions.length - 1];
                                                if (current?.outputPayload) {
                                                    const blob = new Blob([JSON.stringify(current.outputPayload, null, 2)], { type: 'application/json' });
                                                    const u = URL.createObjectURL(blob);
                                                    const a = document.createElement('a'); a.href = u; a.download = `${artifactData?.title || 'artifact'}.json`; a.click();
                                                    URL.revokeObjectURL(u);
                                                }
                                            }}
                                        />
                                    </div>
                                    );
                                })()}
                                {sending && (
                                    <div className="mw-msg assistant">
                                        <div className="mw-msg-avatar">
                                            <span className="mw-msg-ai-avatar" style={{ background: avatarUrl ? 'transparent' : avatarColor, overflow: 'hidden' }}>
                                                {avatarUrl ? (
                                                    <img src={avatarUrl} alt={firstName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                                                ) : (
                                                    initials.charAt(0)
                                                )}
                                            </span>
                                        </div>
                                        <div className="mw-msg-body">
                                            <div className="mw-msg-typing">
                                                <span /><span /><span />
                                            </div>
                                        </div>
                                    </div>
                                )}
                                <div ref={messagesEndRef} />
                            </div>

                            {/* Skill chips */}
                            {pinnedSkills.length > 0 && (
                                <div className="mw-skill-chips">
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

                            {/* Composer Area */}
                            <div className="mw-compose-area">
                                {/* Attached document chips */}
                                {attachedDocIds.length > 0 && (
                                    <div className="mw-attached-chips">
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
                                <div className="mw-composer-row">
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

                                        {/* Doc Picker Popover */}
                                        {showDocPicker && (
                                            <div className="mw-doc-picker">
                                                <div className="mw-doc-picker-header">
                                                    <span>Attach Documents</span>
                                                    <button className="mw-doc-picker-close" onClick={() => setShowDocPicker(false)}><X size={14} /></button>
                                                </div>

                                                {/* Upload zone */}
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

                                                {/* Project documents section */}
                                                {selectedProjectId && (
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

                                                {!selectedProjectId && (
                                                    <>
                                                        <div className="mw-doc-picker-divider" />
                                                        <div className="mw-doc-empty" style={{ paddingBottom: 12 }}>
                                                            Select a project to browse its documents
                                                        </div>
                                                    </>
                                                )}
                                            </div>
                                        )}
                                    </div>

                                    {/* Text input */}
                                    <input
                                        type="text"
                                        className="mw-composer-input"
                                        placeholder={`Talk to ${firstName}...`}
                                        value={inputText}
                                        onChange={e => setInputText(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                                        disabled={sending}
                                    />

                                    {/* Send button */}
                                    <button
                                        className="mw-send-btn"
                                        onClick={handleSend}
                                        disabled={!inputText.trim() || sending}
                                    >
                                        {sending ? <Loader size={14} className="spin" /> : <Send size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* ── TODAY PANEL ── */}
                        <div className="mw-today-panel">
                            {/* Briefing Card */}
                            <div className="mw-card mw-briefing-card">
                                <div className="mw-card-header">
                                    <div className="mw-card-title">
                                        <Sparkles size={14} />
                                        <span>Today</span>
                                    </div>
                                    <button
                                        className="mw-icon-btn"
                                        onClick={loadBriefing}
                                        disabled={refreshingBriefing}
                                        title="Refresh Briefing"
                                    >
                                        <RefreshCw size={12} className={refreshingBriefing ? 'spin' : ''} />
                                    </button>
                                </div>
                                <div className="mw-briefing-content">
                                    {briefingText ? (
                                        <p className="mw-briefing-text">{briefingText}</p>
                                    ) : (
                                        <p className="mw-briefing-text mw-briefing-placeholder">
                                            Good morning. {firstName} is ready to work. Ask for a status update to get started.
                                        </p>
                                    )}
                                    {briefingStats && (
                                        <div className="mw-briefing-stats">
                                            <div className="mw-stat"><span className="mw-stat-num">{briefingStats.working}</span> Working</div>
                                            <div className="mw-stat"><span className="mw-stat-num mw-stat-warn">{briefingStats.needsApproval}</span> Approval</div>
                                            <div className="mw-stat"><span className="mw-stat-num mw-stat-danger">{briefingStats.blocked}</span> Blocked</div>
                                            <div className="mw-stat"><span className="mw-stat-num mw-stat-success">{briefingStats.done}</span> Done</div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Approvals Card */}
                            <div className="mw-card mw-approvals-card">
                                <div className="mw-card-header">
                                    <div className="mw-card-title">
                                        <AlertCircle size={14} />
                                        <span>Approvals</span>
                                        {approvals.length > 0 && (
                                            <span className="mw-badge">{approvals.length}</span>
                                        )}
                                    </div>
                                </div>
                                <div className="mw-approvals-list">
                                    {approvals.length === 0 ? (
                                        <p className="mw-empty-hint">No items waiting for approval</p>
                                    ) : (
                                        approvals.map(item => (
                                            <div key={item.id} className="mw-approval-item">
                                                <div className="mw-approval-info">
                                                    <div className="mw-approval-title">{item.title}</div>
                                                    {item.description && (
                                                        <div className="mw-approval-desc">{item.description}</div>
                                                    )}
                                                </div>
                                                <div className="mw-approval-actions">
                                                    <button className="mw-btn-sm mw-btn-ghost" title="Review">
                                                        <Eye size={12} /> Review
                                                    </button>
                                                    <button
                                                        className="mw-btn-sm mw-btn-approve"
                                                        onClick={() => handleApprove(item.id)}
                                                    >
                                                        <CheckCircle2 size={12} /> Approve
                                                    </button>
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* ── TASKS SECTION ── */}
                    <div className="mw-tasks-section">
                        <div className="mw-tasks-header">
                            <h3>Tasks</h3>
                            <div className="mw-view-toggle">
                                <button
                                    className={`mw-view-btn ${taskView === 'board' ? 'active' : ''}`}
                                    onClick={() => setTaskView('board')}
                                >
                                    <LayoutGrid size={13} /> Board
                                </button>
                                <button
                                    className={`mw-view-btn ${taskView === 'table' ? 'active' : ''}`}
                                    onClick={() => setTaskView('table')}
                                >
                                    <List size={13} /> Table
                                </button>
                            </div>
                        </div>

                        {/* Board View */}
                        {taskView === 'board' && (
                            <div className="mw-board">
                                {(['working', 'needs_approval', 'blocked', 'done'] as const).map(status => {
                                    const items = workItems.filter(i => i.status === status);
                                    const labels: Record<string, { label: string; color: string }> = {
                                        working: { label: 'Working', color: '#2563eb' },
                                        needs_approval: { label: 'Needs Approval', color: '#d97706' },
                                        blocked: { label: 'Blocked', color: '#dc2626' },
                                        done: { label: 'Done', color: '#059669' },
                                    };
                                    const { label, color } = labels[status];
                                    return (
                                        <div key={status} className="mw-board-column">
                                            <div className="mw-column-header">
                                                <span className="mw-column-dot" style={{ background: color }} />
                                                <span className="mw-column-label">{label}</span>
                                                <span className="mw-column-count">{items.length}</span>
                                            </div>
                                            <div className="mw-column-cards">
                                                {items.length === 0 && (
                                                    <div className="mw-column-empty">No items</div>
                                                )}
                                                {items.map(item => (
                                                    <div key={item.id} className="mw-task-card" onClick={() => setSelectedTask(item)} style={{ cursor: 'pointer' }}>
                                                        <div className="mw-task-title">{item.title}</div>
                                                        {item.description && (
                                                            <div className="mw-task-desc">{item.description}</div>
                                                        )}
                                                        {/* Processing progress for working tasks */}
                                                        {status === 'working' && item.progressStep && item.progressStep !== 'done' && (() => {
                                                            const STEPS = ['analyzing', 'generating', 'reviewing', 'finalizing'];
                                                            const LABELS = ['Analyzing context', 'Generating draft', 'Reviewing output', 'Finalizing'];
                                                            const currentIdx = STEPS.indexOf(item.progressStep || 'analyzing');
                                                            const pct = currentIdx >= 0 ? Math.min(((currentIdx + 1) / STEPS.length) * 100, 95) : 15;
                                                            return (
                                                                <div className="mw-task-progress">
                                                                    <div className="mw-progress-bar">
                                                                        <div className="mw-progress-fill" style={{ width: `${pct}%`, animation: 'mw-progress-pulse 2s ease-in-out infinite' }} />
                                                                    </div>
                                                                    <div className="mw-progress-steps">
                                                                        {LABELS.map((label, idx) => {
                                                                            const stepState = idx < currentIdx ? 'completed' : idx === currentIdx ? 'active' : 'pending';
                                                                            return (
                                                                                <div key={label} className={`mw-progress-step ${stepState}`}>
                                                                                    <div className="mw-step-dot" />
                                                                                    <span>{label}</span>
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
                                                                </div>
                                                            );
                                                        })()}
                                                        {/* Completed output notice */}
                                                        {item.progressStep === 'done' && (
                                                            <div className="mw-task-done-badge">✅ Output ready for review</div>
                                                        )}
                                                        {/* Run button for working tasks without active processing */}
                                                        {status === 'working' && !item.progressStep && item.sourceType === 'task' && (
                                                            <button
                                                                className="mw-task-run-btn"
                                                                disabled={executingTaskId === item.id}
                                                                onClick={async (e) => {
                                                                    e.stopPropagation();
                                                                    setExecutingTaskId(item.id);
                                                                    try {
                                                                        const res = await fetch(`/api/ai/members/${memberId}/execute-task`, {
                                                                            method: 'POST',
                                                                            headers: { 'Content-Type': 'application/json' },
                                                                            body: JSON.stringify({ taskId: item.id }),
                                                                        });
                                                                        if (res.ok) {
                                                                            showToast('Task execution started!', 'success');
                                                                            loadTasks();
                                                                        } else {
                                                                            showToast('Failed to start execution', 'error');
                                                                        }
                                                                    } catch {
                                                                        showToast('Execution error', 'error');
                                                                    }
                                                                    setExecutingTaskId(null);
                                                                }}
                                                            >
                                                                {executingTaskId === item.id ? (
                                                                    <><Loader size={11} className="spin" /> Processing...</>
                                                                ) : (
                                                                    <><Sparkles size={11} /> Run Task</>
                                                                )}
                                                            </button>
                                                        )}
                                                        <div className="mw-task-meta">
                                                            <span className="mw-task-source">{item.sourceType}</span>
                                                            {item.requiresApproval && (
                                                                <span className="mw-task-approval-badge">⏳ Approval</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Table View */}
                        {taskView === 'table' && (
                            <div className="mw-table-wrap">
                                <table className="mw-table">
                                    <thead>
                                        <tr>
                                            <th>Task</th>
                                            <th>Owner</th>
                                            <th>Status</th>
                                            <th>Updated</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {workItems.length === 0 && (
                                            <tr>
                                                <td colSpan={4} className="mw-table-empty">No tasks yet</td>
                                            </tr>
                                        )}
                                        {workItems.map(item => {
                                            const statusLabels: Record<string, { label: string; cls: string }> = {
                                                working: { label: 'Working', cls: 'status-working' },
                                                needs_approval: { label: 'Needs Approval', cls: 'status-approval' },
                                                blocked: { label: 'Blocked', cls: 'status-blocked' },
                                                done: { label: 'Done', cls: 'status-done' },
                                            };
                                            const s = statusLabels[item.status] || { label: item.status, cls: '' };
                                            return (
                                                <tr key={item.id}>
                                                    <td className="mw-table-task">{item.title}</td>
                                                    <td>{firstName}</td>
                                                    <td><span className={`mw-status-pill ${s.cls}`}>{s.label}</span></td>
                                                    <td className="mw-table-date">
                                                        {new Date(item.updatedAt).toLocaleDateString()}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ HISTORY TAB ═══ */}
            {activeTab === 'history' && (
                <div className="mw-tab-content">
                    <h3 className="mw-section-title"><History size={16} /> Conversation History</h3>
                    {historyLoading ? (
                        <div className="mw-loading" style={{ minHeight: 200 }}><div className="spinner" /></div>
                    ) : historySessions.length === 0 ? (
                        <div className="mw-tab-placeholder">
                            <History size={32} style={{ opacity: 0.15 }} />
                            <h3>No Conversations Yet</h3>
                            <p>Start a conversation with {firstName} to see history here.</p>
                        </div>
                    ) : (
                        <div className="mw-history-list">
                            {historySessions.map(session => (
                                <div key={session.id} className="mw-history-item">
                                    <div className="mw-history-meta">
                                        <span className="mw-history-date">
                                            {new Date(session.startedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                        </span>
                                        <span className="mw-history-count">{session.messageCount} messages</span>
                                        <span className={`mw-status-pill ${session.status === 'ACTIVE' ? 'status-working' : 'status-done'}`}>
                                            {session.status}
                                        </span>
                                    </div>
                                    {session.lastMessage && (
                                        <p className="mw-history-preview">{session.lastMessage}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* ═══ SKILLS TAB ═══ */}
            {activeTab === 'skills' && (
                <div className="mw-tab-content">
                    <div className="mw-skills-list">
                        <h3 className="mw-section-title"><Zap size={16} /> Skills ({skills.length})</h3>
                        {skills.length === 0 ? (
                            <div className="mw-tab-placeholder">
                                <Zap size={32} style={{ opacity: 0.15 }} />
                                <h3>No Skills Assigned</h3>
                                <p>Assign skills in the Skill Library to enable this member.</p>
                            </div>
                        ) : (
                            <div className="mw-skills-grid">
                                {skills.map(skill => (
                                    <div key={skill.id} className="mw-skill-card">
                                        <div className="mw-skill-card-icon"><Zap size={16} /></div>
                                        <div className="mw-skill-card-info">
                                            <div className="mw-skill-card-name">{skill.name}</div>
                                            {skill.description && (
                                                <div className="mw-skill-card-desc">{skill.description}</div>
                                            )}
                                        </div>
                                        <button
                                            className="mw-btn-sm mw-btn-ghost"
                                            onClick={() => {
                                                setSelectedSkill(skill.key);
                                                setActiveTab('workspace');
                                            }}
                                        >
                                            Run
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* ═══ CONFIGURATION TAB ═══ */}
            {activeTab === 'configuration' && (
                <div className="mw-tab-content">
                    <h3 className="mw-section-title"><Settings size={16} /> Configuration</h3>
                    <div className="mw-config-grid">
                        {/* Identity Card */}
                        <div className="mw-config-card">
                            <div className="mw-config-card-header">
                                <span className="mw-card-title"><User size={14} /> Identity</span>
                                {!configEditing ? (
                                    <button className="mw-btn-sm mw-btn-ghost" onClick={() => setConfigEditing(true)}>Edit</button>
                                ) : (
                                    <div style={{ display: 'flex', gap: 6 }}>
                                        <button className="mw-btn-sm mw-btn-ghost" onClick={() => { setConfigEditing(false); setConfigName(member.name); setConfigDesc(member.description || ''); }}>Cancel</button>
                                        <button className="mw-btn-sm mw-btn-approve" onClick={handleSaveConfig} disabled={configSaving}>
                                            {configSaving ? <Loader size={10} className="spin" /> : <Save size={10} />} Save
                                        </button>
                                    </div>
                                )}
                            </div>
                            <div className="mw-config-fields">
                                <div className="mw-config-field">
                                    <label className="mw-config-label">Name</label>
                                    {configEditing ? (
                                        <input className="mw-config-input" value={configName} onChange={e => setConfigName(e.target.value)} />
                                    ) : (
                                        <p className="mw-config-value">{member.name}</p>
                                    )}
                                </div>
                                <div className="mw-config-field">
                                    <label className="mw-config-label">Description / Role</label>
                                    {configEditing ? (
                                        <textarea className="mw-config-textarea" value={configDesc} onChange={e => setConfigDesc(e.target.value)} rows={3} />
                                    ) : (
                                        <p className="mw-config-value">{member.description || '—'}</p>
                                    )}
                                </div>
                                <div className="mw-config-field">
                                    <label className="mw-config-label">Brain Type</label>
                                    <p className="mw-config-value">{member.brainType.replace(/_/g, ' ')}</p>
                                </div>
                                <div className="mw-config-field">
                                    <label className="mw-config-label">Status</label>
                                    <p className="mw-config-value">{member.status} {member.isEnabled ? '(Enabled)' : '(Disabled)'}</p>
                                </div>
                            </div>
                        </div>

                        {/* Behavior Card */}
                        <div className="mw-config-card">
                            <div className="mw-config-card-header">
                                <span className="mw-card-title"><Brain size={14} /> Behavior</span>
                            </div>
                            <div className="mw-config-fields">
                                <div className="mw-config-field">
                                    <label className="mw-config-label">Tone Preset</label>
                                    <p className="mw-config-value">{member.configJson?.identity?.tonePreset?.replace(/_/g, ' ') || '—'}</p>
                                </div>
                                <div className="mw-config-field">
                                    <label className="mw-config-label">Communication Style</label>
                                    <p className="mw-config-value">{member.configJson?.identity?.communicationStyle || '—'}</p>
                                </div>
                                <div className="mw-config-field">
                                    <label className="mw-config-label">Personality Traits</label>
                                    <p className="mw-config-value">{member.configJson?.identity?.personalityTraits?.join(', ') || '—'}</p>
                                </div>
                                <div className="mw-config-field">
                                    <label className="mw-config-label">Autonomy Level</label>
                                    <p className="mw-config-value">{member.configJson?.taskBehavior?.autonomyLevel ?? '—'} / 10</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div style={{ marginTop: 24 }}>
                        <button
                            className="mw-btn mw-btn-secondary"
                            onClick={() => router.push(`/settings/ai-brain/${member.brainType.toLowerCase()}`)}
                        >
                            <Settings size={14} /> Open Full Configuration
                        </button>
                    </div>
                </div>
            )}

            {/* ═══ PERFORMANCE TAB ═══ */}
            {activeTab === 'performance' && (() => {
                const totalTasks = workItems.length;
                const doneCount = workItems.filter(i => i.status === 'done').length;
                const approvalCount = workItems.filter(i => i.status === 'needs_approval').length;
                const completionRate = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;
                const approvalRate = (doneCount + approvalCount) > 0
                    ? Math.round((doneCount / (doneCount + approvalCount)) * 100) : 0;
                const blockedCount = workItems.filter(i => i.status === 'blocked').length;
                const activeCount = workItems.filter(i => i.status === 'working').length;

                return (
                    <div className="mw-tab-content">
                        <h3 className="mw-section-title"><BarChart3 size={16} /> Performance Overview</h3>

                        {/* KPI Row */}
                        <div className="mw-perf-kpi-row">
                            <div className="mw-perf-kpi">
                                <span className="mw-perf-kpi-icon"><TrendingUp size={18} /></span>
                                <span className="mw-perf-kpi-value">{completionRate}%</span>
                                <span className="mw-perf-kpi-label">Completion Rate</span>
                            </div>
                            <div className="mw-perf-kpi">
                                <span className="mw-perf-kpi-icon"><Award size={18} /></span>
                                <span className="mw-perf-kpi-value">{approvalRate}%</span>
                                <span className="mw-perf-kpi-label">Approval Rate</span>
                            </div>
                            <div className="mw-perf-kpi">
                                <span className="mw-perf-kpi-icon"><Target size={18} /></span>
                                <span className="mw-perf-kpi-value">{totalTasks}</span>
                                <span className="mw-perf-kpi-label">Total Tasks</span>
                            </div>
                            <div className="mw-perf-kpi">
                                <span className="mw-perf-kpi-icon"><Activity size={18} /></span>
                                <span className="mw-perf-kpi-value">{activeCount}</span>
                                <span className="mw-perf-kpi-label">Active Now</span>
                            </div>
                        </div>

                        {/* Task breakdown */}
                        <div className="mw-perf-breakdown">
                            <h4 className="mw-perf-subtitle">Task Breakdown</h4>
                            <div className="mw-perf-bar-group">
                                {[
                                    { label: 'Done', count: doneCount, color: '#1F9D55' },
                                    { label: 'Working', count: activeCount, color: '#2563eb' },
                                    { label: 'Needs Approval', count: approvalCount, color: '#E8A317' },
                                    { label: 'Blocked', count: blockedCount, color: '#D73A3A' },
                                ].map(row => (
                                    <div key={row.label} className="mw-perf-bar-row">
                                        <span className="mw-perf-bar-label">{row.label}</span>
                                        <div className="mw-perf-bar-track">
                                            <div
                                                className="mw-perf-bar-fill"
                                                style={{
                                                    width: totalTasks > 0 ? `${(row.count / totalTasks) * 100}%` : '0%',
                                                    background: row.color,
                                                }}
                                            />
                                        </div>
                                        <span className="mw-perf-bar-count">{row.count}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                );
            })()}
        {/* ── ARTIFACT VIEWER MODAL ── */}
            {viewerOpen && artifactData && (
                <ArtifactViewer
                    artifact={artifactData}
                    versions={artifactVersions}
                    onClose={() => setViewerOpen(false)}
                    onIterate={async (prompt, scopeType, selectedArea) => {
                        if (!artifactId) return;
                        setIsIterating(true);
                        try {
                            const res = await fetch(`/api/artifacts/${artifactId}/iterate`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ prompt, scopeType, selectedArea, parentVersionId: artifactData.currentVersionId }),
                            });
                            if (res.ok) {
                                const data = await res.json();
                                setArtifactVersions(prev => [...prev, data.version]);
                                setArtifactData((prev: any) => ({ ...prev, currentVersionId: data.version.id }));
                                showToast(`Version v${data.version.versionNumber} created`, 'success');
                            } else {
                                showToast('Iteration failed', 'error');
                            }
                        } catch { showToast('Iteration error', 'error'); }
                        setIsIterating(false);
                    }}
                    onRegenerate={async () => {
                        if (!artifactId) return;
                        setBubbleState('generating');
                        setArtifactProgressIndex(0);
                        setViewerOpen(false);
                        const t1 = setTimeout(() => setArtifactProgressIndex(1), 800);
                        const t2 = setTimeout(() => setArtifactProgressIndex(2), 1600);
                        try {
                            const res = await fetch(`/api/artifacts/${artifactId}/generate`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ prompt: `Regenerate ${artifactData.title}`, metadata: artifactMeta }),
                            });
                            clearTimeout(t1); clearTimeout(t2);
                            if (res.ok) {
                                const data = await res.json();
                                setArtifactVersions(prev => [...prev, data.version]);
                                setArtifactData(data.artifact);
                                setBubbleState('generated');
                            } else {
                                setBubbleState('ready');
                                showToast('Regeneration failed', 'error');
                            }
                        } catch { clearTimeout(t1); clearTimeout(t2); setBubbleState('ready'); showToast('Regeneration error', 'error'); }
                    }}
                    onExport={() => {
                        const current = artifactVersions[artifactVersions.length - 1];
                        if (current?.outputPayload) {
                            const blob = new Blob([JSON.stringify(current.outputPayload, null, 2)], { type: 'application/json' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url; a.download = `${artifactData?.title || 'artifact'}.json`; a.click();
                            URL.revokeObjectURL(url);
                        }
                    }}
                    isIterating={isIterating}
                />
            )}

            {/* ─── Task Output Viewer Modal ─── */}
            {selectedTask && (
                <div className="mw-output-overlay" onClick={e => e.target === e.currentTarget && setSelectedTask(null)}>
                    <div className="mw-output-modal">
                        <div className="mw-output-header">
                            <div>
                                <div className="mw-output-title">{selectedTask.title}</div>
                                <div className="mw-output-meta">
                                    <span className={`mw-output-status-pill ${selectedTask.status}`}>
                                        {selectedTask.status === 'needs_approval' ? 'Needs Approval' : selectedTask.status === 'done' ? 'Done' : selectedTask.status === 'working' ? 'Working' : 'Blocked'}
                                    </span>
                                    <span style={{ fontSize: 10, color: '#71717a' }}>{selectedTask.sourceType}</span>
                                    {selectedTask.progressStep === 'done' && <span style={{ fontSize: 10, color: '#059669' }}>✅ AI output ready</span>}
                                </div>
                            </div>
                            <button style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: '#a1a1aa', cursor: 'pointer', padding: 8, display: 'flex', alignItems: 'center' }} onClick={() => setSelectedTask(null)}><X size={16} /></button>
                        </div>
                        <div className="mw-output-body">
                            {selectedTask.description ? (
                                <div className="mw-output-content" dangerouslySetInnerHTML={{
                                    __html: (selectedTask.description || '')
                                        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
                                        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
                                        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
                                        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
                                        .replace(/\*(.+?)\*/g, '<em>$1</em>')
                                        .replace(/^- (.+)$/gm, '<li>$1</li>')
                                        .replace(/(<li>[\s\S]*<\/li>)/g, '<ul>$1</ul>')
                                        .replace(/\n{2,}/g, '<br/><br/>')
                                        .replace(/\n/g, '<br/>')
                                }} />
                            ) : (
                                <div style={{ color: '#71717a', textAlign: 'center', padding: '40px 0' }}>No output content yet.</div>
                            )}
                        </div>
                        <div className="mw-output-actions">
                            {(selectedTask.status === 'needs_approval' || selectedTask.progressStep === 'done') && (
                                <>
                                    <button
                                        className="mw-output-btn approve"
                                        disabled={taskActionLoading}
                                        onClick={async () => {
                                            setTaskActionLoading(true);
                                            try {
                                                await fetch(`/api/tasks/${selectedTask.id}`, {
                                                    method: 'PUT',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ isCompleted: true }),
                                                });
                                                showToast('Task approved and marked as done!', 'success');
                                                setSelectedTask(null);
                                                loadTasks();
                                                loadBriefing();
                                            } catch { showToast('Action failed', 'error'); }
                                            setTaskActionLoading(false);
                                        }}
                                    >
                                        <ThumbsUp size={14} /> Approve & Complete
                                    </button>
                                    <button
                                        className="mw-output-btn revise"
                                        disabled={taskActionLoading}
                                        onClick={async () => {
                                            setTaskActionLoading(true);
                                            try {
                                                // Clear ai_progress so it goes back to working
                                                await fetch(`/api/ai/members/${memberId}/execute-task`, {
                                                    method: 'POST',
                                                    headers: { 'Content-Type': 'application/json' },
                                                    body: JSON.stringify({ taskId: selectedTask.id }),
                                                });
                                                showToast('Revision requested — task is being re-processed', 'success');
                                                setSelectedTask(null);
                                                loadTasks();
                                                loadBriefing();
                                            } catch { showToast('Action failed', 'error'); }
                                            setTaskActionLoading(false);
                                        }}
                                    >
                                        <RotateCcw size={14} /> Request Revision
                                    </button>
                                </>
                            )}
                            {selectedTask.status === 'working' && !selectedTask.progressStep && selectedTask.sourceType === 'task' && (
                                <button
                                    className="mw-output-btn approve"
                                    disabled={taskActionLoading}
                                    onClick={async () => {
                                        setTaskActionLoading(true);
                                        try {
                                            await fetch(`/api/ai/members/${memberId}/execute-task`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ taskId: selectedTask.id }),
                                            });
                                            showToast('Task execution started!', 'success');
                                            setSelectedTask(null);
                                            loadTasks();
                                        } catch { showToast('Execution error', 'error'); }
                                        setTaskActionLoading(false);
                                    }}
                                >
                                    <Sparkles size={14} /> Run Task
                                </button>
                            )}
                            {selectedTask.status === 'done' && (
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#059669', fontSize: 13, fontWeight: 600 }}>
                                    <CheckCheck size={16} /> Task completed
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
