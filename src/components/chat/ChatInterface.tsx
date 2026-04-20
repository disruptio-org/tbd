'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useWhisper } from '@/lib/useWhisper';
import './chat.css';
import DocumentViewerModal from '@/app/(dashboard)/documents/[id]/DocumentViewerModal';
import { useUIFeedback } from '@/components/UIFeedback';

export type AssistantType = 'GENERAL' | 'COMPANY_KNOWLEDGE' | 'ONBOARDING_ASSISTANT';

interface ChatInterfaceProps {
    fixedType: AssistantType;
}

// ─── Types ────────────────────────────────────────────

interface Message {
    id: string;
    role: 'USER' | 'ASSISTANT';
    content: string;
    sources?: { documentId: string; filename: string; preview: string; relevanceScore: number }[];
    groundingStatus?: 'VERIFIED' | 'PARTIAL' | 'NOT_FOUND';
}

interface Conversation {
    id: string;
    title: string | null;
    updatedAt: string;
    assistantType?: AssistantType;
}

interface OnboardingGuide {
    summary: string;
    recommendedDocIds: string[] | null;
}

interface RecommendedDoc {
    id: string;
    filename: string;
    mimeType: string;
    knowledgeCategory: string | null;
}

type OnboardingRole = 'general' | 'sales' | 'marketing' | 'operations' | 'product' | 'finance' | 'hr';

// ─── Onboarding Config ───────────────────────────────

const ONBOARDING_ROLES: { value: OnboardingRole; label: string; icon: string }[] = [
    { value: 'general', label: 'General', icon: '🌐' },
    { value: 'sales', label: 'Sales', icon: '💼' },
    { value: 'marketing', label: 'Marketing', icon: '📣' },
    { value: 'operations', label: 'Operations', icon: '⚙️' },
    { value: 'product', label: 'Product', icon: '🚀' },
    { value: 'finance', label: 'Finance', icon: '💰' },
    { value: 'hr', label: 'HR', icon: '👥' },
];

const ROLE_PROMPTS: Record<OnboardingRole, string[]> = {
    general: [
        'What does this company do?',
        'What are our main products or services?',
        'How is the company organized?',
        'What tools do we use internally?',
        'What documents should I read first?',
        'What should I know in my first week?',
    ],
    sales: [
        'What are our main products?',
        'Who are our target customers?',
        'What is our value proposition?',
        'Who are our main competitors?',
        'How does our sales process work?',
        'What pitch or presentation documents exist?',
    ],
    marketing: [
        'What is our brand tone of voice?',
        'Who is our target audience?',
        'What markets do we operate in?',
        'What is our competitive positioning?',
        'What marketing channels do we use?',
        'What are our strategic objectives?',
    ],
    operations: [
        'What are our key processes?',
        'What internal tools do we use?',
        'How is the team organized?',
        'How does the operational workflow function?',
        'What departments exist in the company?',
        'What are the stages of our delivery process?',
    ],
    product: [
        'What do we build or develop?',
        'Who are our product users?',
        'What is our value proposition for the customer?',
        'How is the product team organized?',
        'What product or development tools do we use?',
        'What are the strategic product goals?',
    ],
    finance: [
        'How does the billing process work?',
        'What are the key financial processes?',
        'What financial tools do we use?',
        'How is the finance department organized?',
        'What are the main financial responsibilities?',
        'What financial documents should I know about?',
    ],
    hr: [
        'What are the company HR policies?',
        'How does the onboarding process work?',
        'What employee benefits are available?',
        'How does performance evaluation work?',
        'What HR processes should I know about?',
        'What HR documents should I read?',
    ],
};

