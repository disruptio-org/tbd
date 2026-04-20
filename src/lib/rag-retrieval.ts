/**
 * rag-retrieval.ts
 * Shared RAG (Retrieval-Augmented Generation) utility for Growth Assistants.
 *
 * Performs semantic search against the company's DocumentEmbedding table
 * and returns the most relevant knowledge chunks for a given query.
 */

import OpenAI from 'openai';
import { createAdminClient } from './supabase/admin';

const EMBEDDING_MODEL = 'text-embedding-3-small';

/* ─── Types ──────────────────────────────────────────── */

export interface RetrievedChunk {
    documentId: string;
    filename: string;
    chunkText: string;
    similarityScore: number;
    finalScore: number;
    knowledgeCategory?: string | null;
}

export interface RAGOptions {
    /** Maximum number of chunks to return (default 8) */
    maxChunks?: number;
    /** Minimum cosine similarity threshold (default 0.20) */
    minSimilarity?: number;
    /** Maximum chunks from a single document (default 3) */
    maxChunksPerDoc?: number;
}

/* ─── Cosine Similarity ──────────────────────────────── */

function cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dotProduct / denom;
}

/* ─── Main Retrieval Function ────────────────────────── */

/**
 * Retrieve the most relevant knowledge chunks from the company's
 * embedded document base using semantic similarity search.
 *
 * @param companyId  The company to search within
 * @param query      The user's input prompt / question
 * @param options    Optional configuration for retrieval behavior
 * @returns          Array of relevant text chunks, ranked by relevance
 */
export async function retrieveRelevantKnowledge(
    companyId: string,
    query: string,
    options: RAGOptions = {}
): Promise<RetrievedChunk[]> {
    const {
        maxChunks = 8,
        minSimilarity = 0.20,
        maxChunksPerDoc = 3,
    } = options;

    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.warn('[rag] OPENAI_API_KEY not configured, skipping RAG');
            return [];
        }

        const openai = new OpenAI({ apiKey });
        const db = createAdminClient();

        // Stage 1: Generate query embedding
        const embResponse = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: query,
        });
        const queryEmbedding = embResponse.data[0].embedding;

        // Stage 2: Fetch all company embeddings and score
        const { data: embeddings } = await db
            .from('DocumentEmbedding')
            .select('documentId, externalDocumentId, chunkText, embedding')
            .eq('companyId', companyId);

        if (!embeddings || embeddings.length === 0) return [];

        const candidates = embeddings.map(emb => {
            const embVector: number[] = JSON.parse(emb.embedding);
            return {
                documentId: emb.documentId as string,
                externalDocumentId: (emb.externalDocumentId || null) as string | null,
                chunkText: emb.chunkText as string,
                similarityScore: cosineSimilarity(queryEmbedding, embVector),
            };
        })
            .filter(c => c.similarityScore >= minSimilarity)
            .sort((a, b) => b.similarityScore - a.similarityScore)
            .slice(0, 20); // Top 20 candidates for enrichment

        if (candidates.length === 0) return [];

        // Stage 3: Metadata enrichment (both Document and ExternalDocument)
        const docIds = [...new Set(candidates.filter(c => !c.externalDocumentId).map(c => c.documentId))];
        const extDocIds = [...new Set(candidates.filter(c => c.externalDocumentId).map(c => c.externalDocumentId!))];

        const { data: docs } = docIds.length > 0
            ? await db.from('Document').select('id, filename, knowledgeCategory, useAsKnowledgeSource, knowledgePriority, updatedAt').in('id', docIds)
            : { data: [] };

        const { data: extDocs } = extDocIds.length > 0
            ? await db.from('ExternalDocument').select('id, filename, knowledgeCategory, useAsKnowledgeSource, knowledgePriority, updatedAt').in('id', extDocIds)
            : { data: [] };

        const docMap = new Map((docs || []).map(d => [d.id, d]));
        const extDocMap = new Map((extDocs || []).map(d => [d.id, d]));

        // Stage 4: Composite ranking
        const enriched: (RetrievedChunk & { _docMeta?: Record<string, unknown> })[] = candidates.map(c => {
            // Look up metadata from either Document or ExternalDocument
            const doc = c.externalDocumentId
                ? extDocMap.get(c.externalDocumentId)
                : docMap.get(c.documentId);

            let score = c.similarityScore;

            // Knowledge source boost: +0.15 if curated
            if (doc?.useAsKnowledgeSource) score += 0.15;

            // Priority boost
            if (doc?.knowledgePriority === 'critical') score += 0.10;
            else if (doc?.knowledgePriority === 'preferred') score += 0.05;

            // Recency boost: +0.03 if updated within 30 days
            if (doc?.updatedAt) {
                const daysSince = (Date.now() - new Date(doc.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
                if (daysSince <= 30) score += 0.03;
            }

            // Noise penalty for very short chunks
            if (c.chunkText.trim().length < 50) score -= 0.10;

            // Use a composite key for dedup — prefer externalDocumentId when present
            const sourceId = c.externalDocumentId || c.documentId;

            return {
                documentId: sourceId,
                filename: doc?.filename || 'Unknown',
                chunkText: c.chunkText,
                similarityScore: c.similarityScore,
                finalScore: score,
                knowledgeCategory: doc?.knowledgeCategory || null,
            };
        });

        enriched.sort((a, b) => b.finalScore - a.finalScore);

        // Stage 5: Dedup + diversity + cap
        const selected: RetrievedChunk[] = [];
        const docChunkCount = new Map<string, number>();

        for (const chunk of enriched) {
            if (selected.length >= maxChunks) break;

            // Cap per document
            const count = docChunkCount.get(chunk.documentId) || 0;
            if (count >= maxChunksPerDoc) continue;

            // Skip very short / noisy chunks
            if (chunk.chunkText.trim().length < 30) continue;

            // Skip near-duplicates (simple substring check)
            const isDuplicate = selected.some(s =>
                s.documentId === chunk.documentId &&
                s.chunkText.substring(0, 80) === chunk.chunkText.substring(0, 80)
            );
            if (isDuplicate) continue;

            selected.push(chunk);
            docChunkCount.set(chunk.documentId, count + 1);
        }

        console.log(`[rag] Retrieved ${selected.length} chunks for company ${companyId} (query: "${query.substring(0, 60)}...")`);
        return selected;
    } catch (err) {
        console.error('[rag] Retrieval failed:', err);
        return [];
    }
}

