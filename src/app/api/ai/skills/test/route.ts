// ═══════════════════════════════════════════════════════
// API: /api/ai/skills/test — Lightweight skill test execution
// ═══════════════════════════════════════════════════════
//
// Accepts multipart/form-data:
//   - instructionPrompt: string
//   - trainingMaterials: JSON string of [{filename, textContent}]
//   - testMessage: string (required)
//   - files: attached files (images, PDFs, text files)
//
// Returns: { output } — the AI-generated result
// Does NOT create conversations or messages in the database.

import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import OpenAI from 'openai';

const CHAT_MODEL = 'gpt-5.4-mini';

// Image MIME types that can be sent via vision API
const IMAGE_MIMES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (auth.dbUser.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required' }, { status: 403 });

    try {
        const contentType = request.headers.get('content-type') || '';

        let instructionPrompt = '';
        let trainingMaterials: { filename: string; textContent: string }[] = [];
        let testMessage = '';
        const imageContents: { type: 'image_url'; image_url: { url: string } }[] = [];
        const textFileContents: string[] = [];

        if (contentType.includes('multipart/form-data')) {
            // Multipart: files + fields
            const formData = await request.formData();
            instructionPrompt = (formData.get('instructionPrompt') as string) || '';
            testMessage = (formData.get('testMessage') as string) || '';

            const tmRaw = formData.get('trainingMaterials') as string;
            if (tmRaw) {
                try { trainingMaterials = JSON.parse(tmRaw); } catch { /* ignore */ }
            }

            // Process attached files
            const files = formData.getAll('files') as File[];
            for (const file of files) {
                if (IMAGE_MIMES.includes(file.type)) {
                    // Convert image to base64 data URL for vision API
                    const buffer = await file.arrayBuffer();
                    const base64 = Buffer.from(buffer).toString('base64');
                    const dataUrl = `data:${file.type};base64,${base64}`;
                    imageContents.push({
                        type: 'image_url',
                        image_url: { url: dataUrl },
                    });
                } else {
                    // Text-based file: read as string
                    try {
                        const text = await file.text();
                        textFileContents.push(`[Attached file: ${file.name}]\n${text}`);
                    } catch {
                        textFileContents.push(`[Attached file: ${file.name}] (could not read as text)`);
                    }
                }
            }
        } else {
            // JSON fallback (backward compatible)
            const body = await request.json();
            instructionPrompt = body.instructionPrompt || '';
            trainingMaterials = body.trainingMaterials || [];
            testMessage = body.testMessage || '';
        }

        if (!testMessage?.trim()) {
            return NextResponse.json({ error: 'testMessage is required' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

        const openai = new OpenAI({ apiKey });

        // Build system prompt from skill instructions + training materials
        const systemParts: string[] = [];

        if (instructionPrompt?.trim()) {
            systemParts.push(`SKILL INSTRUCTIONS:\n${instructionPrompt}`);
        }

        if (trainingMaterials && Array.isArray(trainingMaterials) && trainingMaterials.length > 0) {
            const refText = trainingMaterials
                .map((m: { filename: string; textContent: string }) => `[Reference: ${m.filename}]\n${m.textContent}`)
                .join('\n\n---\n\n');
            systemParts.push(`REFERENCE MATERIALS:\n${refText}`);
        }

        const systemPrompt = systemParts.length > 0
            ? systemParts.join('\n\n') + '\n\nOUTPUT FORMAT: When generating UI/screen code, output clean HTML with Tailwind CSS classes (not React/JSX). Use standard HTML attributes (class= not className=). The output will be rendered directly in a browser preview.'
            : 'You are a helpful AI assistant. Follow any instructions provided above.';

        // Build user message content (text + attached text files + images)
        let userText = testMessage;
        if (textFileContents.length > 0) {
            userText += '\n\n' + textFileContents.join('\n\n');
        }

        // If there are images, use multi-modal content format
        const hasImages = imageContents.length > 0;
        const userContent: OpenAI.ChatCompletionContentPart[] | string = hasImages
            ? [
                { type: 'text', text: userText },
                ...imageContents,
            ]
            : userText;

        const completion = await openai.chat.completions.create({
            model: CHAT_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userContent },
            ],
            max_completion_tokens: 4096,
            temperature: 0.4,
        });

        const output = completion.choices[0]?.message?.content || 'No output generated.';

        return NextResponse.json({ output });
    } catch (error) {
        console.error('[api/ai/skills/test] POST error:', error);
        return NextResponse.json({ error: 'Test execution failed' }, { status: 500 });
    }
}
