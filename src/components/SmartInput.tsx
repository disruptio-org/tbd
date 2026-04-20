'use client';

import { useEffect } from 'react';
import { useState } from 'react';
import { useWhisper } from '@/lib/useWhisper';
import './SmartInput.css';

/* ─── Types ──────────────────────────────────────────── */

interface SmartInputProps {
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    rows?: number;
    multiline?: boolean;
    brainType: string;
    fieldLabel: string;
    id?: string;
    required?: boolean;
    disabled?: boolean;
    className?: string;
}

/* ═══════════════════════════════════════════════════════
   SmartInput Component
   ═══════════════════════════════════════════════════════ */

export default function SmartInput({
    value,
    onChange,
    placeholder,
    rows = 2,
    multiline = false,
    brainType,
    fieldLabel,
    id,
    required,
    disabled,
    className,
}: SmartInputProps) {
    const [isRewriting, setIsRewriting] = useState(false);

    const { isRecording, isTranscribing, transcript, startRecording, stopRecording, clearTranscript } = useWhisper();

    /* ─── Append transcript to field value when it arrives ──── */
    useEffect(() => {
        if (!transcript) return;
        const separator = value.trim() ? ' ' : '';
        onChange(value.trim() + separator + transcript);
        clearTranscript();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transcript]);

    /* ─── Speech-to-Text ────────────────────────────── */

    async function toggleVoice() {
        if (isRecording) {
            await stopRecording();
        } else {
            await startRecording();
        }
    }

    /* ─── AI Rewrite ────────────────────────────────── */

    async function handleAIRewrite() {
        if (!value.trim() || isRewriting) return;

        setIsRewriting(true);
        try {
            const res = await fetch('/api/ai/rewrite', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    text: value,
                    fieldLabel,
                    brainType,
                }),
            });

            if (res.ok) {
                const data = await res.json();
                if (data.rewritten) {
                    onChange(data.rewritten);
                }
            }
        } catch {
            // Silent fail — field keeps its value
        }
        setIsRewriting(false);
    }

    /* ─── Render ────────────────────────────────────── */

    const hasContent = value.trim().length > 0;

    return (
        <div className={`smart-input-wrapper ${className || ''}`}>
            {multiline ? (
                <textarea
                    id={id}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    rows={rows}
                    required={required}
                    disabled={disabled}
                    className="smart-input-field"
                />
            ) : (
                <input
                    id={id}
                    type="text"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    disabled={disabled}
                    className="smart-input-field"
                />
            )}
            <div className="smart-input-actions">
                <button
                    type="button"
                    className={`smart-input-btn smart-btn-voice ${isRecording ? 'recording' : ''}`}
                    onClick={toggleVoice}
                    title={isRecording ? 'Stop & transcribe' : isTranscribing ? 'Transcribing…' : 'Voice input (Whisper)'}
                    disabled={disabled || isTranscribing}
                >
                    {isTranscribing ? '⏳' : isRecording ? '⏹️' : '🎙️'}
                </button>
                <button
                    type="button"
                    className={`smart-input-btn smart-btn-ai ${isRewriting ? 'rewriting' : ''}`}
                    onClick={handleAIRewrite}
                    title="Redefine with AI"
                    disabled={disabled || !hasContent || isRewriting}
                >
                    {isRewriting ? '⏳' : '✨'}
                </button>
            </div>
        </div>
    );
}