export default function ChatInterface({ fixedType }: ChatInterfaceProps) {
    const [conversations, setConversations] = useState<Conversation[]>([]);
    const [activeConvId, setActiveConvId] = useState<string | null>(null);
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    // Onboarding specific state
    const [onboardingRole, setOnboardingRole] = useState<OnboardingRole>('general');
    const [onboardingGuide, setOnboardingGuide] = useState<OnboardingGuide | null>(null);
    const [loadingGuide, setLoadingGuide] = useState(false);
    const [generatingGuide, setGeneratingGuide] = useState(false);
    const [recommendedDocs, setRecommendedDocs] = useState<RecommendedDoc[]>([]);
    
    const [selectedDoc, setSelectedDoc] = useState<{ documentId: string; filename: string; mimeType: string } | null>(null);
    
    const { showToast, showConfirm } = useUIFeedback();
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const { isRecording, isTranscribing, startRecording, stopRecording } = useWhisper({
        onTranscript: (text) => {
            setInput((prev) => (prev.trim() ? prev.trim() + ' ' + text : text));
        },
    });

    /** Convert markdown to HTML for chat responses */
    function renderMarkdown(text: string): string {
        // Escape HTML
        let escaped = text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');

        // Extract code blocks first to protect them from further processing
        const codeBlocks: string[] = [];
        escaped = escaped.replace(/```(\w*)\n([\s\S]*?)```/g, (_match, lang, code) => {
            const idx = codeBlocks.length;
            codeBlocks.push(
                `<pre class="md-code-block"><code class="md-code-lang-${lang || 'text'}">${code.trim()}</code></pre>`
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
                .replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');
        }

        for (const raw of lines) {
            const line = raw;

            // Code block placeholder — pass through
            if (line.trim().startsWith('%%CODEBLOCK_')) {
                closeList();
                processed.push(line.trim());
                continue;
            }

            // Headings
            const h3 = line.match(/^###\s+(.+)/);
            if (h3) { closeList(); processed.push(`<h4 class="md-h3">${inlineFormat(h3[1])}</h4>`); continue; }
            const h2 = line.match(/^##\s+(.+)/);
            if (h2) { closeList(); processed.push(`<h3 class="md-h2">${inlineFormat(h2[1])}</h3>`); continue; }
            const h1 = line.match(/^#\s+(.+)/);
            if (h1) { closeList(); processed.push(`<h2 class="md-h1">${inlineFormat(h1[1])}</h2>`); continue; }

            // Horizontal rule
            if (/^---+$/.test(line.trim())) { closeList(); processed.push('<hr class="md-hr" />'); continue; }

            // Ordered list (1. item)
            const olMatch = line.match(/^\d+\.\s+(.+)/);
            if (olMatch) {
                if (inUl) { processed.push('</ul>'); inUl = false; }
                if (!inOl) { processed.push('<ol class="md-ol">'); inOl = true; }
                processed.push(`<li>${inlineFormat(olMatch[1])}</li>`);
                continue;
            }

            // Unordered list (- item or * item)
            const ulMatch = line.match(/^[-*]\s+(.+)/);
            if (ulMatch) {
                if (inOl) { processed.push('</ol>'); inOl = false; }
                if (!inUl) { processed.push('<ul class="md-ul">'); inUl = true; }
                processed.push(`<li>${inlineFormat(ulMatch[1])}</li>`);
                continue;
            }

            // Normal text or blank line
            closeList();
            if (line.trim()) {
                processed.push(`<p class="md-p">${inlineFormat(line)}</p>`);
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

    const loadConversations = useCallback(async () => {
        try {
            // we could potentially filter conversations by type on the backend or frontend
            // for now let's just fetch all or whatever the route returns
            // Future enhancement: pass `?type=${fixedType}` to the API to isolate conversations per mode
            const res = await fetch(`/api/chat/conversations?type=${fixedType}`);
            if (res.ok) {
                const data = await res.json();
                setConversations(Array.isArray(data) ? data : []);
            }
        } catch (err) {
            console.error('Failed to load conversations:', err);
        }
    }, [fixedType]);

    // Load conversations on mount
    useEffect(() => {
        loadConversations();
    }, [loadConversations]);

    // Load onboarding guide when in onboarding mode
    useEffect(() => {
        if (fixedType === 'ONBOARDING_ASSISTANT') {
            loadOnboardingGuide();
        }
    }, [fixedType]);

    // Auto-scroll to bottom
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + 'px';
        }
    }, [input]);

    async function loadOnboardingGuide() {
        setLoadingGuide(true);
        try {
            const res = await fetch('/api/company/onboarding-guide');
            if (res.ok) {
                const data = await res.json();
                setOnboardingGuide(data.guide ?? null);

                if (data.guide?.recommendedDocIds?.length) {
                    loadRecommendedDocs(data.guide.recommendedDocIds);
                }
            }
        } catch (err) {
            console.error('Failed to load onboarding guide:', err);
        }
        setLoadingGuide(false);
    }

    async function loadRecommendedDocs(docIds: string[]) {
        try {
            const params = docIds.map(id => `id=${id}`).join('&');
            const res = await fetch(`/api/documents?${params}`);
            if (res.ok) {
                const data = await res.json();
                setRecommendedDocs(Array.isArray(data.documents) ? data.documents.slice(0, 5) : []);
            }
        } catch {
            console.error('Failed to load recommended docs');
        }
    }

    async function handleGenerateGuide() {
        setGeneratingGuide(true);
        try {
            const res = await fetch('/api/company/onboarding-guide/generate', { method: 'POST' });
            const data = await res.json();
            if (res.ok) {
                setOnboardingGuide(data.guide);
                if (data.guide?.recommendedDocIds?.length) {
                    loadRecommendedDocs(data.guide.recommendedDocIds);
                }
                showToast('Onboarding guide generated successfully!', 'success');
            } else {
                showToast(data.error || 'Failed to generate guide', 'error');
            }
        } catch {
            showToast('Connection error', 'error');
        }
        setGeneratingGuide(false);
    }

    const loadConversation = useCallback(async (convId: string) => {
        setActiveConvId(convId);
        setSidebarOpen(false);
        try {
            const res = await fetch(`/api/chat/conversations/${convId}`);
            if (res.ok) {
                const data = await res.json();
                setMessages(
                    (data.messages || []).map((m: { id: string; role: string; content: string }) => ({
                        id: m.id,
                        role: m.role,
                        content: m.content,
                        sources: [],
                    }))
                );
            }
        } catch (err) {
            console.error('Failed to load conversation:', err);
        }
    }, []);

    function startNewChat() {
        setActiveConvId(null);
        setMessages([]);
        setInput('');
        setSidebarOpen(false);
    }

    async function deleteConversation(convId: string, e: React.MouseEvent) {
        e.stopPropagation();
        showConfirm('Delete this conversation?', async () => {
            try {
                await fetch(`/api/chat/conversations/${convId}`, { method: 'DELETE' });
                setConversations((prev) => prev.filter((c) => c.id !== convId));
                if (activeConvId === convId) startNewChat();
            } catch (err) {
                console.error('Failed to delete:', err);
            }
        });
    }

    async function handleSend(overrideText?: string) {
        const text = (overrideText || input).trim();
        if (!text || loading) return;
        if (!overrideText) setInput('');
        const userMsg: Message = { id: `temp-${Date.now()}`, role: 'USER', content: text };
        setMessages((prev) => [...prev, userMsg]);
        if (!overrideText) setInput('');
        setLoading(true);

        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    conversationId: activeConvId,
                    assistantType: fixedType,
                    ...(fixedType === 'ONBOARDING_ASSISTANT' ? { onboardingRole } : {}),
                }),
            });

            if (res.ok) {
                const data = await res.json();
                if (!activeConvId && data.conversationId) {
                    setActiveConvId(data.conversationId);
                    loadConversations();
                }
                const assistantMsg: Message = {
                    id: `resp-${Date.now()}`,
                    role: 'ASSISTANT',
                    content: data.answer,
                    sources: data.sources || [],
                    groundingStatus: data.groundingStatus,
                };
                setMessages((prev) => [...prev, assistantMsg]);
            } else {
                const err = await res.json().catch(() => ({}));
                setMessages((prev) => [
                    ...prev,
                    { id: `err-${Date.now()}`, role: 'ASSISTANT', content: `❌ Error: ${err.error || 'Failed'}` },
                ]);
            }
        } catch (err) {
            console.error('Chat error:', err);
            setMessages((prev) => [
                ...prev,
                { id: `err-${Date.now()}`, role: 'ASSISTANT', content: '❌ Connection error. Please try again.' },
            ]);
        }
        setLoading(false);
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    }

    async function toggleVoice() {
        if (isRecording) {
            await stopRecording();
        } else {
            await startRecording();
        }
    }

    async function handleFileUpload(files: FileList | null) {
        if (!files || files.length === 0) return;
        for (const file of Array.from(files)) {
            const form = new FormData();
            form.append('file', file);
            try {
                const res = await fetch('/api/documents/upload', { method: 'POST', body: form });
                if (res.ok) {
                    const doc = await res.json();
                    fetch('/api/ocr', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ documentId: doc.id }) }).catch(console.error);
                    setInput((prev) => prev + (prev ? ' ' : '') + `[Uploaded: ${file.name}]`);
                }
            } catch (err) { console.error('Upload failed:', err); }
        }
        if (fileRef.current) fileRef.current.value = '';
    }

    // ─── Mode helpers ─────────────────────────────────

    const isOnboarding = fixedType === 'ONBOARDING_ASSISTANT';
    const suggestedPrompts = isOnboarding ? ROLE_PROMPTS[onboardingRole] : [
        'What does our company do?',
        'What are our main products?',
        'How do we onboard a client?',
        'Where can I find HR policies?',
        'Summarize our services.',
    ];

    const modeIcon = isOnboarding ? '🎓' : fixedType === 'COMPANY_KNOWLEDGE' ? '🏢' : '🤖';
    const modeTitle = isOnboarding ? 'Onboarding Assistant' : fixedType === 'COMPANY_KNOWLEDGE' ? 'Company Assistant' : 'Smart Chat';

    // ─── Onboarding Landing Panel ─────────────────────

    function OnboardingLandingPanel() {
        return (
            <div className="onboarding-panel">
                <div className="onboarding-welcome">
                    <div className="onboarding-welcome-icon">🎓</div>
                    <h2>Welcome to the Onboarding Assistant</h2>
                    <p>Learn how the company works — products, processes, team, and key documents, all in one place.</p>
                </div>

                <div className="onboarding-section">
                    <div className="onboarding-section-label">Your Area</div>
                    <div className="onboarding-role-pills">
                        {ONBOARDING_ROLES.map((r) => (
                            <button
                                key={r.value}
                                className={`onboarding-role-pill ${onboardingRole === r.value ? 'active' : ''}`}
                                onClick={() => setOnboardingRole(r.value)}
                            >
                                {r.icon} {r.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="onboarding-section">
                    <div className="onboarding-section-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span>📋 Company Summary</span>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={handleGenerateGuide}
                            disabled={generatingGuide}
                        >
                            {generatingGuide ? '⏳ Generating…' : onboardingGuide ? '🔄 Regenerate' : '✨ Generate'}
                        </button>
                    </div>
                    <div className="onboarding-guide-card">
                        {loadingGuide ? (
                            <div className="onboarding-guide-loading">Loading summary…</div>
                        ) : onboardingGuide ? (
                            <div
                                className="onboarding-guide-text"
                                dangerouslySetInnerHTML={{ __html: renderMarkdown(onboardingGuide.summary) }}
                            />
                        ) : (
                            <div className="onboarding-guide-empty">
                                <p>No onboarding summary exists for this company yet.</p>
                                <p style={{ fontSize: '0.8rem', marginTop: 4 }}>
                                    Click <strong>✨ Generate</strong> to create an automatic summary based on the Company Profile and available documents.
                                </p>
                            </div>
                        )}
                    </div>
                </div>

                <div className="onboarding-section">
                    <div className="onboarding-section-label">Suggested Questions</div>
                    <div className="chat-suggested-prompts">
                        {suggestedPrompts.map((prompt, i) => (
                            <button
                                key={i}
                                className="chat-suggested-btn"
                                onClick={() => handleSend(prompt)}
                            >
                                {prompt}
                            </button>
                        ))}
                    </div>
                </div>

                {recommendedDocs.length > 0 && (
                    <div className="onboarding-section">
                        <div className="onboarding-section-label">📄 Recommended Documents</div>
                        <div className="onboarding-docs-list">
                            {recommendedDocs.map((doc) => (
                                <button
                                    key={doc.id}
                                    className="onboarding-doc-item"
                                    title={`Open ${doc.filename}`}
                                    onClick={() => setSelectedDoc({ documentId: doc.id, filename: doc.filename, mimeType: doc.mimeType || '' })}
                                >
                                    <span className="onboarding-doc-icon">📄</span>
                                    <span className="onboarding-doc-name">{doc.filename}</span>
                                    {doc.knowledgeCategory && (
                                        <span className="onboarding-doc-cat">{doc.knowledgeCategory}</span>
                                    )}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // ─── Render ───────────────────────────────────────

    return (
        <div className="chat-layout">
            <aside className={`chat-sidebar ${sidebarOpen ? 'open' : ''}`}>
                <div className="chat-sidebar-header">
                    <h2 className="chat-sidebar-title">
                        {modeIcon} {modeTitle}
                    </h2>
                    <button className="btn btn-primary w-full" onClick={startNewChat} style={{ marginTop: '12px' }}>
                        + New Conversation
                    </button>
                </div>
                <div className="chat-sidebar-list">
                    {conversations.map((conv) => (
                        <button
                            key={conv.id}
                            className={`chat-conv-item ${activeConvId === conv.id ? 'active' : ''}`}
                            onClick={() => loadConversation(conv.id)}
                        >
                            <span>💬</span>
                            <span className="chat-conv-title">{conv.title || 'Untitled conversation'}</span>
                            <span
                                className="chat-conv-delete"
                                onClick={(e) => deleteConversation(conv.id, e)}
                                title="Delete conversation"
                            >
                                ✕
                            </span>
                        </button>
                    ))}
                    {conversations.length === 0 && (
                        <p className="text-muted text-center" style={{ padding: 'var(--space-lg) var(--space-sm)', fontSize: 'var(--font-size-caption)' }}>
                            No conversations yet
                        </p>
                    )}
                </div>
            </aside>

            <div className="chat-main">
                <div className="chat-messages">
                    {messages.length === 0 && !loading && (
                        isOnboarding ? (
                            <OnboardingLandingPanel />
                        ) : (
                            <div className="chat-empty">
                                <div className="chat-empty-icon">{modeIcon}</div>
                                <h3>{modeTitle}</h3>
                                <p>
                                    {fixedType === 'COMPANY_KNOWLEDGE'
                                        ? 'Ask questions about your company. The assistant will search company documents to provide grounded answers.'
                                        : 'Ask questions about your documents. The AI will search the extracted content and provide answers with references to the original documents.'}
                                </p>
                                {fixedType === 'COMPANY_KNOWLEDGE' && (
                                    <div className="chat-suggested-prompts">
                                        {suggestedPrompts.map((prompt, i) => (
                                            <button key={i} className="chat-suggested-btn" onClick={() => handleSend(prompt)}>
                                                {prompt}
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )
                    )}

                    {isOnboarding && messages.length > 0 && (
                        <div className="onboarding-chat-header">
                            <span className="onboarding-chat-mode-label">🎓 Onboarding</span>
                            <div className="onboarding-role-pills onboarding-role-pills-compact">
                                {ONBOARDING_ROLES.map((r) => (
                                    <button
                                        key={r.value}
                                        className={`onboarding-role-pill compact ${onboardingRole === r.value ? 'active' : ''}`}
                                        onClick={() => setOnboardingRole(r.value)}
                                        title={r.label}
                                    >
                                        {r.icon} {r.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}

                    {messages.map((msg) => {
                        const uniqueSources = msg.sources
                            ? Array.from(new Map(msg.sources.map(s => [s.documentId, s])).values())
                            : [];
                        return (
                            <div key={msg.id} className={`chat-message ${msg.role === 'USER' ? 'user' : 'assistant'}`}>
                                <div className="chat-avatar">
                                    {msg.role === 'USER' ? '👤' : modeIcon}
                                </div>
                                <div>
                                    {msg.role === 'ASSISTANT' ? (
                                        <div className="chat-bubble" dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                                    ) : (
                                        <div className="chat-bubble">
                                            {msg.content.split('\n').map((line, i) => (
                                                <span key={i}>{line}{i < msg.content.split('\n').length - 1 && <br />}</span>
                                            ))}
                                        </div>
                                    )}
                                    {msg.groundingStatus && (
                                        <div className={`grounding-badge grounding-${msg.groundingStatus.toLowerCase().replace('_', '-')}`}>
                                            {msg.groundingStatus === 'VERIFIED' && '🟢 Verified'}
                                            {msg.groundingStatus === 'PARTIAL' && '🟡 Partial'}
                                            {msg.groundingStatus === 'NOT_FOUND' && '🔴 Not found'}
                                        </div>
                                    )}
                                    {uniqueSources.length > 0 && msg.groundingStatus !== 'NOT_FOUND' && (
                                        <div className="chat-sources">
                                            <span className="chat-sources-label">Sources:</span>
                                            {uniqueSources.map((src, i) => (
                                                <button
                                                    key={i}
                                                    className="chat-source-tag"
                                                    title={src.preview || `Open ${src.filename}`}
                                                    onClick={() => setSelectedDoc({ documentId: src.documentId, filename: src.filename, mimeType: '' })}
                                                >
                                                    📄 {src.filename}
                                                </button>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    {loading && (
                        <div className="chat-message assistant">
                            <div className="chat-avatar">{modeIcon}</div>
                            <div className="typing-indicator">
                                <div className="typing-dot" />
                                <div className="typing-dot" />
                                <div className="typing-dot" />
                            </div>
                        </div>
                    )}

                    <div ref={messagesEndRef} />
                </div>

                <div className="chat-input-bar">
                    <div className="chat-input-row">
                        <button className="chat-sidebar-toggle" onClick={() => setSidebarOpen(!sidebarOpen)} title="View conversations">
                            ☰
                        </button>
                        <button className="chat-input-btn chat-btn-upload" onClick={() => fileRef.current?.click()} title="Attach file">
                            📎
                        </button>
                        <input
                            ref={fileRef}
                            type="file"
                            accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.tiff,.bmp,.txt,.md"
                            multiple
                            hidden
                            onChange={(e) => handleFileUpload(e.target.files)}
                        />
                        <textarea
                            ref={textareaRef}
                            className="chat-input-text"
                            placeholder={isOnboarding ? 'Ask a question about the company…' : 'Ask a question about your documents…'}
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            onKeyDown={handleKeyDown}
                            rows={1}
                            disabled={loading}
                        />
                        <button
                            className={`chat-input-btn chat-btn-voice ${isRecording ? 'recording' : ''}`}
                            onClick={toggleVoice}
                            title={isRecording ? 'Stop & transcribe' : isTranscribing ? 'Transcribing…' : 'Voice input (Whisper)'}
                            disabled={isTranscribing}
                        >
                            {isTranscribing ? '⏳' : '🎙️'}
                        </button>
                        <button
                            className="chat-input-btn chat-btn-send"
                            onClick={() => handleSend()}
                            disabled={!input.trim() || loading}
                            title="Send"
                        >
                            ➤
                        </button>
                    </div>
                </div>
            </div>

            {selectedDoc && (
                <DocumentViewerModal
                    documentId={selectedDoc.documentId}
                    filename={selectedDoc.filename}
                    mimeType={selectedDoc.mimeType}
                    onClose={() => setSelectedDoc(null)}
                />
            )}
        </div>
    );
}
