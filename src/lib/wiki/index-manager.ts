/**
 * Wiki Index Manager — Maintains a master index node per company.
 *
 * The index is a single KnowledgeNode with type='wiki_index' that contains
 * a summary of all wiki pages — used for fast topic lookup without scanning.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { WIKI_ENTITY_TYPES, type WikiEntityType, type WikiIndexEntry } from './types';

/**
 * Rebuild the wiki index for a company.
 * Counts all active KnowledgeNode by type and stores as a single index node.
 */
export async function updateWikiIndex(companyId: string): Promise<void> {
    const db = createAdminClient();

    try {
        // Count nodes by type
        const { data: nodes } = await db
            .from('KnowledgeNode')
            .select('type, title')
            .eq('companyId', companyId)
            .eq('status', 'active');

        if (!nodes) return;

        // Build type breakdown
        const typeMap: Record<string, { count: number; titles: string[] }> = {};
        for (const node of nodes) {
            if (!typeMap[node.type]) {
                typeMap[node.type] = { count: 0, titles: [] };
            }
            typeMap[node.type].count++;
            if (typeMap[node.type].titles.length < 10) {
                typeMap[node.type].titles.push(node.title);
            }
        }

        const typeBreakdown: WikiIndexEntry[] = WIKI_ENTITY_TYPES
            .filter(t => typeMap[t])
            .map(t => ({
                type: t as WikiEntityType,
                count: typeMap[t].count,
                titles: typeMap[t].titles,
            }));

        const indexContent = {
            totalNodes: nodes.length,
            typeBreakdown,
            lastUpdated: new Date().toISOString(),
        };

        // Upsert the index node
        const { data: existing } = await db
            .from('KnowledgeNode')
            .select('id')
            .eq('companyId', companyId)
            .eq('type', 'wiki_index')
            .maybeSingle();

        if (existing) {
            await db.from('KnowledgeNode').update({
                content: indexContent,
                summary: `Wiki index: ${nodes.length} nodes across ${typeBreakdown.length} categories`,
                updatedAt: new Date().toISOString(),
            }).eq('id', existing.id);
        } else {
            // Find the DNA record for this company
            const { data: dna } = await db
                .from('CompanyDNA')
                .select('id')
                .eq('companyId', companyId)
                .maybeSingle();

            if (!dna) return;

            await db.from('KnowledgeNode').insert({
                id: crypto.randomUUID(),
                companyId,
                dnaId: dna.id,
                type: 'wiki_index',
                title: 'Wiki Index',
                content: indexContent,
                summary: `Wiki index: ${nodes.length} nodes across ${typeBreakdown.length} categories`,
                confidenceScore: 1.0,
                sourceDocumentIds: [],
                status: 'active',
                updatedAt: new Date().toISOString(),
            });
        }

        console.log(`[wiki/index] Updated index: ${nodes.length} nodes, ${typeBreakdown.length} types`);
    } catch (err) {
        console.error('[wiki/index] Failed to update index:', err);
    }
}

/**
 * Get the wiki index for a company (fast lookup).
 */
export async function getWikiIndex(companyId: string): Promise<{
    totalNodes: number;
    typeBreakdown: WikiIndexEntry[];
} | null> {
    const db = createAdminClient();

    const { data } = await db
        .from('KnowledgeNode')
        .select('content')
        .eq('companyId', companyId)
        .eq('type', 'wiki_index')
        .eq('status', 'active')
        .maybeSingle();

    if (!data?.content) return null;

    const content = data.content as Record<string, unknown>;
    return {
        totalNodes: (content.totalNodes as number) || 0,
        typeBreakdown: (content.typeBreakdown as WikiIndexEntry[]) || [],
    };
}
