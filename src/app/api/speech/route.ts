// ─── POST /api/speech — Transcribe audio using OpenAI Whisper ─────────────

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import OpenAI from 'openai';
import { toFile } from 'openai';

export const runtime = 'nodejs';

export async function POST(request: Request) {
    try {
        // ── Auth ─────────────────────────────────────────────────────────
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        // ── Parse multipart body ─────────────────────────────────────────
        const formData = await request.formData();
        const audio = formData.get('audio');

        if (!audio || !(audio instanceof Blob)) {
            return NextResponse.json({ error: 'No audio blob provided' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
        }

        // ── Convert Blob → File for the OpenAI SDK ───────────────────────
        const arrayBuffer = await audio.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        // Determine file extension from mime type
        const mimeType = audio.type || 'audio/webm';
        const ext = mimeType.includes('mp4') || mimeType.includes('m4a')
            ? 'mp4'
            : mimeType.includes('ogg')
                ? 'ogg'
                : mimeType.includes('wav')
                    ? 'wav'
                    : 'webm';

        const file = await toFile(buffer, `audio.${ext}`, { type: mimeType });

        // ── Call Whisper ─────────────────────────────────────────────────
        const openai = new OpenAI({ apiKey });
        const transcription = await openai.audio.transcriptions.create({
            model: 'whisper-1',
            file,
            // Let Whisper auto-detect language for best results across PT/EN/FR
        });

        const transcript = transcription.text?.trim() ?? '';

        return NextResponse.json({ transcript });
    } catch (error) {
        console.error('[speech] Whisper transcription error:', error);
        return NextResponse.json({ error: 'Transcription failed' }, { status: 500 });
    }
}
