/**
 * Wiki Retriever — Wiki-first knowledge retrieval.
 *
 * Searches compiled wiki pages (KnowledgeNode) for context relevant to a query.
 * Returns curated, synthesized pages instead of raw document chunks.
 * Falls back gracefully when no wiki pages exist.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { WIKI_ENTITY_TYPES, WIKI_TYPE_LABELS, type WikiEntityType } from './types';

/* ─── Types ───────────────────────────────────────────── */

export interface WikiPage {
    id: string;
    type: WikiEntityType;
    title: string;
    content: Record<string, unknown>;
    summary: string | null;
    confidenceScore: number;
}

export interface WikiRetrievalResult {
    pages: WikiPage[];
    formattedContext: string;
    coverageLevel: 'full' | 'partial' | 'none';
}

/* ─── Main Retrieval Function ─────────────────────────── */

/**
 * Retrieve wiki pages relevant to a query.
 * Uses keyword matching on title and summary fields.
 */
export async function retrieveWikiContext(
    companyId: string,
    query: string,
    options?: {
        maxPages?: number;
        entityTypes?: WikiEntityType[];
        minConfidence?: number;
        projectId?: string | null;
    },
): Promise<WikiRetrievalResult> {
    const maxPages = options?.maxPages || 8;
    const minConfidence = options?.minConfidence || 0.3;
    const db = createAdminClient();

    try {
        // Build base query — exclude system types (wiki_index, wiki_log)
        let dbQuery = db
            .from('KnowledgeNode')
            .select('id, type, title, content, summary, confidenceScore')
            .eq('companyId', companyId)
            .eq('status', 'active')
            .gte('confidenceScore', minConfidence)
            .not('type', 'in', '("wiki_index","wiki_log")')
            .order('confidenceScore', { ascending: false });

        // Filter by entity types if specified
        if (options?.entityTypes && options.entityTypes.length > 0) {
            dbQuery = dbQuery.in('type', options.entityTypes);
        }

        // Project scope
        if (options?.projectId) {
            dbQuery = dbQuery.eq('projectId', options.projectId);
        }

        // Fetch all candidate nodes (we'll rank them client-side)
        const { data: candidates } = await dbQuery.limit(100);

        if (!candidates || candidates.length === 0) {
            return { pages: [], formattedContext: '', coverageLevel: 'none' };
        }

        // Rank by relevance to query
        const queryTerms = extractQueryTerms(query);
        const scored = candidates.map(node => ({
            ...node,
            relevanceScore: computeRelevance(node, queryTerms),
        }));

        // Sort by relevance, then confidence
        scored.sort((a, b) => {
            const relDiff = b.relevanceScore - a.relevanceScore;
            if (Math.abs(relDiff) > 0.1) return relDiff;
            return b.confidenceScore - a.confidenceScore;
        });

        // Take top N
        const topPages = scored.slice(0, maxPages) as WikiPage[];

        // Determine coverage level
        const coverageLevel: WikiRetrievalResult['coverageLevel'] =
            topPages.length >= 3 ? 'full' :
            topPages.length >= 1 ? 'partial' :
            'none';

        return {
            pages: topPages,
            formattedContext: formatWikiContext(topPages),
            coverageLevel,
        };
    } catch (err) {
        console.error('[wiki/retriever] Retrieval failed:', err);
        return { pages: [], formattedContext: '', coverageLevel: 'none' };
    }
}

/* ─── Formatting ──────────────────────────────────────── */

/**
 * Format wiki pages into a structured context block for AI prompts.
 */
export function formatWikiContext(pages: WikiPage[]): string {
    if (pages.length === 0) return '';

    const sections = pages.map(page => {
        const typeLabel = WIKI_TYPE_LABELS[page.type] || page.type;
        const contentStr = formatContent(page.content);
        const confidence = Math.round(page.confidenceScore * 100);

        return `[${typeLabel}: ${page.title}] (confidence: ${confidence}%)\n${contentStr}`;
    }).join('\n\n');

    return `\n\n=== COMPANY WIKI (compiled knowledge) ===\n${sections}\n=== END COMPANY WIKI ===`;
}

/* ─── Relevance Scoring ───────────────────────────────── */

function extractQueryTerms(query: string): string[] {
    // Remove common stop words and extract meaningful terms
    const stopWords = new Set([
        'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been',
        'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
        'could', 'should', 'may', 'might', 'can', 'shall', 'must',
        'of', 'in', 'to', 'for', 'with', 'on', 'at', 'by', 'from',
        'about', 'as', 'into', 'through', 'during', 'before', 'after',
        'and', 'or', 'but', 'not', 'no', 'if', 'then', 'than',
        'this', 'that', 'these', 'those', 'it',
        'what', 'which', 'who', 'how', 'when', 'where', 'why',
        'me', 'my', 'our', 'your', 'we', 'you', 'they',
        'write', 'create', 'generate', 'make', 'give', 'show', 'tell',
    ]);

    return query
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .split(/\s+/)
        .filter(term => term.length > 2 && !stopWords.has(term));
}

function computeRelevance(
    node: { title: string; summary: string | null; content: Record<string, unknown>; type: string },
    queryTerms: string[],
): number {
    if (queryTerms.length === 0) return 0.5; // No query terms = return all with equal weight

    const titleLower = node.title.toLowerCase();
    const summaryLower = (node.summary || '').toLowerCase();
    const contentStr = JSON.stringify(node.content).toLowerCase();

    let score = 0;
    let matches = 0;

    for (const term of queryTerms) {
        // Title match (highest weight)
        if (titleLower.includes(term)) {
            score += 3;
            matches++;
        }
        // Summary match
        else if (summaryLower.includes(term)) {
            score += 2;
            matches++;
        }
        // Content match
        else if (contentStr.includes(term)) {
            score += 1;
            matches++;
        }
    }

    // Normalize by number of query terms
    const coverageRatio = matches / queryTerms.length;
    return (score / (queryTerms.length * 3)) * 0.7 + coverageRatio * 0.3;
}

/* ─── Content Formatting ──────────────────────────────── */

function formatContent(content: Record<string, unknown>): string {
    return Object.entries(content)
        .filter(([, v]) => v !== null && v !== undefined && v !== '')
        .map(([key, value]) => {
            const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
            if (Array.isArray(value)) return `  ${label}: ${value.join(', ')}`;
            if (typeof value === 'object') return `  ${label}: ${JSON.stringify(value)}`;
            return `  ${label}: ${String(value)}`;
        })
        .join('\n');
}
