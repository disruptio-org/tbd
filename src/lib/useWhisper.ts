'use client';

import { useState, useRef, useCallback } from 'react';

/* ─── Options ────────────────────────────────────────────────────────── */

interface UseWhisperOptions {
    /** Called when a transcript is successfully returned from Whisper */
    onTranscript?: (text: string) => void;
    /** Called when transcription fails for any reason */
    onError?: (errorMessage: string) => void;
}

/* ─── Return value ───────────────────────────────────────────────────── */

export interface UseWhisperReturn {
    /** True while the microphone is actively recording */
    isRecording: boolean;
    /** True while the audio is being sent to and processed by Whisper */
    isTranscribing: boolean;
    /** The last transcript returned by Whisper */
    transcript: string;
    /** Start capturing microphone audio */
    startRecording: () => Promise<void>;
    /**
     * Stop capturing audio and send it to Whisper.
     * Resolves when the transcript is ready (or on error).
     */
    stopRecording: () => Promise<void>;
    /** Clear the stored transcript */
    clearTranscript: () => void;
    /** Any error message from the last transcription attempt */
    error: string | null;
}

/* ═══════════════════════════════════════════════════════════════════════
   useWhisper Hook
   ═══════════════════════════════════════════════════════════════════════ */

export function useWhisper(options?: UseWhisperOptions): UseWhisperReturn {
    const { onTranscript, onError } = options ?? {};

    const [isRecording, setIsRecording] = useState(false);
    const [isTranscribing, setIsTranscribing] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const streamRef = useRef<MediaStream | null>(null);

    /* ── Start recording ──────────────────────────────────────────── */

    const startRecording = useCallback(async () => {
        setError(null);

        // Request microphone permission
        let stream: MediaStream;
        try {
            stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        } catch {
            const msg = 'Microphone access denied. Please allow microphone access and try again.';
            setError(msg);
            return;
        }

        streamRef.current = stream;
        chunksRef.current = [];

        // Pick the best supported mime type
        const mimeType = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
        ].find((m) => MediaRecorder.isTypeSupported(m)) ?? '';

        const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        mediaRecorderRef.current = recorder;
        recorder.start(250); // collect chunks every 250ms
        setIsRecording(true);
    }, []);

    /* ── Stop recording and transcribe ────────────────────────────── */

    const stopRecording = useCallback(async () => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) return;

        // Stop all mic tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        setIsRecording(false);
        setIsTranscribing(true);

        await new Promise<void>((resolve) => {
            recorder.onstop = async () => {
                try {
                    const blob = new Blob(chunksRef.current, {
                        type: recorder.mimeType || 'audio/webm',
                    });

                    if (blob.size === 0) {
                        setError('No audio captured. Please try again.');
                        return;
                    }

                    // Send to Whisper via our API route
                    const form = new FormData();
                    form.append('audio', blob, 'recording.webm');

                    const res = await fetch('/api/speech', {
                        method: 'POST',
                        body: form,
                    });

                    if (!res.ok) {
                        const data = await res.json().catch(() => ({}));
                        throw new Error(data.error || `HTTP ${res.status}`);
                    }

                    const data = await res.json();
                    const text: string = data.transcript ?? '';

                    setTranscript(text);
                    onTranscript?.(text);
                } catch (err: unknown) {
                    const msg = err instanceof Error ? err.message : 'Transcription failed';
                    console.error('[useWhisper] error:', msg);
                    setError(msg);
                    onError?.(msg);
                } finally {
                    setIsTranscribing(false);
                    resolve();
                }
            };

            recorder.stop();
        });

        mediaRecorderRef.current = null;
        chunksRef.current = [];
    }, [onTranscript, onError]);

    /* ── Clear transcript ─────────────────────────────────────────── */

    const clearTranscript = useCallback(() => {
        setTranscript('');
        setError(null);
    }, []);

    return {
        isRecording,
        isTranscribing,
        transcript,
        startRecording,
        stopRecording,
        clearTranscript,
        error,
    };
}
