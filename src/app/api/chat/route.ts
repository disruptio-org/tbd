import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import { getAiLanguageName } from '@/i18n';
import { resolveEffectiveBrainConfig } from '@/lib/ai-brains/resolve-effective-brain';
import { buildBrainSystemPrompt, getBrainTemperature } from '@/lib/ai-brains/build-brain-prompt';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const CHAT_MODEL = 'gpt-5.4-mini';

export async function POST(request: Request) {
    try {
        // 1. Auth
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const db = createAdminClient();

        const { data: dbUser } = await db.from('User').select('id, companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { message, conversationId, assistantType = 'GENERAL', onboardingRole = 'general' } = await request.json();
        if (!message || !message.trim()) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const isCompanyKnowledge = assistantType === 'COMPANY_KNOWLEDGE';
        const isOnboarding = assistantType === 'ONBOARDING_ASSISTANT';

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
        }

        const openai = new OpenAI({ apiKey });

        // Fetch company language for AI response language
        const { data: companyData } = await db.from('Company').select('language').eq('id', dbUser.companyId).maybeSingle();
        const companyLang = (companyData?.language as 'en' | 'pt-PT' | 'fr') || 'en';
        const aiLanguageName = getAiLanguageName(companyLang);

        // ── Resolve AI Brain config (backward-compatible: defaults when no brain) ──
        const effectiveBrain = await resolveEffectiveBrainConfig(dbUser.companyId, assistantType);

        // 2. Retrieval + Context Building (mode-specific pipeline)
        let contextText: string;
        let responseSources: ResponseSource[];
        let groundingStatus: GroundingStatus;
        let companyProfile = '';
        let usedCompanyProfile = false;
        let queryIntent: CompanyQueryIntent = 'GENERAL';

        if (isCompanyKnowledge) {
            // === Company Knowledge Pipeline ===
            queryIntent = classifyCompanyQueryIntent(message);
            console.log(`[chat] Company Knowledge | Intent: ${queryIntent}`);

            // 4-stage retrieval
            const rankedChunks = await findRelevantCompanyKnowledge(db, openai, message, dbUser.companyId, queryIntent);
            console.log(`[chat] Company Knowledge | Ranked chunks: ${rankedChunks.length}, Top score: ${rankedChunks[0]?.finalScore?.toFixed(3) || 'N/A'}`);

            // Grounding + sources from ranked chunks
            groundingStatus = evaluateGroundingStatusFromRanked(rankedChunks);
            responseSources = buildResponseSourcesFromRanked(rankedChunks);

            // Fetch company profile — use CompanyProfile first, fall back to Company basics
            const { data: cpProfile } = await db
                .from('CompanyProfile')
                .select('*')
                .eq('companyId', dbUser.companyId)
                .maybeSingle();

            const { data: company } = await db
                .from('Company')
                .select('name, plan, email, website, webContext')
                .eq('id', dbUser.companyId)
                .maybeSingle();

            if (cpProfile) {
                // Rich structured profile
                const parts: string[] = ['COMPANY PROFILE'];
                if (cpProfile.companyName) parts.push(`Company Name: ${cpProfile.companyName}`);
                if (cpProfile.industry) parts.push(`Industry: ${cpProfile.industry}`);
                if (cpProfile.website) parts.push(`Website: ${cpProfile.website}`);
                if (cpProfile.foundedYear) parts.push(`Founded: ${cpProfile.foundedYear}`);
                if (cpProfile.description) parts.push(`\nDescription:\n${cpProfile.description}`);
                if (cpProfile.productsServices) parts.push(`\nProducts & Services:\n${cpProfile.productsServices}`);
                if (cpProfile.mainOfferings) parts.push(`\nMain Offerings:\n${cpProfile.mainOfferings}`);
                if (cpProfile.valueProposition) parts.push(`\nValue Proposition:\n${cpProfile.valueProposition}`);
                if (cpProfile.targetCustomers) parts.push(`\nTarget Customers:\n${cpProfile.targetCustomers}`);
                if (cpProfile.targetIndustries) parts.push(`\nTarget Industries:\n${cpProfile.targetIndustries}`);
                if (cpProfile.markets) parts.push(`\nMarkets:\n${cpProfile.markets}`);
                if (cpProfile.departments) parts.push(`\nDepartments:\n${cpProfile.departments}`);
                if (cpProfile.internalTools) parts.push(`\nInternal Tools:\n${cpProfile.internalTools}`);
                if (cpProfile.keyProcesses) parts.push(`\nKey Processes:\n${cpProfile.keyProcesses}`);
                if (cpProfile.competitors) parts.push(`\nCompetitors:\n${cpProfile.competitors}`);
                if (cpProfile.strategicGoals) parts.push(`\nStrategic Goals:\n${cpProfile.strategicGoals}`);
                if (cpProfile.brandTone) parts.push(`\nBrand Tone: ${cpProfile.brandTone}`);
                if (company?.webContext) parts.push(`\nWEB CONTEXT (extracted from website):\n${company.webContext}`);
                companyProfile = parts.join('\n');
                usedCompanyProfile = true;
            } else if (company) {
                // Fallback to basic Company data
                companyProfile = `COMPANY PROFILE:\nName: ${company.name}\nPlan: ${company.plan}${company.email ? `\nEmail: ${company.email}` : ''}${company.website ? `\nWebsite: ${company.website}` : ''}`;
                if (company.webContext) {
                    companyProfile += `\n\nWEB CONTEXT (extracted from company website):\n${company.webContext}`;
                }
                usedCompanyProfile = true;
            }

            const { data: features } = await db
                .from('CompanyFeature')
                .select('featureKey, enabled')
                .eq('companyId', dbUser.companyId)
                .eq('enabled', true);

            if (features && features.length > 0) {
                companyProfile += `\nEnabled Features: ${features.map((f: { featureKey: string }) => f.featureKey).join(', ')}`;
            }

            // Build optimized context
            contextText = buildOptimizedCompanyContext(
                usedCompanyProfile ? companyProfile : '',
                rankedChunks,
                queryIntent
            );
        } else if (isOnboarding) {
            // === Onboarding Assistant Pipeline ===
            console.log(`[chat] Onboarding Assistant | Role: ${onboardingRole}`);

            const rankedChunks = await findRelevantOnboardingKnowledge(
                db, openai, message, dbUser.companyId, onboardingRole
            );
            console.log(`[chat] Onboarding | Chunks: ${rankedChunks.length}`);

            groundingStatus = evaluateGroundingStatusFromRanked(rankedChunks);
            responseSources = buildResponseSourcesFromRanked(rankedChunks);

            // Fetch profile + guide
            const [{ data: cpProfile }, { data: guide }] = await Promise.all([
                db.from('CompanyProfile').select('*').eq('companyId', dbUser.companyId).maybeSingle(),
                db.from('CompanyOnboardingGuide').select('summary').eq('companyId', dbUser.companyId).maybeSingle(),
            ]);

            const contextParts: string[] = [];

            if (cpProfile) {
                const pParts: string[] = ['COMPANY PROFILE'];
                if (cpProfile.companyName) pParts.push(`Company Name: ${cpProfile.companyName}`);
                if (cpProfile.description) pParts.push(`Description:\n${cpProfile.description}`);
                if (cpProfile.productsServices) pParts.push(`Products & Services:\n${cpProfile.productsServices}`);
                if (cpProfile.targetCustomers) pParts.push(`Target Customers:\n${cpProfile.targetCustomers}`);
                if (cpProfile.markets) pParts.push(`Markets:\n${cpProfile.markets}`);
                if (cpProfile.departments) pParts.push(`Departments:\n${cpProfile.departments}`);
                if (cpProfile.internalTools) pParts.push(`Internal Tools:\n${cpProfile.internalTools}`);
                if (cpProfile.keyProcesses) pParts.push(`Key Processes:\n${cpProfile.keyProcesses}`);
                contextParts.push(pParts.join('\n'));
                usedCompanyProfile = true;
            }

            if (guide?.summary) {
                contextParts.push(`ONBOARDING GUIDE:\n${guide.summary}`);
            }

            if (rankedChunks.length > 0) {
                const srcText = rankedChunks
                    .map((c, i) => `[Source ${i + 1} - ${c.filename}${c.knowledgeCategory ? ` (${c.knowledgeCategory})` : ''}]\n${c.chunkText}`)
                    .join('\n\n---\n\n');
                contextParts.push(`COMPANY DOCUMENTS:\n${srcText}`);
            }

            contextText = contextParts.join('\n\n') || 'No company knowledge found.';
            companyProfile = contextParts[0] || '';
        } else {
            // === General Chat Pipeline ===
            const allChunks = await findRelevantChunks(db, openai, message, dbUser.companyId);
            groundingStatus = evaluateGroundingStatusFromChunks(allChunks);
            responseSources = buildResponseSourcesFromChunks(allChunks);
            contextText = allChunks
                .map((s, i) => `[Source ${i + 1}: ${s.filename}]\n${s.chunkText}`)
                .join('\n\n---\n\n');
        }

        // 3. Get conversation history (if continuing)
        let history: { role: 'user' | 'assistant'; content: string }[] = [];
        if (conversationId) {
            const { data: messages } = await db
                .from('Message')
                .select('role, content')
                .eq('conversationId', conversationId)
                .order('createdAt', { ascending: true })
                .limit(20);

            if (messages) {
                history = messages.map(m => ({
                    role: m.role === 'USER' ? 'user' as const : 'assistant' as const,
                    content: m.content,
                }));
            }
        }

        // 4. Build system prompt (from AI Brain config)
        const systemPrompt = buildBrainSystemPrompt({
            assistantType,
            effectiveConfig: effectiveBrain.config,
            advancedInstructions: effectiveBrain.advancedInstructions,
            companyProfile: usedCompanyProfile ? companyProfile : '',
            contextText: contextText || '',
            queryIntent: isCompanyKnowledge ? queryIntent : undefined,
            onboardingRole: isOnboarding ? onboardingRole : undefined,
            aiLanguageName,
        });

        // Derive temperature from brain creativity slider (fallback 0.3 = default)
        const temperature = getBrainTemperature(effectiveBrain.config);

        const completion = await openai.chat.completions.create({
            model: CHAT_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: message },
            ],
            max_completion_tokens: 2048,
            temperature,
        });

        const answer = completion.choices[0]?.message?.content || 'Unable to generate a response.';

        // 6. Persist conversation and messages
        let activeConversationId = conversationId;

        if (!activeConversationId) {
            // Create new conversation
            const title = message.length > 60 ? message.substring(0, 60) + '…' : message;
            const { data: conv, error: convErr } = await db
                .from('Conversation')
                .insert({
                    id: crypto.randomUUID(),
                    companyId: dbUser.companyId,
                    createdById: dbUser.id,
                    assistantType,
                    title,
                    updatedAt: new Date().toISOString(),
                    ...(isOnboarding && onboardingRole ? { onboardingRole } : {}),
                    brainProfileId: effectiveBrain.companyBrainId || effectiveBrain.roleBrainId || null,
                    brainVersionId: effectiveBrain.companyBrainVersionId || effectiveBrain.roleBrainVersionId || null,
                })
                .select()
                .single();

            if (convErr || !conv) {
                console.error('[chat] Conversation creation error:', convErr);
            } else {
                activeConversationId = conv.id;
            }
        } else {
            // Update conversation timestamp
            await db
                .from('Conversation')
                .update({ updatedAt: new Date().toISOString() })
                .eq('id', activeConversationId);
        }

        // Save messages
        if (activeConversationId) {
            await db.from('Message').insert([
                {
                    id: crypto.randomUUID(),
                    conversationId: activeConversationId,
                    role: 'USER',
                    content: message,
                },
                {
                    id: crypto.randomUUID(),
                    conversationId: activeConversationId,
                    role: 'ASSISTANT',
                    content: answer,
                },
            ]);
        }

        // 9b. Log question outcome for Knowledge Gap Detection (fire-and-forget)
        if (isCompanyKnowledge || isOnboarding) {
            void (async () => {
                try {
                    await db.from('AssistantQuestionLog').insert({
                        id: crypto.randomUUID(),
                        companyId: dbUser.companyId,
                        conversationId: activeConversationId ?? null,
                        userId: dbUser.id,
                        question: message.trim(),
                        assistantType,
                        groundingStatus: groundingStatus ?? 'GENERAL',
                        createdAt: new Date().toISOString(),
                    });
                } catch (err) {
                    console.error('[chat] Question log failed:', err);
                }
            })();
        }

        // 10. Return structured response
        return NextResponse.json({
            answer,
            conversationId: activeConversationId,
            assistantType,
            groundingStatus: isCompanyKnowledge ? groundingStatus : undefined,
            usedCompanyProfile: isCompanyKnowledge ? usedCompanyProfile : undefined,
            sources: responseSources,
        });
    } catch (error) {
        console.error('[chat] CATCH:', error);
        return NextResponse.json({ error: 'Chat failed', detail: String(error) }, { status: 500 });
    }
}

