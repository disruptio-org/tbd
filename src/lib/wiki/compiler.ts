/**
 * Wiki Compiler — LLM-powered knowledge extraction and compilation.
 *
 * Takes raw document text and extracts structured entities into wiki pages
 * (stored as KnowledgeNode rows). Uses existing upsertNode() for fuzzy dedup.
 *
 * Flow: document text → LLM extraction → upsertNode per entity → upsertEdge per relationship
 */

import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/admin';
import { upsertNode, upsertEdge, ensureCompanyDNA, recalculateCoverageScore } from '@/lib/dna-builder';
import { updateWikiIndex } from './index-manager';
import { appendWikiLog } from './log';
import {
    WIKI_ENTITY_TYPES,
    WIKI_TYPE_DESCRIPTIONS,
    type WikiEntityType,
    type ExtractedEntity,
    type ExtractedRelationship,
    type CompileResult,
} from './types';

const MODEL = 'gpt-5.4-mini';

/* ─── Extraction Prompt ───────────────────────────────── */

function buildExtractionPrompt(): string {
    const typeList = WIKI_ENTITY_TYPES.map(t =>
        `- **${t}**: ${WIKI_TYPE_DESCRIPTIONS[t]}`
    ).join('\n');

    return `You are a knowledge extraction engine. Read the provided document text and extract ALL business knowledge into structured entities.

ENTITY TYPES:
${typeList}

RULES:
1. Extract every distinct entity you find — be thorough.
2. Assign the most appropriate type from the list above.
3. For each entity, provide a clear title and structured content fields.
4. Content fields should be relevant key-value pairs (e.g., for a product: name, description, features, pricing; for a persona: name, role, painPoints, goals).
5. Assign a confidence score (0.0-1.0) based on how clearly the document describes this entity.
6. Also extract relationships between entities (e.g., "Product X serves Persona Y", "Competitor Z competes with Product X").
7. Do NOT invent information not present in the document.
8. Extract in the language of the document.

Respond with JSON matching the schema exactly.`;
}

/* ─── Main Compile Function ───────────────────────────── */

export async function compileToWiki(
    companyId: string,
    documentId: string,
    text: string,
    options?: {
        documentName?: string;
        projectId?: string | null;
        customerId?: string | null;
    },
): Promise<CompileResult> {
    const startTime = Date.now();
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        console.warn('[wiki/compiler] OPENAI_API_KEY not set, skipping compilation');
        return emptyResult(companyId, documentId, startTime);
    }

    // Skip very short texts
    if (!text || text.trim().length < 100) {
        console.log(`[wiki/compiler] Text too short to compile (${text?.length || 0} chars)`);
        return emptyResult(companyId, documentId, startTime);
    }

    const openai = new OpenAI({ apiKey });

    // Ensure DNA record exists
    const dna = await ensureCompanyDNA(companyId);

    // Truncate very long documents to avoid token limits
    const maxChars = 30000;
    const truncatedText = text.length > maxChars
        ? text.substring(0, maxChars) + '\n\n[... document truncated for processing ...]'
        : text;

    try {
        // Call LLM for extraction
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (openai as any).responses.create({
            model: MODEL,
            instructions: buildExtractionPrompt(),
            input: `DOCUMENT TEXT:\n\n${truncatedText}`,
            temperature: 0.2,
            text: {
                format: {
                    type: 'json_schema',
                    name: 'wiki_extraction',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: {
                            entities: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        type: { type: 'string' },
                                        title: { type: 'string' },
                                        content: { type: 'string' },
                                        confidence: { type: 'number' },
                                    },
                                    required: ['type', 'title', 'content', 'confidence'],
                                    additionalProperties: false,
                                },
                            },
                            relationships: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        fromTitle: { type: 'string' },
                                        toTitle: { type: 'string' },
                                        relationType: { type: 'string' },
                                    },
                                    required: ['fromTitle', 'toTitle', 'relationType'],
                                    additionalProperties: false,
                                },
                            },
                        },
                        required: ['entities', 'relationships'],
                        additionalProperties: false,
                    },
                },
            },
        });

        const raw = JSON.parse(response.output_text || '{"entities":[],"relationships":[]}');
        const entities: ExtractedEntity[] = (raw.entities || []).map((e: Record<string, unknown>) => ({
            type: validateEntityType(String(e.type)),
            title: String(e.title || ''),
            content: parseContent(e.content),
            confidence: Math.max(0, Math.min(1, Number(e.confidence) || 0.6)),
        })).filter((e: ExtractedEntity) => e.title.trim().length > 0);

        const relationships: ExtractedRelationship[] = (raw.relationships || []).map((r: Record<string, unknown>) => ({
            fromTitle: String(r.fromTitle || ''),
            toTitle: String(r.toTitle || ''),
            relationType: String(r.relationType || 'related_to'),
        })).filter((r: ExtractedRelationship) => r.fromTitle && r.toTitle);

        console.log(`[wiki/compiler] Extracted ${entities.length} entities, ${relationships.length} relationships from doc ${documentId}`);

        // Upsert entities
        let created = 0;
        let updated = 0;
        let skipped = 0;
        const titleToNodeId: Record<string, string> = {};

        for (const entity of entities) {
            try {
                const result = await upsertNode(companyId, dna.id, {
                    type: entity.type,
                    title: entity.title,
                    content: entity.content,
                    confidence: entity.confidence,
                    sourceDocumentId: documentId,
                    projectId: options?.projectId || null,
                    customerId: options?.customerId || null,
                });

                titleToNodeId[entity.title] = result.nodeId;

                if (result.action === 'created') created++;
                else if (result.action === 'updated') updated++;
                else skipped++;
            } catch (err) {
                console.error(`[wiki/compiler] Failed to upsert entity "${entity.title}":`, err);
                skipped++;
            }
        }

        // Upsert relationships
        let edgesCreated = 0;
        for (const rel of relationships) {
            const fromId = titleToNodeId[rel.fromTitle];
            const toId = titleToNodeId[rel.toTitle];
            if (fromId && toId && fromId !== toId) {
                try {
                    await upsertEdge(fromId, toId, rel.relationType);
                    edgesCreated++;
                } catch (err) {
                    console.error(`[wiki/compiler] Failed to create edge:`, err);
                }
            }
        }

        // Update wiki index and coverage
        await updateWikiIndex(companyId);
        await recalculateCoverageScore(dna.id, companyId);

        // Log the compilation
        await appendWikiLog(companyId, dna.id, {
            action: 'compile',
            sourceDocumentId: documentId,
            sourceDocumentName: options?.documentName,
            entitiesExtracted: entities.length,
            edgesCreated,
            details: `Created ${created}, updated ${updated}, skipped ${skipped}`,
            timestamp: new Date().toISOString(),
        });

        const result: CompileResult = {
            documentId,
            companyId,
            entitiesExtracted: entities.length,
            entitiesCreated: created,
            entitiesUpdated: updated,
            entitiesSkipped: skipped,
            edgesCreated,
            durationMs: Date.now() - startTime,
        };

        console.log(`[wiki/compiler] ✓ Compiled doc ${documentId}: ${created} created, ${updated} updated, ${edgesCreated} edges (${result.durationMs}ms)`);
        return result;
    } catch (err) {
        console.error(`[wiki/compiler] ✗ Compilation failed for doc ${documentId}:`, err);
        return emptyResult(companyId, documentId, startTime);
    }
}

