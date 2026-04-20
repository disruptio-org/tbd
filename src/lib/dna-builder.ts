/**
 * DNA Builder — Merge, upsert, and coverage scoring for Company DNA
 *
 * Handles intelligent deduplication: fuzzy-matches extracted entities
 * against existing KnowledgeNodes to prevent duplicates and merge
 * information from multiple source documents.
 */

import { createAdminClient } from '@/lib/supabase/admin';

/* ─── Types ───────────────────────────────────────────── */

export interface UpsertInput {
    type: string;
    title: string;
    content: Record<string, unknown>;
    confidence: number;
    sourceDocumentId: string;
    projectId?: string | null;
    customerId?: string | null;
}

export interface UpsertResult {
    nodeId: string;
    action: 'created' | 'updated' | 'skipped';
}

/* ─── Coverage Weights (13-type wiki taxonomy) ────────── */

const COVERAGE_WEIGHTS: Record<string, number> = {
    product: 0.15,
    persona: 0.10,
    messaging: 0.10,
    case_study: 0.10,
    market: 0.08,
    process: 0.08,
    competitor: 0.07,
    pricing: 0.07,
    content_strategy: 0.05,
    methodology: 0.05,
    metric: 0.05,
    integration: 0.05,
    policy: 0.05,
};

const EXPECTED_NODE_COUNTS: Record<string, number> = {
    product: 3,
    persona: 3,
    messaging: 2,
    case_study: 3,
    market: 2,
    process: 4,
    competitor: 3,
    pricing: 2,
    content_strategy: 1,
    methodology: 2,
    metric: 3,
    integration: 2,
    policy: 3,
};

/* ─── Default Resources (6 groups) ────────────────────── */

export const DEFAULT_RESOURCES = [
    {
        name: 'Brand & Positioning',
        description: 'Company identity, messaging, content pillars, and market positioning',
        icon: 'sparkles',
        nodeTypes: ['messaging', 'content_strategy'],
    },
    {
        name: 'Sales Intelligence',
        description: 'Customer profiles, competitors, case studies, and pricing',
        icon: 'target',
        nodeTypes: ['persona', 'competitor', 'case_study', 'pricing'],
    },
    {
        name: 'Market & Industry',
        description: 'Market segments, industry trends, competitive landscape, and benchmarks',
        icon: 'globe',
        nodeTypes: ['market', 'competitor', 'metric'],
    },
    {
        name: 'Product Knowledge',
        description: 'Product details, features, methodologies, and integrations',
        icon: 'cpu',
        nodeTypes: ['product', 'methodology', 'integration'],
    },
    {
        name: 'Company Operations',
        description: 'Internal policies, workflows, and operational procedures',
        icon: 'building',
        nodeTypes: ['policy', 'process'],
    },
    {
        name: 'Performance & Strategy',
        description: 'KPIs, metrics, case study outcomes, and pricing models',
        icon: 'chart-bar',
        nodeTypes: ['metric', 'case_study', 'pricing'],
    },
];

/* ─── Ensure DNA Record ───────────────────────────────── */

export async function ensureCompanyDNA(companyId: string): Promise<{ id: string }> {
    const db = createAdminClient();

    const { data: existing } = await db
        .from('CompanyDNA')
        .select('id')
        .eq('companyId', companyId)
        .single();

    if (existing) return existing;

    const { data: created, error } = await db
        .from('CompanyDNA')
        .insert({
            id: crypto.randomUUID(),
            companyId,
            version: 1,
            coverageScore: 0,
            updatedAt: new Date().toISOString(),
        })
        .select('id')
        .single();

    if (error) throw new Error(`Failed to create CompanyDNA: ${error.message}`);

    // Seed default resources
    await seedDefaultResources(companyId);

    return created!;
}

/* ─── Seed Default Resources ──────────────────────────── */

export async function seedDefaultResources(companyId: string): Promise<void> {
    const db = createAdminClient();

    const { data: existing } = await db
        .from('Resource')
        .select('id')
        .eq('companyId', companyId)
        .limit(1);

    if (existing && existing.length > 0) return; // Already seeded

    for (const res of DEFAULT_RESOURCES) {
        await db.from('Resource').insert({
            id: crypto.randomUUID(),
            companyId,
            name: res.name,
            description: res.description,
            icon: res.icon,
            nodeTypes: res.nodeTypes,
            isDefault: true,
            updatedAt: new Date().toISOString(),
        });
    }

    console.log(`[dna-builder] Seeded ${DEFAULT_RESOURCES.length} default resources for ${companyId}`);
}

/* ─── Upsert Node (with fuzzy dedup) ──────────────────── */

