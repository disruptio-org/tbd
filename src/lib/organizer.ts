/**
 * Organizer Agent — GPT-powered entity extraction engine
 *
 * Processes documents through a 3-step prompt chain:
 *   1. CLASSIFY — determine document domain & type (gpt-4o-mini)
 *   2. EXTRACT — pull structured entities & relationships (gpt-4o)
 *   3. MERGE — upsert into Company DNA via dna-builder
 */

import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/admin';
import {
    ensureCompanyDNA,
    upsertNode,
    upsertEdge,
    recalculateCoverageScore,
} from '@/lib/dna-builder';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

/* ─── Node Type Schemas ───────────────────────────────── */

export const NODE_TYPE_SCHEMAS: Record<string, { fields: string[] }> = {
    product: { fields: ['name', 'description', 'features', 'pricing', 'differentiators'] },
    persona: { fields: ['title', 'companySize', 'industry', 'painPoints', 'goals', 'budget'] },
    process: { fields: ['name', 'steps', 'owner', 'frequency', 'tools'] },
    competitor: { fields: ['name', 'strengths', 'weaknesses', 'positioning', 'pricing'] },
    messaging: { fields: ['tone', 'valueProps', 'taglines', 'keyMessages', 'channels'] },
    policy: { fields: ['name', 'rules', 'scope', 'exceptions', 'owner'] },
};

export const NODE_TYPES = Object.keys(NODE_TYPE_SCHEMAS);

/* ─── Types ───────────────────────────────────────────── */

export interface Classification {
    domain: string;
    documentType: string;
    relevance: number; // 0-1
    suggestedNodeTypes: string[];
}

export interface ExtractedEntity {
    type: string;
    title: string;
    content: Record<string, unknown>;
    confidence: number;
}

export interface ExtractedRelationship {
    fromTitle: string;
    toTitle: string;
    relationType: string;
}

export interface ExtractionResult {
    entities: ExtractedEntity[];
    relationships: ExtractedRelationship[];
}

export interface ProcessingResult {
    documentId: string;
    classification: Classification;
    entitiesCreated: number;
    entitiesUpdated: number;
    relationshipsCreated: number;
    coverageScore: number;
}

/* ─── Step 1: Classify ────────────────────────────────── */

export async function classifyDocument(text: string): Promise<Classification> {
    const truncated = text.slice(0, 8000); // ~2000 tokens

    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: `You are a document classifier for a business intelligence system.
Analyze the document and return a JSON object with:
- "domain": one of "sales", "marketing", "product", "operations", "hr", "finance", "strategy", "general"
- "documentType": e.g. "playbook", "policy", "research", "guide", "proposal", "report", "profile", "other"
- "relevance": 0.0 to 1.0 — how useful is this for building company intelligence
- "suggestedNodeTypes": array from ${JSON.stringify(NODE_TYPES)} — which entity types could be extracted

Return ONLY the JSON object.`,
            },
            { role: 'user', content: truncated },
        ],
    });

    try {
        return JSON.parse(response.choices[0]?.message?.content || '{}') as Classification;
    } catch {
        return { domain: 'general', documentType: 'other', relevance: 0.3, suggestedNodeTypes: [] };
    }
}

/* ─── Step 2: Extract ─────────────────────────────────── */

export async function extractEntities(
    text: string,
    classification: Classification,
): Promise<ExtractionResult> {
    const truncated = text.slice(0, 24000); // ~6000 tokens
    const targetTypes = classification.suggestedNodeTypes.length > 0
        ? classification.suggestedNodeTypes
        : NODE_TYPES;

    const schemaDescription = targetTypes
        .map(t => `"${t}": fields ${JSON.stringify(NODE_TYPE_SCHEMAS[t]?.fields || [])}`)
        .join('\n');

    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: `You are an entity extraction engine for a business intelligence system.
Extract structured knowledge from the document.

TARGET ENTITY TYPES AND THEIR FIELDS:
${schemaDescription}

Return a JSON object with:
{
  "entities": [
    {
      "type": "<one of the target types>",
      "title": "<short descriptive title for the entity>",
      "content": { <field>: <value>, ... },
      "confidence": 0.0 to 1.0
    }
  ],
  "relationships": [
    {
      "fromTitle": "<entity title>",
      "toTitle": "<entity title>",
      "relationType": "<targets|belongs_to|competes_with|requires|informs>"
    }
  ]
}

RULES:
- Only extract entities that are clearly present in the document — do NOT invent information
- Use specific, descriptive titles (e.g. "Mid-Market SaaS CTOs" not just "Target persona")
- Content values can be strings, arrays of strings, or numbers
- Confidence reflects how clearly the information is stated in the document
- Skip vague or generic information
- Extract ALL relevant entities, even if there are many`,
            },
            {
                role: 'user',
                content: `Document domain: ${classification.domain}\nDocument type: ${classification.documentType}\n\n---\n\n${truncated}`,
            },
        ],
    });

    try {
        const result = JSON.parse(response.choices[0]?.message?.content || '{}');
        return {
            entities: Array.isArray(result.entities) ? result.entities : [],
            relationships: Array.isArray(result.relationships) ? result.relationships : [],
        };
    } catch {
        return { entities: [], relationships: [] };
    }
}

/* ─── Step 3: Process Document ────────────────────────── */