/* ─── Helpers ─────────────────────────────────────────── */

function validateEntityType(type: string): WikiEntityType {
    const normalized = type.toLowerCase().trim().replace(/[\s-]+/g, '_');
    if (WIKI_ENTITY_TYPES.includes(normalized as WikiEntityType)) {
        return normalized as WikiEntityType;
    }
    // Map common LLM variations
    const mapping: Record<string, WikiEntityType> = {
        'case study': 'case_study',
        'casestudy': 'case_study',
        'customer': 'persona',
        'buyer': 'persona',
        'icp': 'persona',
        'brand': 'messaging',
        'branding': 'messaging',
        'voice': 'messaging',
        'price': 'pricing',
        'cost': 'pricing',
        'package': 'pricing',
        'tool': 'integration',
        'platform': 'integration',
        'software': 'integration',
        'framework': 'methodology',
        'playbook': 'methodology',
        'kpi': 'metric',
        'okr': 'metric',
        'target': 'metric',
        'benchmark': 'metric',
        'workflow': 'process',
        'sop': 'process',
        'rule': 'policy',
        'compliance': 'policy',
        'guideline': 'policy',
        'industry': 'market',
        'segment': 'market',
        'trend': 'market',
        'campaign': 'content_strategy',
        'editorial': 'content_strategy',
        'content': 'content_strategy',
        'service': 'product',
        'feature': 'product',
        'offering': 'product',
        'testimonial': 'case_study',
        'success_story': 'case_study',
        'roi': 'case_study',
    };
    return mapping[normalized] || 'product';
}

function parseContent(raw: unknown): Record<string, unknown> {
    if (typeof raw === 'object' && raw !== null && !Array.isArray(raw)) {
        return raw as Record<string, unknown>;
    }
    if (typeof raw === 'string') {
        try {
            const parsed = JSON.parse(raw);
            if (typeof parsed === 'object' && parsed !== null) return parsed;
        } catch { /* not JSON */ }
        return { description: raw };
    }
    return { value: String(raw) };
}

function emptyResult(companyId: string, documentId: string, startTime: number): CompileResult {
    return {
        documentId,
        companyId,
        entitiesExtracted: 0,
        entitiesCreated: 0,
        entitiesUpdated: 0,
        entitiesSkipped: 0,
        edgesCreated: 0,
        durationMs: Date.now() - startTime,
    };
}