// ═══════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════

type CompanyQueryIntent =
    | 'COMPANY_OVERVIEW' | 'PRODUCT' | 'PROCESS' | 'POLICY'
    | 'ONBOARDING' | 'HR' | 'FINANCE' | 'GENERAL';

interface ChunkMatch {
    documentId: string;
    filename: string;
    chunkText: string;
    score: number;
}

interface RankedCompanyChunk {
    documentId: string;
    filename: string;
    chunkText: string;
    semanticSimilarity: number;
    finalScore: number;
    knowledgeCategory?: string | null;
    useAsKnowledgeSource?: boolean;
    knowledgePriority?: string | null;
    updatedAt?: string | Date;
}

type GroundingStatus = 'VERIFIED' | 'PARTIAL' | 'NOT_FOUND';

interface ResponseSource {
    documentId: string;
    filename: string;
    preview: string;
    relevanceScore: number;
}

// ═══════════════════════════════════════════════════════
// INTENT CLASSIFIER
// ═══════════════════════════════════════════════════════

const INTENT_PATTERNS: [RegExp, CompanyQueryIntent][] = [
    [/\b(onboard|integra[çc][aã]o|boas.?vindas|welcome|kickoff)\b/i, 'ONBOARDING'],
    [/\b(rh|recursos.?humanos|f[eé]rias|licen[çc]a|maternidade|paternidade|atestado|folha|sal[aá]rio|benef[ií]cio|contrata[çc][aã]o|demiss[aã]o)\b/i, 'HR'],
    [/\b(pol[ií]tica|regulamento|norma|compliance|c[oó]digo.?de.?conduta|gdpr|lgpd|privacidade)\b/i, 'POLICY'],
    [/\b(produto|servi[çc]o|solu[çc][aã]o|oferta|portf[oó]lio|catalogo|pricing|pre[çc]o)\b/i, 'PRODUCT'],
    [/\b(processo|procedimento|fluxo|workflow|etapa|passo|como.?fa(z|zer)|como.?funciona)\b/i, 'PROCESS'],
    [/\b(finan[çc]|fatura|pagamento|cobran[çc]a|or[çc]amento|receita|despesa|contabilidade|fiscal)\b/i, 'FINANCE'],
    [/\b(empresa|companhia|quem.?somos|miss[aã]o|vis[aã]o|valores|hist[oó]ria|sobre.?n[oó]s|o.?que.?fa(z|zemos))\b/i, 'COMPANY_OVERVIEW'],
];

