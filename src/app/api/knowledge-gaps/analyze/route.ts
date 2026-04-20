import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHAT_MODEL = 'gpt-5.4-mini';
const SIMILARITY_THRESHOLD = 0.72;
const MIN_CLUSTER_SIZE = 2;
const LOOKBACK_DAYS = 30;

// Cosine similarity helper
function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, normA = 0, normB = 0;
    for (let i = 0; i < a.length; i++) {
        dot += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dot / denom;
}

/**
 * POST /api/knowledge-gaps/analyze
 * Full gap detection pipeline:
 * 1. Fetch recent failed/partial question logs
 * 2. Embed questions
 * 3. Cluster by cosine similarity
 * 4. Generate topic label + suggestion via AI
 * 5. Score and upsert KnowledgeGap records
 * 6. Auto-resolve gaps with improved grounding
 */
export async function POST() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    const db = createAdminClient();
    const openai = new OpenAI({ apiKey });
    const companyId = auth.dbUser.companyId;
    const since = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString();

    try {
        // ─── Step 1: Fetch failed/partial question logs ──────────────
        const { data: logs } = await db
            .from('AssistantQuestionLog')
            .select('id, question, groundingStatus, createdAt')
            .eq('companyId', companyId)
            .in('groundingStatus', ['NOT_FOUND', 'PARTIAL'])
            .gte('createdAt', since)
            .order('createdAt', { ascending: false })
            .limit(200);

        if (!logs || logs.length === 0) {
            return NextResponse.json({ message: 'No failed questions found', gaps: [] });
        }

        // ─── Step 2: Also fetch ALL recent logs for auto-resolution check ───
        const { data: allRecentLogs } = await db
            .from('AssistantQuestionLog')
            .select('question, groundingStatus, createdAt')
            .eq('companyId', companyId)
            .gte('createdAt', since);

        // ─── Step 3: Deduplicate questions (exact match) ──────────────
        const uniqueQMap = new Map<string, { question: string; groundingStatus: string; createdAt: string; count: number }>();
        for (const log of logs) {
            const key = log.question.toLowerCase().trim();
            const existing = uniqueQMap.get(key);
            if (existing) {
                existing.count++;
                if (log.groundingStatus === 'NOT_FOUND') existing.groundingStatus = 'NOT_FOUND';
            } else {
                uniqueQMap.set(key, { question: log.question, groundingStatus: log.groundingStatus, createdAt: log.createdAt, count: 1 });
            }
        }
        const uniqueQuestions = Array.from(uniqueQMap.values());

        // ─── Step 4: Embed all unique questions ──────────────────────
        const embeddingResults = await Promise.all(
            uniqueQuestions.map(async (q) => {
                const resp = await openai.embeddings.create({
                    model: EMBEDDING_MODEL,
                    input: q.question.substring(0, 512),
                });
                return { ...q, embedding: resp.data[0].embedding };
            })
        );

        // ─── Step 5: Greedy clustering ────────────────────────────────
        const clusters: typeof embeddingResults[number][][] = [];
        const assigned = new Set<number>();

        for (let i = 0; i < embeddingResults.length; i++) {
            if (assigned.has(i)) continue;
            const cluster = [embeddingResults[i]];
            assigned.add(i);
            for (let j = i + 1; j < embeddingResults.length; j++) {
                if (assigned.has(j)) continue;
                const sim = cosineSimilarity(embeddingResults[i].embedding, embeddingResults[j].embedding);
                if (sim >= SIMILARITY_THRESHOLD) {
                    cluster.push(embeddingResults[j]);
                    assigned.add(j);
                }
            }
            clusters.push(cluster);
        }

        // Only process clusters that have enough questions to be a real gap
        const significantClusters = clusters.filter(c => c.length >= MIN_CLUSTER_SIZE);

        if (significantClusters.length === 0) {
            return NextResponse.json({ message: 'No significant gaps detected (need 2+ similar questions)', gaps: [] });
        }

        // ─── Step 6: AI topic + suggestion generation ─────────────────
        const upsertedGaps = [];

        for (const cluster of significantClusters) {
            const exampleQuestions = cluster.map(c => c.question).slice(0, 8);
            const frequency = cluster.reduce((sum, c) => sum + c.count, 0);
            const notFoundCount = cluster.filter(c => c.groundingStatus === 'NOT_FOUND').length;
            const groundingRate = notFoundCount / cluster.length;
            const lastSeenAt = cluster.sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0].createdAt;

            // Recency boost: questions asked very recently get a higher score
            const recencyDays = (Date.now() - new Date(lastSeenAt).getTime()) / (1000 * 60 * 60 * 24);
            const recencyBoost = Math.max(0, 1 - recencyDays / LOOKBACK_DAYS);
            const score = (Math.min(frequency, 20) / 20) * 0.4 + groundingRate * 0.4 + recencyBoost * 0.2;

            // AI: Generate topic label
            let topic = 'Unknown Topic';
            try {
                const topicResp = await openai.chat.completions.create({
                    model: CHAT_MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: 'You are an expert at identifying knowledge topics. Given a list of employee questions that went unanswered, identify the common knowledge topic in 3-6 words. Return ONLY the topic label, nothing else. Examples: "Refund Policy", "Employee Onboarding Process", "Sales Proposal Template".',
                        },
                        {
                            role: 'user',
                            content: `Questions:\n${exampleQuestions.map(q => `- ${q}`).join('\n')}\n\nReturn a short topic label:`,
                        },
                    ],
                    max_completion_tokens: 30,
                    temperature: 0.2,
                });
                topic = topicResp.choices[0]?.message?.content?.trim() || topic;
            } catch (err) {
                console.error('[analyze] Topic generation failed:', err);
            }

            // AI: Generate documentation suggestion
            let suggestion = null;
            try {
                const suggResp = await openai.chat.completions.create({
                    model: CHAT_MODEL,
                    messages: [
                        {
                            role: 'system',
                            content: 'És um especialista em gestão do conhecimento. Com base no tópico de lacuna de conhecimento e em exemplos de perguntas de colaboradores, escreve uma recomendação específica e prática sobre que documentação a empresa deve criar. Escreve 1-2 frases em português de Portugal. Sê direto e concreto.',
                        },
                        {
                            role: 'user',
                            content: `Knowledge Gap Topic: ${topic}\n\nExample questions:\n${exampleQuestions.slice(0, 4).map(q => `- ${q}`).join('\n')}\n\nWhat documentation should be created?`,
                        },
                    ],
                    max_completion_tokens: 120,
                    temperature: 0.3,
                });
                suggestion = suggResp.choices[0]?.message?.content?.trim() || null;
            } catch (err) {
                console.error('[analyze] Suggestion generation failed:', err);
            }

            // ─── Upsert gap (find existing by fuzzy topic match or create new) ──
            const { data: existingGaps } = await db
                .from('KnowledgeGap')
                .select('id, topic, status')
                .eq('companyId', companyId)
                .neq('status', 'ignored');

            // Find if there's an existing open gap for a similar topic (simple substring match)
            const existingMatch = (existingGaps || []).find(g =>
                g.topic.toLowerCase().includes(topic.toLowerCase().split(' ')[0]) ||
                topic.toLowerCase().includes(g.topic.toLowerCase().split(' ')[0])
            );

            const gapData = {
                companyId,
                topic,
                exampleQuestions: exampleQuestions as unknown,
                suggestion,
                frequency,
                groundingRate,
                score: Math.round(score * 1000) / 1000,
                status: 'open',
                lastSeenAt,
                updatedAt: new Date().toISOString(),
            };

            let gap;
            if (existingMatch) {
                const { data } = await db
                    .from('KnowledgeGap')
                    .update(gapData)
                    .eq('id', existingMatch.id)
                    .select()
                    .single();
                gap = data;
            } else {
                const { data } = await db
                    .from('KnowledgeGap')
                    .insert({ id: crypto.randomUUID(), createdAt: new Date().toISOString(), ...gapData })
                    .select()
                    .single();
                gap = data;
            }
            if (gap) upsertedGaps.push(gap);
        }

        // ─── Step 7: Auto-resolve check ───────────────────────────────
        const { data: openGaps } = await db
            .from('KnowledgeGap')
            .select('id, topic, exampleQuestions')
            .eq('companyId', companyId)
            .eq('status', 'open');

        for (const gap of (openGaps || [])) {
            const gapQuestions = (gap.exampleQuestions as string[]) || [];
            if (gapQuestions.length === 0) continue;

            // Check recent logs for the same topic — if VERIFIED rate is high, auto-resolve
            const firstWord = gap.topic.toLowerCase().split(' ')[0];
            const recentForTopic = (allRecentLogs || []).filter(l =>
                l.question.toLowerCase().includes(firstWord)
            );
            if (recentForTopic.length < 2) continue;

            const verifiedCount = recentForTopic.filter(l => l.groundingStatus === 'VERIFIED').length;
            const verifiedRate = verifiedCount / recentForTopic.length;

            if (verifiedRate >= 0.7) {
                await db
                    .from('KnowledgeGap')
                    .update({ status: 'resolved', updatedAt: new Date().toISOString() })
                    .eq('id', gap.id);
                console.log(`[analyze] Auto-resolved gap: ${gap.topic} (verified rate: ${(verifiedRate * 100).toFixed(0)}%)`);
            }
        }

        return NextResponse.json({
            message: `Analysis complete. Detected ${upsertedGaps.length} knowledge gap(s).`,
            gaps: upsertedGaps,
            totalLogsAnalyzed: logs.length,
            clustersFound: significantClusters.length,
        });
    } catch (err) {
        console.error('[/api/knowledge-gaps/analyze POST]', err);
        return NextResponse.json({ error: 'Analysis failed', detail: String(err) }, { status: 500 });
    }
}
