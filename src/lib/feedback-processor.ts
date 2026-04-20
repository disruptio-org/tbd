/**
 * Feedback Processor — Captures user edits on AI outputs
 * and uses GPT to determine how to update Company DNA nodes.
 */

import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/admin';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ─── Capture Feedback ────────────────────────────────── */

export async function captureFeedback(
    companyId: string,
    sourceType: 'output_edit' | 'manual_correction' | 'approval' | 'rejection',
    originalContent: string | null,
    editedContent: string | null,
    affectedNodeIds: string[] = [],
): Promise<string> {
    const db = createAdminClient();

    const id = crypto.randomUUID();
    await db.from('FeedbackEvent').insert({
        id,
        companyId,
        sourceType,
        originalContent,
        editedContent,
        affectedNodeIds,
        status: 'pending',
    });

    return id;
}

/* ─── Process Feedback ────────────────────────────────── */

export async function processFeedback(feedbackEventId: string): Promise<{
    nodesUpdated: number;
    nodesCreated: number;
}> {
    const db = createAdminClient();

    const { data: event } = await db
        .from('FeedbackEvent')
        .select('*')
        .eq('id', feedbackEventId)
        .single();

    if (!event || event.status !== 'pending') {
        return { nodesUpdated: 0, nodesCreated: 0 };
    }

    // For manual corrections, the affectedNodeIds are already specified
    if (event.sourceType === 'manual_correction' && event.affectedNodeIds?.length > 0) {
        await db
            .from('FeedbackEvent')
            .update({ status: 'processed', processedAt: new Date().toISOString() })
            .eq('id', feedbackEventId);

        return { nodesUpdated: event.affectedNodeIds.length, nodesCreated: 0 };
    }

    // For output edits, use GPT to analyze the diff
    if (event.sourceType === 'output_edit' && event.originalContent && event.editedContent) {
        try {
            const analysis = await analyzeDiff(
                event.companyId,
                event.originalContent,
                event.editedContent,
            );

            let nodesUpdated = 0;

            for (const correction of analysis.corrections) {
                if (correction.nodeId) {
                    await db
                        .from('KnowledgeNode')
                        .update({
                            content: correction.updatedContent,
                            updatedAt: new Date().toISOString(),
                        })
                        .eq('id', correction.nodeId);
                    nodesUpdated++;
                }
            }

            await db
                .from('FeedbackEvent')
                .update({ status: 'processed', processedAt: new Date().toISOString() })
                .eq('id', feedbackEventId);

            return { nodesUpdated, nodesCreated: 0 };
        } catch (err) {
            console.error('[feedback] Error processing feedback:', err);
        }
    }

    // Mark as dismissed if we can't process
    await db
        .from('FeedbackEvent')
        .update({ status: 'dismissed', processedAt: new Date().toISOString() })
        .eq('id', feedbackEventId);

    return { nodesUpdated: 0, nodesCreated: 0 };
}

/* ─── Analyze Diff via GPT ────────────────────────────── */

interface DiffCorrection {
    nodeId: string | null;
    field: string;
    oldValue: string;
    newValue: string;
    updatedContent: Record<string, unknown>;
}

async function analyzeDiff(
    companyId: string,
    original: string,
    edited: string,
): Promise<{ corrections: DiffCorrection[] }> {
    const db = createAdminClient();

    // Load existing nodes for context
    const { data: nodes } = await db
        .from('KnowledgeNode')
        .select('id, type, title, content')
        .eq('companyId', companyId)
        .eq('status', 'active')
        .limit(50);

    const nodeContext = (nodes || [])
        .map(n => `[${n.id}] ${n.type}: "${n.title}"`)
        .join('\n');

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: `You analyze user edits on AI-generated content to determine what company knowledge should be corrected.

EXISTING KNOWLEDGE NODES:
${nodeContext}

Given the original AI output and the user's edited version, identify what factual corrections the user made.
For each correction, determine which knowledge node should be updated.

Return JSON:
{
  "corrections": [
    {
      "nodeId": "<id of existing node to update, or null if no match>",
      "field": "<which field to update>",
      "oldValue": "<what the AI said>",
      "newValue": "<what the user corrected it to>"
    }
  ]
}

If the edit is purely stylistic (tone, formatting), return { "corrections": [] }.`,
            },
            {
                role: 'user',
                content: `ORIGINAL:\n${original.slice(0, 4000)}\n\nEDITED:\n${edited.slice(0, 4000)}`,
            },
        ],
    });

    try {
        const result = JSON.parse(response.choices[0]?.message?.content || '{}');
        return { corrections: Array.isArray(result.corrections) ? result.corrections : [] };
    } catch {
        return { corrections: [] };
    }
}