function classifyCompanyQueryIntent(question: string): CompanyQueryIntent {
    const normalized = question.toLowerCase().normalize('NFD');
    for (const [pattern, intent] of INTENT_PATTERNS) {
        if (pattern.test(normalized) || pattern.test(question)) {
            return intent;
        }
    }
    return 'GENERAL';
}

// Maps intent → relevant knowledge categories
const INTENT_CATEGORY_MAP: Record<CompanyQueryIntent, string[]> = {
    COMPANY_OVERVIEW: ['company', 'product', 'general'],
    PRODUCT: ['product', 'company'],
    PROCESS: ['process', 'onboarding', 'operations'],
    POLICY: ['policy', 'compliance', 'hr'],
    ONBOARDING: ['onboarding', 'process', 'hr'],
    HR: ['hr', 'policy'],
    FINANCE: ['finance', 'operations'],
    GENERAL: [],
};

// ═══════════════════════════════════════════════════════
// 4-STAGE COMPANY KNOWLEDGE RETRIEVAL
// ═══════════════════════════════════════════════════════

async function findRelevantCompanyKnowledge(
    db: ReturnType<typeof createAdminClient>,
    openai: OpenAI,
    query: string,
    companyId: string,
    queryIntent: CompanyQueryIntent
): Promise<RankedCompanyChunk[]> {
    try {
        // ── Stage 1: Candidate Retrieval (top 20 by similarity) ──
        const embResponse = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: query,
        });
        const queryEmbedding = embResponse.data[0].embedding;

        const { data: embeddings } = await db
            .from('DocumentEmbedding')
            .select('documentId, externalDocumentId, chunkText, embedding')
            .eq('companyId', companyId);

        if (!embeddings || embeddings.length === 0) return [];

        // Score all candidates
        const candidates = embeddings.map(emb => {
            const embVector: number[] = JSON.parse(emb.embedding);
            return {
                documentId: emb.documentId as string,
                externalDocumentId: (emb.externalDocumentId || null) as string | null,
                chunkText: emb.chunkText as string,
                semanticSimilarity: cosineSimilarity(queryEmbedding, embVector),
            };
        })
            .filter(c => c.semanticSimilarity >= 0.2) // Min threshold
            .sort((a, b) => b.semanticSimilarity - a.semanticSimilarity)
            .slice(0, 20); // Top 20 candidates

        if (candidates.length === 0) return [];

        // ── Stage 2: Metadata Enrichment (both Document and ExternalDocument) ──
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

        const enrichedCandidates: RankedCompanyChunk[] = candidates.map(c => {
            const doc = c.externalDocumentId
                ? extDocMap.get(c.externalDocumentId)
                : docMap.get(c.documentId);
            const sourceId = c.externalDocumentId || c.documentId;
            return {
                documentId: sourceId,
                filename: doc?.filename || 'Unknown',
                chunkText: c.chunkText,
                semanticSimilarity: c.semanticSimilarity,
                finalScore: 0, // Will be set in Stage 3
                knowledgeCategory: doc?.knowledgeCategory || null,
                useAsKnowledgeSource: doc?.useAsKnowledgeSource || false,
                knowledgePriority: doc?.knowledgePriority || 'normal',
                updatedAt: doc?.updatedAt || undefined,
            };
        });

        // ── Stage 3: Composite Ranking ──
        for (const chunk of enrichedCandidates) {
            chunk.finalScore = scoreCompanyKnowledgeCandidate(chunk, queryIntent);
        }
        enrichedCandidates.sort((a, b) => b.finalScore - a.finalScore);

        // ── Stage 4: Final Selection (dedup, diversity, cap) ──
        const selected: RankedCompanyChunk[] = [];
        const docChunkCount = new Map<string, number>();
        const MAX_CHUNKS_PER_DOC = 2;
        const MAX_TOTAL = 8;

        for (const chunk of enrichedCandidates) {
            if (selected.length >= MAX_TOTAL) break;

            // Cap per document
            const currentCount = docChunkCount.get(chunk.documentId) || 0;
            if (currentCount >= MAX_CHUNKS_PER_DOC) continue;

            // Skip very short / noisy chunks
            const cleanText = chunk.chunkText.trim();
            if (cleanText.length < 30) continue;

            // Skip near-duplicate content
            const isDuplicate = selected.some(s =>
                s.documentId === chunk.documentId &&
                levenshteinSimilarity(s.chunkText.substring(0, 100), chunk.chunkText.substring(0, 100)) > 0.85
            );
            if (isDuplicate) continue;

            selected.push(chunk);
            docChunkCount.set(chunk.documentId, currentCount + 1);
        }

        return selected;
    } catch (err) {
        console.error('[chat] Company knowledge retrieval failed:', err);
        return [];
    }
}

