/**
 * Wiki Log — Append-only knowledge evolution log.
 *
 * Tracks every wiki operation (compile, lint, backfill) as KnowledgeNode
 * entries with type='wiki_log' for audit trail.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { WikiLogEntry } from './types';

/**
 * Append an entry to the wiki log for a company.
 */
export async function appendWikiLog(
    companyId: string,
    dnaId: string,
    entry: WikiLogEntry,
): Promise<void> {
    const db = createAdminClient();

    try {
        await db.from('KnowledgeNode').insert({
            id: crypto.randomUUID(),
            companyId,
            dnaId,
            type: 'wiki_log',
            title: `[${entry.action}] ${entry.sourceDocumentName || entry.details || entry.action}`,
            content: entry,
            summary: formatLogSummary(entry),
            confidenceScore: 1.0,
            sourceDocumentIds: entry.sourceDocumentId ? [entry.sourceDocumentId] : [],
            status: 'active',
            updatedAt: entry.timestamp,
        });
    } catch (err) {
        console.error('[wiki/log] Failed to append log entry:', err);
    }
}

/**
 * Get recent wiki log entries for a company.
 */
export async function getWikiLog(
    companyId: string,
    limit = 20,
): Promise<WikiLogEntry[]> {
    const db = createAdminClient();

    const { data } = await db
        .from('KnowledgeNode')
        .select('content')
        .eq('companyId', companyId)
        .eq('type', 'wiki_log')
        .order('updatedAt', { ascending: false })
        .limit(limit);

    return (data || []).map(row => row.content as WikiLogEntry);
}

/* ─── Helpers ─────────────────────────────────────────── */

function formatLogSummary(entry: WikiLogEntry): string {
    switch (entry.action) {
        case 'compile':
            return `Compiled "${entry.sourceDocumentName || 'document'}": ${entry.entitiesExtracted || 0} entities, ${entry.edgesCreated || 0} edges`;
        case 'lint':
            return `Wiki health check: ${entry.details || 'completed'}`;
        case 'backfill':
            return `Backfill: ${entry.details || 'completed'}`;
        case 'manual_edit':
            return `Manual edit: ${entry.details || 'updated'}`;
        default:
            return entry.details || entry.action;
    }
}