/* ─── Format Helper ──────────────────────────────────── */

/**
 * Formats retrieved chunks into a text block suitable for injection
 * into an AI system prompt.
 */
export function formatRAGContext(chunks: RetrievedChunk[]): string {
    if (chunks.length === 0) return '';

    const sourcesText = chunks
        .map((c, i) => `[Knowledge Source ${i + 1} — ${c.filename}${c.knowledgeCategory ? ` (${c.knowledgeCategory})` : ''}]\n${c.chunkText}`)
        .join('\n\n---\n\n');

    return `\n\n=== COMPANY KNOWLEDGE BASE (automatically retrieved relevant information) ===\n${sourcesText}\n=== END COMPANY KNOWLEDGE BASE ===`;
}

/* ─── DNA Context Retrieval ──────────────────────────── */

interface DNANode {
    type: string;
    title: string;
    content: Record<string, unknown>;
    confidenceScore: number;
}

/**
 * Retrieve structured Company DNA knowledge nodes for injection
 * into AI system prompts alongside RAG chunks.
 *
 * Supports 3-tier retrieval: Project → Customer → Company-wide.
 * When projectId is provided, nodes are gathered in priority order:
 *   1. Project-specific nodes
 *   2. Customer-level nodes (if project has a customer)
 *   3. Company-wide (global) nodes
 *
 * @param companyId  The company to retrieve DNA for
 * @param nodeTypes  Optional filter for specific node types
 * @param minConfidence  Minimum confidence threshold (default 0.4)
 * @param maxNodes  Maximum nodes to return (default 10)
 * @param projectId  Optional project for tiered retrieval
 */