// ═══════════════════════════════════════════════════════
// COMPOSITE RANKING SCORER
// ═══════════════════════════════════════════════════════

function scoreCompanyKnowledgeCandidate(
    candidate: RankedCompanyChunk,
    queryIntent: CompanyQueryIntent
): number {
    let score = candidate.semanticSimilarity;

    // Category boost: +0.15 if document category matches query intent
    if (candidate.knowledgeCategory) {
        const relevantCategories = INTENT_CATEGORY_MAP[queryIntent] || [];
        if (relevantCategories.includes(candidate.knowledgeCategory.toLowerCase())) {
            score += 0.15;
        }
    }

    // Knowledge source boost: +0.20 if curated
    if (candidate.useAsKnowledgeSource) {
        score += 0.20;
    }

    // Priority boost
    if (candidate.knowledgePriority === 'critical') {
        score += 0.10;
    } else if (candidate.knowledgePriority === 'preferred') {
        score += 0.05;
    }

    // Recency boost: +0.03 if updated within 30 days
    if (candidate.updatedAt) {
        const updatedDate = new Date(candidate.updatedAt);
        const daysSinceUpdate = (Date.now() - updatedDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceUpdate <= 30) {
            score += 0.03;
        }
    }

    // Noise penalty: -0.10 for very short chunks
    if (candidate.chunkText.trim().length < 50) {
        score -= 0.10;
    }

    return score;
}

