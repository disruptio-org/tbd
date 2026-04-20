'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { useWhisper } from '@/lib/useWhisper';
import {
    Mic, ChevronDown, Loader, Square, FileText, CheckCircle, Sparkles,
} from 'lucide-react';
import './VoiceRantBrief.css';

/* ─── Types ──────────────────────────────────────────── */

interface DocumentOption {
    id: string;
    filename: string;
    size: number;
}

interface VoiceRantBriefProps {
    /** Brain type for the role (MARKETING, SALES, LEAD_DISCOVERY, PRODUCT_ASSISTANT) */
    assistantType: string;
    /** Map of fieldName → description/type for the AI to extract */
    fieldSchema: Record<string, string>;
    /** Called when AI returns extracted fields */
    onAutoFill: (fields: Record<string, string>) => void;
    /** Optional list of available documents the user can attach */
    documents?: DocumentOption[];
    /** Disable the component */
    disabled?: boolean;
    /** Current project context if any */
    projectId?: string;
}

type VRBState = 'idle' | 'recording' | 'transcribing' | 'processing' | 'done';

/* ═══════════════════════════════════════════════════════
   VoiceRantBrief Component
   ═══════════════════════════════════════════════════════ */

export default function VoiceRantBrief({
    assistantType,
    fieldSchema,
    onAutoFill,
    documents,
    disabled = false,
    projectId,
}: VoiceRantBriefProps) {
    const [collapsed, setCollapsed] = useState(false);
    const [state, setState] = useState<VRBState>('idle');
    const [localTranscript, setLocalTranscript] = useState('');
    const [seconds, setSeconds] = useState(0);
    const [filledCount, setFilledCount] = useState(0);
    const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
    const [showDocPicker, setShowDocPicker] = useState(false);
    const [fetchedDocs, setFetchedDocs] = useState<DocumentOption[]>([]);

    const whisper = useWhisper({
        onTranscript: (text) => {
            const combined = (localTranscript ? localTranscript + ' ' : '') + text;
            setLocalTranscript(combined.trim());
            setState('idle');
        },
    });

    useEffect(() => {
        if (!projectId) {
            setFetchedDocs([]);
            return;
        }
        fetch(`/api/documents/upload?projectId=${projectId}`)
            .then(res => res.json())
            .then(data => {
                if (data.documents) {
                    setFetchedDocs(data.documents.map((d: any) => ({
                        id: d.id,
                        filename: d.filename,
                        size: d.size || 0
                    })));
                }
            })
            .catch(err => console.error('[VoiceRant] doc fetch error:', err));
    }, [projectId]);

    const activeDocs = documents || fetchedDocs;

    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

    /* ─── Format timer ─────────────────────────────── */
    function fmtTime(s: number) {
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return `${m}:${sec.toString().padStart(2, '0')}`;
    }

    /* ─── Start Recording ──────────────────────────── */
    const startRecording = useCallback(async () => {
        setSeconds(0);
        setState('recording');
        timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
        await whisper.startRecording();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ─── Stop Recording ───────────────────────────── */
    const stopRecording = useCallback(async () => {
        if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
        setState('transcribing');
        await whisper.stopRecording();
        // state will be set to 'idle' by the onTranscript callback
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    /* ─── Auto-Fill ────────────────────────────────── */
    const handleAutoFill = useCallback(async () => {
        if (!localTranscript.trim()) return;

        setState('processing');

        try {
            const res = await fetch('/api/ai/parse-voice-brief', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    transcript: localTranscript.trim(),
                    assistantType,
                    fieldSchema,
                    documentIds: selectedDocIds.length > 0 ? selectedDocIds : undefined,
                    projectId,
                }),
            });

            const data = await res.json();

            if (res.ok && data.fields) {
                onAutoFill(data.fields);
                setFilledCount(Object.keys(data.fields).length);
                setState('done');
            } else {
                console.error('[VoiceRant] API error:', data.error);
                setState('idle');
            }
        } catch (err) {
            console.error('[VoiceRant] fetch error:', err);
            setState('idle');
        }
    }, [localTranscript, assistantType, fieldSchema, onAutoFill, selectedDocIds, projectId]);

    /* ─── Clear ────────────────────────────────────── */
    function handleClear() {
        setLocalTranscript('');
        whisper.clearTranscript();
        setSeconds(0);
        setFilledCount(0);
        setSelectedDocIds([]);
        setState('idle');
    }

    /* ─── Toggle doc selection ─────────────────────── */
    function toggleDoc(docId: string) {
        setSelectedDocIds(prev =>
            prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId]
        );
    }

    /* ─── Cleanup on unmount ───────────────────────── */
    useEffect(() => {
        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, []);

    /* ─── Render ───────────────────────────────────── */

    const isRecording = state === 'recording';
    const isTranscribing = state === 'transcribing';
    const isProcessing = state === 'processing';
    const isDone = state === 'done';
    const transcript = localTranscript;

    return (
        <div className={`vrb-card ${collapsed ? 'collapsed' : ''} ${isRecording ? 'recording' : ''}`}>
            {/* Header */}
            <div className="vrb-header" onClick={() => { if (state !== 'recording') setCollapsed(c => !c); }}>
                <div className="vrb-header-left">
                    <span className="vrb-header-icon"><Mic size={18} strokeWidth={2} /></span>
                    <div>
                        <div className="vrb-header-title">Quick Voice Brief</div>
                        <div className="vrb-header-subtitle">Speak freely about what you want — AI will auto-fill the form</div>
                    </div>
                </div>
                <span className="vrb-header-toggle"><ChevronDown size={16} strokeWidth={2} /></span>
            </div>

            {/* Body */}
            <div className="vrb-body">
                {/* Controls */}
                <div className="vrb-controls">
                    {isTranscribing ? (
                        <button type="button" className="vrb-record-btn" disabled>
                            <Loader size={12} strokeWidth={2} />
                            Transcribing…
                        </button>
                    ) : !isRecording ? (
                        <button
                            type="button"
                            className="vrb-record-btn"
                            onClick={startRecording}
                            disabled={disabled || isProcessing}
                        >
                            <span className="vrb-record-dot" />
                            Start Recording
                        </button>
                    ) : (
                        <button
                            type="button"
                            className="vrb-record-btn recording"
                            onClick={stopRecording}
                        >
                            <Square size={12} strokeWidth={2} />
                            Stop Recording
                        </button>
                    )}

                    {isRecording && (
                        <>
                            <span className="vrb-timer">{fmtTime(seconds)}</span>
                            <div className="vrb-waveform">
                                {[...Array(8)].map((_, i) => (
                                    <div key={i} className="vrb-waveform-bar" />
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Document Picker */}
                {activeDocs && activeDocs.length > 0 && (
                    <div className="vrb-doc-picker">
                        <button
                            type="button"
                            className={`vrb-doc-toggle ${selectedDocIds.length > 0 ? 'has-selection' : ''}`}
                            onClick={() => setShowDocPicker(p => !p)}
                        >
                            <FileText size={14} strokeWidth={2} />
                            <span>
                                {selectedDocIds.length > 0
                                    ? `${selectedDocIds.length} document${selectedDocIds.length > 1 ? 's' : ''} attached`
                                    : 'Attach documents for context'}
                            </span>
                            <span style={{ fontSize: 10, marginLeft: 'auto' }}>{showDocPicker ? '▲' : '▼'}</span>
                        </button>
                        {showDocPicker && (
                            <div className="vrb-doc-list">
                                {activeDocs.map(doc => (
                                    <label key={doc.id} className={`vrb-doc-item ${selectedDocIds.includes(doc.id) ? 'selected' : ''}`}>
                                        <input
                                            type="checkbox"
                                            checked={selectedDocIds.includes(doc.id)}
                                            onChange={() => toggleDoc(doc.id)}
                                        />
                                        <span className="vrb-doc-name">{doc.filename}</span>
                                        <span className="vrb-doc-size">{doc.size < 1048576 ? `${(doc.size / 1024).toFixed(0)} KB` : `${(doc.size / 1048576).toFixed(1)} MB`}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Transcript */}
                {(transcript || isRecording) && (
                    <div className="vrb-transcript">
                        {transcript || ''}
                    </div>
                )}

                {/* Processing */}
                {isProcessing && (
                    <div className="vrb-processing">
                        <div className="vrb-processing-spinner" />
                        <span>Analyzing your brief and filling form fields...</span>
                    </div>
                )}

                {/* Done */}
                {isDone && (
                    <div className="vrb-done">
                        <CheckCircle size={16} strokeWidth={2} />
                        <span>{filledCount} form fields filled from your brief!</span>
                    </div>
                )}

                {/* Action buttons */}
                {transcript && !isRecording && !isTranscribing && !isProcessing && (
                    <div className="vrb-actions">
                        <button
                            type="button"
                            className="vrb-autofill-btn"
                            onClick={handleAutoFill}
                            disabled={!transcript.trim()}
                        >
                            <Sparkles size={14} strokeWidth={2} /> Auto-Fill Form
                        </button>
                        <button
                            type="button"
                            className="vrb-clear-btn"
                            onClick={handleClear}
                        >
                            Clear
                        </button>
                        <button
                            type="button"
                            className="vrb-record-btn"
                            onClick={startRecording}
                            style={{ padding: '8px 14px', fontSize: 12 }}
                        >
                            <span className="vrb-record-dot" style={{ width: 8, height: 8 }} />
                            Continue
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