export async function processDocumentForDNA(
    companyId: string,
    documentId: string,
    text: string,
    options?: { projectId?: string | null; customerId?: string | null },
): Promise<ProcessingResult> {
    // 1. Classify
    const classification = await classifyDocument(text);
    console.log(`[organizer] Classified ${documentId}: domain=${classification.domain}, relevance=${classification.relevance}`);

    if (classification.relevance < 0.2) {
        console.log(`[organizer] Skipping ${documentId} — low relevance (${classification.relevance})`);
        return {
            documentId,
            classification,
            entitiesCreated: 0,
            entitiesUpdated: 0,
            relationshipsCreated: 0,
            coverageScore: 0,
        };
    }

    // 2. Extract entities
    const extraction = await extractEntities(text, classification);
    console.log(`[organizer] Extracted ${extraction.entities.length} entities, ${extraction.relationships.length} relationships`);

    // 3. Merge into DNA
    const dna = await ensureCompanyDNA(companyId);
    let entitiesCreated = 0;
    let entitiesUpdated = 0;
    let relationshipsCreated = 0;

    // Map entity titles to node IDs for relationship resolution
    const titleToNodeId: Record<string, string> = {};

    for (const entity of extraction.entities) {
        // Validate entity type
        if (!NODE_TYPES.includes(entity.type)) continue;

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
        if (result.action === 'created') entitiesCreated++;
        else entitiesUpdated++;
    }

    // 4. Create relationships
    for (const rel of extraction.relationships) {
        const fromId = titleToNodeId[rel.fromTitle];
        const toId = titleToNodeId[rel.toTitle];
        if (fromId && toId && fromId !== toId) {
            await upsertEdge(fromId, toId, rel.relationType);
            relationshipsCreated++;
        }
    }

    // 5. Recalculate coverage
    const coverageScore = await recalculateCoverageScore(dna.id, companyId);

    return {
        documentId,
        classification,
        entitiesCreated,
        entitiesUpdated,
        relationshipsCreated,
        coverageScore,
    };
}

/* ─── Bulk Process All Documents ──────────────────────── */

export async function processAllDocuments(
    companyId: string,
    onProgress?: (event: { step: string; document: string; detail?: string }) => void,
    scopeOptions?: { customerId?: string; projectId?: string },
): Promise<{
    totalProcessed: number;
    totalEntities: number;
    totalRelationships: number;
    coverageScore: number;
}> {
    const db = createAdminClient();

    // Determine which projectIds to scope to based on customer/project filter
    let scopeProjectIds: string[] | null = null;
    if (scopeOptions?.projectId) {
        scopeProjectIds = [scopeOptions.projectId];
    } else if (scopeOptions?.customerId) {
        const { data: projects } = await db
            .from('Project')
            .select('id')
            .eq('customerId', scopeOptions.customerId);
        scopeProjectIds = (projects || []).map((p: { id: string }) => p.id);
    }

    // Gather all documents with text
    let uploadQuery = db
        .from('Document')
        .select('id, filename, extractedText, projectId')
        .eq('companyId', companyId)
        .not('extractedText', 'is', null)
        .neq('filename', '__external_sentinel__');

    // Apply scope filter if provided
    if (scopeProjectIds !== null) {
        uploadQuery = uploadQuery.in('projectId', scopeProjectIds);
    }

    const { data: uploads } = await uploadQuery;

    // Only include external docs when processing company-wide (no scope)
    let externals: { id: string; filename: string; extractedText: string }[] | null = null;
    if (!scopeProjectIds) {
        const { data } = await db
            .from('ExternalDocument')
            .select('id, filename, extractedText')
            .eq('companyId', companyId)
            .not('extractedText', 'is', null);
        externals = data;
    }

    const allDocs = [
        ...(uploads || []).map(d => ({
            id: d.id,
            filename: d.filename,
            text: d.extractedText as string,
        })),
        ...(externals || []).map(d => ({
            id: `ext-${d.id}`,
            filename: d.filename,
            text: d.extractedText as string,
        })),
    ].filter(d => d.text && d.text.trim().length > 20);

    // Build a map of documentId -> projectId/customerId for project-aware tagging
    const docProjectMap: Record<string, { projectId: string | null; customerId: string | null }> = {};
    if (uploads) {
        for (const d of uploads) {
            const doc = d as Record<string, unknown>;
            if (doc.projectId) {
                // Look up project to get customerId
                const { data: proj } = await db
                    .from('Project')
                    .select('id, customerId')
                    .eq('id', doc.projectId as string)
                    .maybeSingle();
                docProjectMap[d.id] = {
                    projectId: (doc.projectId as string) || null,
                    customerId: proj?.customerId || null,
                };
            }
        }
    }

    let totalEntities = 0;
    let totalRelationships = 0;
    let coverageScore = 0;

    for (let i = 0; i < allDocs.length; i++) {
        const doc = allDocs[i];
        onProgress?.({ step: 'processing', document: doc.filename, detail: `${i + 1}/${allDocs.length}` });

        try {
            const scope = docProjectMap[doc.id] || { projectId: null, customerId: null };
            const result = await processDocumentForDNA(companyId, doc.id, doc.text, scope);
            totalEntities += result.entitiesCreated + result.entitiesUpdated;
            totalRelationships += result.relationshipsCreated;
            coverageScore = result.coverageScore;

            onProgress?.({
                step: 'completed',
                document: doc.filename,
                detail: `+${result.entitiesCreated} created, ${result.entitiesUpdated} updated`,
            });
        } catch (err) {
            console.error(`[organizer] Error processing ${doc.filename}:`, err);
            onProgress?.({ step: 'error', document: doc.filename, detail: String(err) });
        }
    }

    return {
        totalProcessed: allDocs.length,
        totalEntities,
        totalRelationships,
        coverageScore,
    };
}
