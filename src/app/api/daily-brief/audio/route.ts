import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import OpenAI from 'openai';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/* ─── POST: Generate podcast audio from brief ────────── */

export async function POST() {
    try {
        const { prisma } = await import('@/lib/prisma');
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: { company: true },
        });
        if (!dbUser?.companyId) return NextResponse.json({ error: 'No company' }, { status: 404 });

        const todayStr = new Date().toISOString().split('T')[0];
        const today = new Date(todayStr);

        // Get today's brief
        const brief = await prisma.dailyBrief.findUnique({
            where: { companyId_userId_date: { companyId: dbUser.companyId, userId: dbUser.id, date: today } },
        });

        if (!brief) {
            return NextResponse.json({ error: 'No brief found for today. Generate the text brief first.' }, { status: 404 });
        }

        // If audio already exists, return it
        if (brief.audioUrl) {
            return NextResponse.json({ audioUrl: brief.audioUrl, duration: brief.audioDuration });
        }

        // ── Generate podcast script from brief text ──
        const lang = dbUser.company?.language === 'pt-PT' ? 'Portuguese' : 'English';
        const openai = new OpenAI();

        let podcastScript = brief.podcastScript;
        if (!podcastScript) {
            const scriptCompletion = await openai.chat.completions.create({
                model: 'gpt-4o-mini',
                temperature: 0.8,
                max_tokens: 800,
                messages: [
                    {
                        role: 'system',
                        content: `You are a podcast script writer for Nousio, an AI operating system. Convert the following daily brief into a natural, conversational monologue suitable for text-to-speech. Write in ${lang}.

Rules:
- Speak directly to the listener: "Good morning..." / "Here's what you need to know..."
- Use natural transitions: "Now, let's look at...", "One thing worth noting...", "Moving on..."
- Keep it 300-450 words (about 2-3 minutes spoken)
- No markdown, no special characters, no emojis — pure spoken text
- Sound like a calm, professional executive briefing — think Bloomberg Morning Brief
- End with a motivating closer: "Let's make it count today."`,
                    },
                    {
                        role: 'user',
                        content: `Convert this daily brief to a podcast script:\n\n${brief.briefText}`,
                    },
                ],
            });
            podcastScript = scriptCompletion.choices[0]?.message?.content || brief.briefText;
        }

        // ── Generate audio via OpenAI TTS ──
        const mp3Response = await openai.audio.speech.create({
            model: 'tts-1-hd',
            voice: 'onyx',
            input: podcastScript,
            speed: 1.0,
            response_format: 'mp3',
        });

        const audioBuffer = Buffer.from(await mp3Response.arrayBuffer());
        const audioDuration = Math.ceil(podcastScript.split(/\s+/).length / 2.5); // Rough estimate: 150 WPM

        // ── Upload to Supabase Storage ──
        const fileName = `daily-briefs/${dbUser.companyId}/${today.toISOString().split('T')[0]}_${dbUser.id}.mp3`;

        const { error: uploadError } = await supabase.storage
            .from('daily-briefs')
            .upload(fileName, audioBuffer, {
                contentType: 'audio/mpeg',
                upsert: true,
            });

        let audioUrl = '';
        if (uploadError) {
            console.error('[daily-brief/audio] Storage upload error:', uploadError);
            // Fallback: serve as base64 data URL
            audioUrl = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;
        } else {
            const { data: urlData } = supabase.storage
                .from('daily-briefs')
                .getPublicUrl(fileName);
            audioUrl = urlData.publicUrl;
        }

        // Update the brief record
        await prisma.dailyBrief.update({
            where: { id: brief.id },
            data: { podcastScript, audioUrl, audioDuration },
        });

        return NextResponse.json({ audioUrl, duration: audioDuration });
    } catch (err) {
        console.error('[api/daily-brief/audio] Error:', err);
        return NextResponse.json({ error: 'Failed to generate audio brief' }, { status: 500 });
    }
}

/* ─── GET: Stream cached audio ───────────────────────── */

export async function GET() {
    try {
        const { prisma } = await import('@/lib/prisma');
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
        if (!dbUser?.companyId) return NextResponse.json({ error: 'No company' }, { status: 404 });

        const todayStr = new Date().toISOString().split('T')[0];
        const today = new Date(todayStr);

        const brief = await prisma.dailyBrief.findUnique({
            where: { companyId_userId_date: { companyId: dbUser.companyId, userId: dbUser.id, date: today } },
        });

        if (!brief?.audioUrl) {
            return NextResponse.json({ error: 'No audio available', hasAudio: false }, { status: 404 });
        }

        return NextResponse.json({ audioUrl: brief.audioUrl, duration: brief.audioDuration, hasAudio: true });
    } catch (err) {
        console.error('[api/daily-brief/audio] GET error:', err);
        return NextResponse.json({ error: 'Failed to retrieve audio' }, { status: 500 });
    }
}
