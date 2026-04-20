'use client';

import { useState, useRef, useEffect } from 'react';
import { X, FileText, Bot, MessageSquare, User, Mic, Square, Send } from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import './document-viewer.css';
import { useUIFeedback } from '@/components/UIFeedback';

interface ChatMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
}

interface DocumentViewerModalProps {
    documentId: string;
    filename: string;
    mimeType: string;
    onClose: () => void;
}

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        SpeechRecognition: any;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        webkitSpeechRecognition: any;
    }
}

export default function DocumentViewerModal({ documentId, filename, mimeType, onClose }: DocumentViewerModalProps) {
    const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const { showToast } = useUIFeedback();

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null);

    const [textContent, setTextContent] = useState<string | null>(null);
    const [textLoading, setTextLoading] = useState(false);

    const isPdfOrImage = mimeType === 'application/pdf' || mimeType?.startsWith('image/');
    const isMarkdown = filename.toLowerCase().endsWith('.md') || mimeType === 'text/markdown';
    const isTextPreviewable = !isPdfOrImage; // everything non-PDF/image gets text preview

    // Close on Escape
    useEffect(() => {
        function handleKey(e: KeyboardEvent) {
            if (e.key === 'Escape') onClose();
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [onClose]);

    // Fetch text content for preview
    useEffect(() => {
        if (!isTextPreviewable) return;
        setTextLoading(true);

        if (isMarkdown) {
            // For .md files, download the raw file
            fetch(`/api/documents/${documentId}/download`)
                .then(res => res.text())
                .then(text => setTextContent(text))
                .catch(err => console.error('Failed to load markdown', err))
                .finally(() => setTextLoading(false));
        } else {
            // For DOCX and other files, fetch extractedText from document API
            fetch(`/api/documents/${documentId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.extractedText) {
                        setTextContent(data.extractedText);
                    } else {
                        setTextContent(null);
                    }
                })
                .catch(err => console.error('Failed to load document text', err))
                .finally(() => setTextLoading(false));
        }
    }, [isTextPreviewable, isMarkdown, documentId]);

    // Auto-scroll chat
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [chatMessages]);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 80) + 'px';
        }
    }, [chatInput]);

    // ─── Chat ────────────────────────────────────────
    async function handleChatSend() {
        const text = chatInput.trim();
        if (!text || chatLoading) return;

        const userMsg: ChatMessage = { id: `u-${Date.now()}`, role: 'user', content: text };
        setChatMessages(prev => [...prev, userMsg]);
        setChatInput('');
        setChatLoading(true);

        try {
            const res = await fetch(`/api/documents/${documentId}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message: text,
                    history: chatMessages.map(m => ({ role: m.role, content: m.content })),
                }),
            });

            if (res.ok) {
                const data = await res.json();
                setChatMessages(prev => [
                    ...prev,
                    { id: `a-${Date.now()}`, role: 'assistant', content: data.answer },
                ]);
            } else {
                setChatMessages(prev => [
                    ...prev,
                    { id: `e-${Date.now()}`, role: 'assistant', content: '❌ Erro ao processar.' },
                ]);
            }
        } catch {
            setChatMessages(prev => [
                ...prev,
                { id: `e-${Date.now()}`, role: 'assistant', content: '❌ Erro de conexão.' },
            ]);
        }

        setChatLoading(false);
    }

    function handleKeyDown(e: React.KeyboardEvent) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleChatSend();
        }
    }

    // ─── Speech-to-Text ──────────────────────────────
    function toggleVoice() {
        if (isRecording) {
            recognitionRef.current?.stop();
            setIsRecording(false);
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            showToast('O seu navegador não suporta reconhecimento de voz.', 'warning');
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.interimResults = true;
        recognition.continuous = true;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            let interimTranscript = '';
            for (let i = 0; i < event.results.length; i++) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }
            setChatInput(finalTranscript + interimTranscript);
        };

        recognition.onend = () => setIsRecording(false);
        recognition.onerror = () => setIsRecording(false);

        recognitionRef.current = recognition;
        recognition.start();
        setIsRecording(true);
    }

    function stopVoice() {
        recognitionRef.current?.stop();
        setIsRecording(false);
    }



    return (
        <div className="doc-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
            <div className="doc-modal">
                {/* Left: PDF / Document */}
                <div className="doc-modal-pdf">
                    <div className="doc-modal-pdf-header">
                        <button className="doc-modal-close" onClick={onClose} title="Fechar"><X size={18} strokeWidth={2} /></button>
                        <h2 title={filename}><FileText size={16} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />{filename}</h2>
                    </div>
                    {isPdfOrImage ? (
                        <iframe
                            src={`/api/documents/${documentId}/download`}
                            title={filename}
                        />
                    ) : (
                        <div className="doc-modal-text md-content" style={{ padding: 'var(--space-lg)', overflowY: 'auto' }}>
                            {textLoading ? (
                                <div style={{ color: 'var(--color-text-muted)' }}>Loading document…</div>
                            ) : textContent ? (
                                isMarkdown ? (
                                    <ReactMarkdown>{textContent}</ReactMarkdown>
                                ) : (
                                    <div style={{ whiteSpace: 'pre-wrap' }}>{textContent}</div>
                                )
                            ) : (
                                <div style={{ color: 'var(--color-text-muted)' }}>
                                    No preview available — use the chat to ask questions about this document.
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Right: Chat */}
                <div className="doc-modal-chat">
                    <div className="doc-modal-chat-header">
                        <h3><MessageSquare size={16} strokeWidth={2} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 6 }} />Chat sobre o documento</h3>
                    </div>

                    <div className="doc-modal-messages">
                        {chatMessages.length === 0 && !chatLoading && (
                            <div className="doc-modal-empty">
                                <div className="icon"><MessageSquare size={28} strokeWidth={1.5} /></div>
                                <p>Faça perguntas sobre este documento.<br />A IA irá responder com base no conteúdo.</p>
                            </div>
                        )}

                        {chatMessages.map(msg => (
                            <div key={msg.id} className={`dm-msg ${msg.role}`}>
                                <div className="dm-msg-avatar">
                                    {msg.role === 'user' ? <User size={16} strokeWidth={2} /> : <Bot size={16} strokeWidth={2} />}
                                </div>
                                {msg.role === 'assistant' ? (
                                    <div className="dm-msg-bubble md-content">
                                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                                    </div>
                                ) : (
                                    <div className="dm-msg-bubble">{msg.content}</div>
                                )}
                            </div>
                        ))}

                        {chatLoading && (
                            <div className="dm-msg assistant">
                                <div className="dm-msg-avatar"><Bot size={16} strokeWidth={2} /></div>
                                <div className="dm-msg-bubble dm-typing">
                                    <div className="dm-typing-dot" />
                                    <div className="dm-typing-dot" />
                                    <div className="dm-typing-dot" />
                                </div>
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    <div className="doc-modal-input">
                        <div className="doc-modal-input-row">

                            {!isRecording ? (
                                <button
                                    className="dm-btn dm-btn-mic"
                                    onClick={toggleVoice}
                                    title="Iniciar gravação por voz"
                                >
                                    <Mic size={16} strokeWidth={2} />
                                </button>
                            ) : (
                                <button
                                    className="dm-btn dm-btn-mic recording"
                                    onClick={stopVoice}
                                    title="Parar gravação"
                                >
                                    <Square size={16} strokeWidth={2} />
                                </button>
                            )}

                            <textarea
                                ref={textareaRef}
                                placeholder="Pergunte algo sobre este documento…"
                                value={chatInput}
                                onChange={e => setChatInput(e.target.value)}
                                onKeyDown={handleKeyDown}
                                rows={1}
                                disabled={chatLoading}
                            />

                            <button
                                className="dm-btn dm-btn-send"
                                onClick={handleChatSend}
                                disabled={!chatInput.trim() || chatLoading}
                                title="Enviar"
                            >
                                <Send size={16} strokeWidth={2} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