// ═══════════════════════════════════════════════════════
// OPTIMIZED CONTEXT BUILDER
// ═══════════════════════════════════════════════════════

function buildOptimizedCompanyContext(
    companyProfile: string,
    rankedChunks: RankedCompanyChunk[],
    _queryIntent: CompanyQueryIntent
): string {
    const parts: string[] = [];

    // Always include company profile if present (covers all intents)
    if (companyProfile) {
        parts.push(companyProfile);
    }

    // Include ranked chunks
    if (rankedChunks.length > 0) {
        const sourcesText = rankedChunks
            .map((c, i) => `[Source ${i + 1} - ${c.filename}${c.knowledgeCategory ? ` (${c.knowledgeCategory})` : ''}]\n${c.chunkText}`)
            .join('\n\n---\n\n');
        parts.push(`RELEVANT COMPANY SOURCES:\n${sourcesText}`);
    } else {
        parts.push('No relevant company documents were found for this query.');
    }

    return parts.join('\n\n');
}

// ═══════════════════════════════════════════════════════
// GENERIC RETRIEVAL (for General chat mode)
// ═══════════════════════════════════════════════════════

async function findRelevantChunks(
    db: ReturnType<typeof createAdminClient>,
    openai: OpenAI,
    query: string,
    companyId: string
): Promise<ChunkMatch[]> {
    try {
        const embResponse = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: query,
        });
        const queryEmbedding = embResponse.data[0].embedding;

        const { data: embeddings } = await db
            .from('DocumentEmbedding')
            .select('documentId, externalDocumentId, chunkText, embedding')
            .eq('companyId', companyId);

        if (!embeddings || embeddings.length === 0) return [];

        // Resolve filenames from both Document and ExternalDocument
        const nativeDocIds = [...new Set(embeddings.filter(e => !e.externalDocumentId).map(e => e.documentId))];
        const extDocIds = [...new Set(embeddings.filter(e => e.externalDocumentId).map(e => e.externalDocumentId!))];

        const { data: docs } = nativeDocIds.length > 0
            ? await db.from('Document').select('id, filename').in('id', nativeDocIds)
            : { data: [] };
        const { data: extDocs } = extDocIds.length > 0
            ? await db.from('ExternalDocument').select('id, filename').in('id', extDocIds)
            : { data: [] };

        const docMap = new Map((docs || []).map(d => [d.id, d.filename]));
        const extDocMap = new Map((extDocs || []).map(d => [d.id, d.filename]));

        return embeddings
            .map(emb => {
                const embVector: number[] = JSON.parse(emb.embedding);
                const score = cosineSimilarity(queryEmbedding, embVector);
                const sourceId = emb.externalDocumentId || emb.documentId;
                const filename = emb.externalDocumentId
                    ? extDocMap.get(emb.externalDocumentId) || 'Unknown'
                    : docMap.get(emb.documentId) || 'Unknown';
                return {
                    documentId: sourceId,
                    filename,
                    chunkText: emb.chunkText,
                    score,
                };
            })
            .sort((a, b) => b.score - a.score)
            .slice(0, 5);
    } catch (err) {
        console.error('[chat] Chunk search failed:', err);
        return [];
    }
}