export async function retrieveDNAContext(
    companyId: string,
    nodeTypes?: string[],
    minConfidence = 0.4,
    maxNodes = 10,
    projectId?: string | null,
): Promise<DNANode[]> {
    const supabase = createAdminClient();

    try {
        const allNodes: DNANode[] = [];

        // Helper to query nodes with optional scope
        const fetchNodes = async (
            scopeProjectId: string | null,
            scopeCustomerId: string | null,
            companyOnly: boolean,
            limit: number,
        ): Promise<DNANode[]> => {
            let query = supabase
                .from('KnowledgeNode')
                .select('type, title, content, confidenceScore')
                .eq('companyId', companyId)
                .eq('status', 'active')
                .gte('confidenceScore', minConfidence)
                .order('confidenceScore', { ascending: false })
                .limit(limit);

            if (nodeTypes && nodeTypes.length > 0) {
                query = query.in('type', nodeTypes);
            }

            if (scopeProjectId) {
                query = query.eq('projectId', scopeProjectId);
            } else if (scopeCustomerId) {
                query = query.eq('customerId', scopeCustomerId).is('projectId', null);
            } else if (companyOnly) {
                query = query.is('projectId', null).is('customerId', null);
            }

            const { data } = await query;
            return (data || []) as DNANode[];
        };

        if (projectId) {
            // Tier 1: Project-specific nodes
            const projectNodes = await fetchNodes(projectId, null, false, maxNodes);
            allNodes.push(...projectNodes);

            // Tier 2: Customer-level nodes (if project has a customer)
            if (allNodes.length < maxNodes) {
                const { data: project } = await supabase
                    .from('Project')
                    .select('customerId')
                    .eq('id', projectId)
                    .maybeSingle();

                if (project?.customerId) {
                    const customerNodes = await fetchNodes(null, project.customerId, false, maxNodes - allNodes.length);
                    allNodes.push(...customerNodes);
                }
            }

            // Tier 3: Company-wide nodes (fill remaining slots)
            if (allNodes.length < maxNodes) {
                const companyNodes = await fetchNodes(null, null, true, maxNodes - allNodes.length);
                allNodes.push(...companyNodes);
            }
        } else {
            // No project context — return all company DNA (existing behavior)
            const nodes = await fetchNodes(null, null, false, maxNodes);
            allNodes.push(...nodes);
        }

        console.log(`[rag] Retrieved ${allNodes.length} DNA nodes for company ${companyId}${projectId ? ` (project: ${projectId})` : ''}`);
        return allNodes;
    } catch (err) {
        console.error('[rag] DNA retrieval failed:', err);
        return [];
    }
}

/**
 * Formats DNA nodes into a structured context block for injection
 * into AI system prompts. Injected BEFORE RAG context (higher priority).
 */
export function formatDNAContext(nodes: DNANode[]): string {
    if (nodes.length === 0) return '';

    const sections = nodes.map(node => {
        const fields = Object.entries(node.content as Record<string, unknown>)
            .filter(([, v]) => v !== null && v !== undefined && v !== '')
            .map(([key, value]) => {
                const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
                if (Array.isArray(value)) return `  ${label}: ${value.join(', ')}`;
                return `  ${label}: ${String(value)}`;
            })
            .join('\n');

        return `[${node.type.toUpperCase()}: ${node.title}] (confidence: ${Math.round(node.confidenceScore * 100)}%)\n${fields}`;
    }).join('\n\n');

    return `\n\n=== COMPANY INTELLIGENCE (structured knowledge from Company DNA) ===\n${sections}\n=== END COMPANY INTELLIGENCE ===`;
}

/* ─── Wiki-First + RAG Fallback Retrieval ─────────────── */

/**
 * Unified retrieval: tries wiki pages first, supplements with RAG chunks if needed.
 * Returns a combined formatted context string and grounding level.
 *
 * This is the recommended function for all adapters and consumers.
 */
export async function retrieveWikiAndRAGContext(
    companyId: string,
    query: string,
    options?: {
        maxWikiPages?: number;
        maxRagChunks?: number;
        projectId?: string | null;
    },
): Promise<{ context: string; groundingLevel: 'VERIFIED' | 'PARTIAL' | 'NOT_FOUND' }> {
    const contextParts: string[] = [];
    let groundingLevel: 'VERIFIED' | 'PARTIAL' | 'NOT_FOUND' = 'NOT_FOUND';

    // 1. Try wiki retrieval first
    try {
        const { retrieveWikiContext } = await import('@/lib/wiki/retriever');
        const wikiResult = await retrieveWikiContext(companyId, query, {
            maxPages: options?.maxWikiPages || 6,
            projectId: options?.projectId,
        });

        if (wikiResult.formattedContext) {
            contextParts.push(wikiResult.formattedContext);
            if (wikiResult.coverageLevel === 'full') {
                groundingLevel = 'VERIFIED';
            } else if (wikiResult.coverageLevel === 'partial') {
                groundingLevel = 'PARTIAL';
            }
        }
    } catch (err) {
        console.error('[rag] Wiki retrieval failed, falling back to RAG:', err);
    }

    // 2. Supplement with raw RAG if wiki coverage is insufficient
    if (groundingLevel !== 'VERIFIED') {
        try {
            const ragChunks = await retrieveRelevantKnowledge(companyId, query, {
                maxChunks: options?.maxRagChunks || 6,
            });

            if (ragChunks.length > 0) {
                contextParts.push(formatRAGContext(ragChunks));
                if (groundingLevel === 'NOT_FOUND') {
                    groundingLevel = ragChunks.length >= 3 ? 'VERIFIED' : 'PARTIAL';
                } else {
                    groundingLevel = 'VERIFIED'; // wiki partial + RAG = verified
                }
            }
        } catch (err) {
            console.error('[rag] RAG fallback failed:', err);
        }
    }

    return {
        context: contextParts.join('\n'),
        groundingLevel,
    };
}