export async function upsertNode(
    companyId: string,
    dnaId: string,
    input: UpsertInput,
): Promise<UpsertResult> {
    const db = createAdminClient();

    // Search for existing nodes of the same type within same scope
    let candidateQuery = db
        .from('KnowledgeNode')
        .select('id, title, content, confidenceScore, sourceDocumentIds')
        .eq('companyId', companyId)
        .eq('dnaId', dnaId)
        .eq('type', input.type)
        .eq('status', 'active');

    // Scope dedup to same project/customer context
    if (input.projectId) candidateQuery = candidateQuery.eq('projectId', input.projectId);
    else candidateQuery = candidateQuery.is('projectId', null);
    if (input.customerId) candidateQuery = candidateQuery.eq('customerId', input.customerId);
    else candidateQuery = candidateQuery.is('customerId', null);

    const { data: candidates } = await candidateQuery;

    // Check for duplicate by title similarity
    const match = (candidates || []).find(c => isSimilarTitle(c.title, input.title));

    if (match) {
        // Merge content: keep existing values, add new non-empty fields
        const existingContent = (typeof match.content === 'object' && match.content !== null)
            ? match.content as Record<string, unknown>
            : {};
        const mergedContent = mergeContent(existingContent, input.content);

        // Append source document if not already tracked
        const sourceIds = Array.isArray(match.sourceDocumentIds) ? [...match.sourceDocumentIds] : [];
        if (!sourceIds.includes(input.sourceDocumentId)) {
            sourceIds.push(input.sourceDocumentId);
        }

        // Recalculate confidence (higher with more sources)
        const sourceBoost = Math.min(sourceIds.length * 0.05, 0.2);
        const newConfidence = Math.min(
            Math.max(match.confidenceScore, input.confidence) + sourceBoost,
            1.0,
        );

        await db
            .from('KnowledgeNode')
            .update({
                content: mergedContent,
                confidenceScore: newConfidence,
                sourceDocumentIds: sourceIds,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', match.id);

        return { nodeId: match.id, action: 'updated' };
    }

    // Create new node
    const nodeId = crypto.randomUUID();
    const { error } = await db.from('KnowledgeNode').insert({
        id: nodeId,
        companyId,
        dnaId,
        projectId: input.projectId || null,
        customerId: input.customerId || null,
        type: input.type,
        title: input.title,
        content: input.content,
        summary: generateSummary(input.type, input.title, input.content),
        confidenceScore: input.confidence,
        sourceDocumentIds: [input.sourceDocumentId],
        status: 'active',
        updatedAt: new Date().toISOString(),
    });

    if (error) {
        console.error(`[dna-builder] Failed to create node: ${error.message}`);
        return { nodeId: '', action: 'skipped' };
    }

    return { nodeId, action: 'created' };
}

/* ─── Upsert Edge ─────────────────────────────────────── */

export async function upsertEdge(
    fromNodeId: string,
    toNodeId: string,
    relationType: string,
): Promise<void> {
    const db = createAdminClient();

    const { data: existing } = await db
        .from('KnowledgeEdge')
        .select('id, strength')
        .eq('fromNodeId', fromNodeId)
        .eq('toNodeId', toNodeId)
        .eq('relationType', relationType)
        .maybeSingle();

    if (existing) {
        // Strengthen existing edge
        await db
            .from('KnowledgeEdge')
            .update({ strength: Math.min(existing.strength + 0.1, 1.0) })
            .eq('id', existing.id);
        return;
    }

    await db.from('KnowledgeEdge').insert({
        id: crypto.randomUUID(),
        fromNodeId,
        toNodeId,
        relationType,
        strength: 0.5,
    });
}

/* ─── Recalculate Coverage Score ──────────────────────── */

export async function recalculateCoverageScore(
    dnaId: string,
    companyId: string,
): Promise<number> {
    const db = createAdminClient();

    const { data: nodes } = await db
        .from('KnowledgeNode')
        .select('type')
        .eq('dnaId', dnaId)
        .eq('status', 'active');

    if (!nodes || nodes.length === 0) return 0;

    // Count nodes per type
    const counts: Record<string, number> = {};
    for (const node of nodes) {
        counts[node.type] = (counts[node.type] || 0) + 1;
    }

    // Weighted coverage
    let score = 0;
    for (const [type, weight] of Object.entries(COVERAGE_WEIGHTS)) {
        const count = counts[type] || 0;
        const expected = EXPECTED_NODE_COUNTS[type] || 3;
        score += weight * Math.min(count / expected, 1.0);
    }

    // Update DNA record
    await db
        .from('CompanyDNA')
        .update({
            coverageScore: Math.round(score * 100) / 100,
            lastProcessedAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        })
        .eq('id', dnaId);

    return Math.round(score * 100) / 100;
}

/* ─── Helper: Title Similarity ────────────────────────── */

function isSimilarTitle(existing: string, incoming: string): boolean {
    const a = normalize(existing);
    const b = normalize(incoming);

    // Exact match after normalization
    if (a === b) return true;

    // One contains the other
    if (a.includes(b) || b.includes(a)) return true;

    // Levenshtein distance for short titles
    if (a.length < 40 && b.length < 40) {
        const dist = levenshtein(a, b);
        const maxLen = Math.max(a.length, b.length);
        return dist / maxLen < 0.3; // < 30% different
    }

    return false;
}

function normalize(s: string): string {
    return s.toLowerCase().trim().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ');
}

function levenshtein(a: string, b: string): number {
    const m = a.length, n = b.length;
    const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));
    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;
    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }
    return dp[m][n];
}

/* ─── Helper: Merge Content ───────────────────────────── */

function mergeContent(
    existing: Record<string, unknown>,
    incoming: Record<string, unknown>,
): Record<string, unknown> {
    const merged = { ...existing };

    for (const [key, value] of Object.entries(incoming)) {
        if (value === null || value === undefined || value === '') continue;

        const existingVal = merged[key];
        if (!existingVal) {
            merged[key] = value;
        } else if (Array.isArray(existingVal) && Array.isArray(value)) {
            // Merge arrays (deduplicate)
            const combined = [...existingVal, ...value];
            merged[key] = [...new Set(combined.map(v => typeof v === 'string' ? v : JSON.stringify(v)))];
        }
        // If both are non-empty strings, keep existing (first source wins)
    }

    return merged;
}

/* ─── Helper: Generate Summary ────────────────────────── */

function generateSummary(
    type: string,
    title: string,
    content: Record<string, unknown>,
): string {
    const lines = [`**${title}** (${type})`];

    for (const [key, value] of Object.entries(content)) {
        if (!value) continue;
        const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
        if (Array.isArray(value)) {
            lines.push(`- **${label}**: ${value.join(', ')}`);
        } else {
            lines.push(`- **${label}**: ${String(value)}`);
        }
    }

    return lines.join('\n');
}