// ═══════════════════════════════════════════════════════
// GROUNDING STATUS + RESPONSE SOURCES
// ═══════════════════════════════════════════════════════

function evaluateGroundingStatusFromRanked(chunks: RankedCompanyChunk[]): GroundingStatus {
    if (chunks.length === 0) return 'NOT_FOUND';
    const topScore = chunks[0].finalScore;
    const relevant = chunks.filter(c => c.finalScore >= 0.4);
    if (topScore >= 0.85 || (topScore >= 0.75 && relevant.length >= 2)) return 'VERIFIED';
    if (topScore >= 0.4) return 'PARTIAL';
    return 'NOT_FOUND';
}

function evaluateGroundingStatusFromChunks(chunks: ChunkMatch[]): GroundingStatus {
    if (chunks.length === 0) return 'NOT_FOUND';
    const topScore = chunks[0].score;
    const relevant = chunks.filter(c => c.score >= 0.3);
    if (topScore >= 0.85 || (topScore >= 0.75 && relevant.length >= 2)) return 'VERIFIED';
    if (topScore >= 0.4) return 'PARTIAL';
    return 'NOT_FOUND';
}

function buildResponseSourcesFromRanked(chunks: RankedCompanyChunk[]): ResponseSource[] {
    const seen = new Map<string, RankedCompanyChunk>();
    for (const chunk of chunks) {
        const existing = seen.get(chunk.documentId);
        if (!existing || chunk.finalScore > existing.finalScore) {
            seen.set(chunk.documentId, chunk);
        }
    }
    return Array.from(seen.values())
        .sort((a, b) => b.finalScore - a.finalScore)
        .slice(0, 3)
        .map(chunk => ({
            documentId: chunk.documentId,
            filename: chunk.filename,
            preview: chunk.chunkText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 180)
                + (chunk.chunkText.length > 180 ? '…' : ''),
            relevanceScore: Math.round(chunk.finalScore * 100) / 100,
        }));
}

function buildResponseSourcesFromChunks(chunks: ChunkMatch[]): ResponseSource[] {
    const seen = new Map<string, ChunkMatch>();
    for (const chunk of chunks.filter(c => c.score >= 0.3)) {
        const existing = seen.get(chunk.documentId);
        if (!existing || chunk.score > existing.score) {
            seen.set(chunk.documentId, chunk);
        }
    }
    return Array.from(seen.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(chunk => ({
            documentId: chunk.documentId,
            filename: chunk.filename,
            preview: chunk.chunkText.replace(/\n+/g, ' ').replace(/\s+/g, ' ').trim().substring(0, 180)
                + (chunk.chunkText.length > 180 ? '…' : ''),
            relevanceScore: Math.round(chunk.score * 100) / 100,
        }));
}

// ═══════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════

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

// Simple Levenshtein-based similarity for near-duplicate detection
function levenshteinSimilarity(a: string, b: string): number {
    if (a === b) return 1;
    const longer = a.length > b.length ? a : b;
    const shorter = a.length > b.length ? b : a;
    if (longer.length === 0) return 1;

    const matrix: number[][] = [];
    for (let i = 0; i <= shorter.length; i++) {
        matrix[i] = [i];
    }
    for (let j = 0; j <= longer.length; j++) {
        matrix[0][j] = j;
    }
    for (let i = 1; i <= shorter.length; i++) {
        for (let j = 1; j <= longer.length; j++) {
            const cost = shorter[i - 1] === longer[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost
            );
        }
    }
    return 1 - matrix[shorter.length][longer.length] / longer.length;
}

// ═══════════════════════════════════════════════════════
// ONBOARDING RETRIEVAL PIPELINE
// ═══════════════════════════════════════════════════════

// Onboarding category boosts: categories that matter for new employees
const ONBOARDING_CATEGORY_BOOST: Record<string, number> = {
    onboarding: 0.25,
    company: 0.20,
    process: 0.18,
    product: 0.15,
    hr: 0.12,
    policy: 0.10,
    operations: 0.08,
};

// Role → extra category boost multiplier
const ROLE_CATEGORY_BOOST: Record<string, Record<string, number>> = {
    sales: { product: 0.10, company: 0.08 },
    operations: { process: 0.12, operations: 0.10 },
    hr: { hr: 0.15, policy: 0.12 },
    product: { product: 0.12, company: 0.08 },
    marketing: { company: 0.10, product: 0.08 },
    finance: { finance: 0.12, operations: 0.08 },
    general: {},
};

async function findRelevantOnboardingKnowledge(
    db: ReturnType<typeof createAdminClient>,
    openai: OpenAI,
    query: string,
    companyId: string,
    onboardingRole: string
): Promise<RankedCompanyChunk[]> {
    try {
        // Stage 1: Embed + retrieve candidates
        const embResponse = await openai.embeddings.create({
            model: EMBEDDING_MODEL,
            input: query,
        });
        const queryEmbedding = embResponse.data[0].embedding;

        const { data: embeddings } = await db
            .from('DocumentEmbedding')
            .select('documentId, externalDocumentId, chunkText, embedding')
            .eq('companyId', companyId);

        if (!embeddings || embeddings.length === 0) return [];

        const candidates = embeddings.map(emb => {
            const embVector: number[] = JSON.parse(emb.embedding);
            return {
                documentId: emb.documentId as string,
                chunkText: emb.chunkText as string,
                semanticSimilarity: cosineSimilarity(queryEmbedding, embVector),
            };
        })
            .filter(c => c.semanticSimilarity >= 0.15) // Lower threshold for onboarding
            .sort((a, b) => b.semanticSimilarity - a.semanticSimilarity)
            .slice(0, 20);

        if (candidates.length === 0) return [];

        // Stage 2: Metadata enrichment
        const docIds = [...new Set(candidates.map(c => c.documentId))];
        const { data: docs } = await db
            .from('Document')
            .select('id, filename, knowledgeCategory, useAsKnowledgeSource, knowledgePriority, updatedAt')
            .in('id', docIds);

        const docMap = new Map((docs || []).map(d => [d.id, d]));

        const enriched: RankedCompanyChunk[] = candidates.map(c => {
            const doc = docMap.get(c.documentId);
            return {
                documentId: c.documentId,
                filename: doc?.filename || 'Unknown',
                chunkText: c.chunkText,
                semanticSimilarity: c.semanticSimilarity,
                finalScore: 0,
                knowledgeCategory: doc?.knowledgeCategory || null,
                useAsKnowledgeSource: doc?.useAsKnowledgeSource || false,
                knowledgePriority: doc?.knowledgePriority || 'normal',
                updatedAt: doc?.updatedAt || undefined,
            };
        });

        // Stage 3: Onboarding composite scoring
        const roleBoosters = ROLE_CATEGORY_BOOST[onboardingRole] || {};
        for (const chunk of enriched) {
            let score = chunk.semanticSimilarity;
            const cat = (chunk.knowledgeCategory || '').toLowerCase();

            // Onboarding base boost
            if (cat && ONBOARDING_CATEGORY_BOOST[cat]) {
                score += ONBOARDING_CATEGORY_BOOST[cat];
            }

            // Role-specific extra boost
            if (cat && roleBoosters[cat]) {
                score += roleBoosters[cat];
            }

            // Knowledge source boost
            if (chunk.useAsKnowledgeSource) score += 0.20;

            // Priority boost
            if (chunk.knowledgePriority === 'critical') score += 0.10;
            else if (chunk.knowledgePriority === 'preferred') score += 0.05;

            // Recency boost
            if (chunk.updatedAt) {
                const days = (Date.now() - new Date(chunk.updatedAt).getTime()) / (1000 * 60 * 60 * 24);
                if (days <= 30) score += 0.03;
            }

            // Noise penalty
            if (chunk.chunkText.trim().length < 50) score -= 0.10;

            chunk.finalScore = score;
        }

        enriched.sort((a, b) => b.finalScore - a.finalScore);

        // Stage 4: Dedup + cap selection
        const selected: RankedCompanyChunk[] = [];
        const docCount = new Map<string, number>();
        for (const chunk of enriched) {
            if (selected.length >= 8) break;
            const count = docCount.get(chunk.documentId) || 0;
            if (count >= 2) continue;
            if (chunk.chunkText.trim().length < 30) continue;
            const isDup = selected.some(s =>
                s.documentId === chunk.documentId &&
                levenshteinSimilarity(s.chunkText.substring(0, 100), chunk.chunkText.substring(0, 100)) > 0.85
            );
            if (isDup) continue;
            selected.push(chunk);
            docCount.set(chunk.documentId, count + 1);
        }

        return selected;
    } catch (err) {
        console.error('[chat] Onboarding retrieval failed:', err);
        return [];
    }
}
