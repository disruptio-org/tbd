import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';
import { getAiLanguageName, type Locale } from '@/i18n';
import { resolveEffectiveBrainConfig } from '@/lib/ai-brains/resolve-effective-brain';
import { buildBrainSystemPrompt, getBrainTemperature } from '@/lib/ai-brains/build-brain-prompt';
import type { BrainConfig } from '@/lib/ai-brains/schema';
import { retrieveRelevantKnowledge, formatRAGContext } from '@/lib/rag-retrieval';

const MODEL = 'gpt-5.4';

// ─── Output-type prompt templates ─────────────────────

const OUTPUT_TEMPLATES: Record<string, { systemSuffix: string; outputHint: string }> = {
    PRD: {
        systemSuffix: `Generate a Product Requirements Document (PRD). Include: Executive Summary, Problem Statement, Goals, Non-Goals, Target Users/Personas, Business Requirements, Functional Requirements, Non-Functional Requirements, Technical Considerations, UX/Workflow, Dependencies, Risks/Assumptions/Unknowns, MVP Scope, Phase 2/Later, Success Metrics.`,
        outputHint: 'executiveSummary, problem, goals, nonGoals, users, businessRequirements, functionalRequirements, nonFunctionalRequirements, technicalConsiderations, ux, dependencies, risks, mvpScope, phaseLater, metrics',
    },
    BRD: {
        systemSuffix: `Generate a Business Requirements Document (BRD). Include: Executive Summary, Business Context, Business Objectives, Stakeholders, Business Requirements, Functional Requirements, Constraints, Dependencies, Assumptions, Risks, Success Criteria, Timeline.`,
        outputHint: 'executiveSummary, businessContext, objectives, stakeholders, requirements, functionalRequirements, constraints, dependencies, assumptions, risks, successCriteria, timeline',
    },
    FUNCTIONAL_SPEC: {
        systemSuffix: `Generate a Functional Specification. Include: Scope, Actors/Roles, User Flows, Feature List, Business Rules, Acceptance Criteria, Edge Cases, Data Model hints, Integration points.`,
        outputHint: 'scope, actors, flows, features, rules, acceptanceCriteria, edgeCases, dataModel, integrations',
    },
    TECHNICAL_BRIEF: {
        systemSuffix: `Generate a Technical Brief. Include: Architecture assumptions, Data entities, APIs/Endpoints, Events/Webhooks, Permissions/Roles, Constraints, Non-functional requirements, Implementation notes.`,
        outputHint: 'architecture, entities, apis, events, permissions, constraints, nonFunctionalRequirements, implementationNotes',
    },
    USER_STORIES: {
        systemSuffix: `Generate User Stories. For each story include: title, as a [role] I want [action] so that [benefit], acceptance criteria (numbered), edge cases, priority (must/should/could), complexity estimate. Generate 5-15 stories grouped by epic.`,
        outputHint: 'stories grouped by epic, each with title, description, acceptanceCriteria, priority, complexity',
    },
    ACCEPTANCE_CRITERIA: {
        systemSuffix: `Generate structured Acceptance Criteria. For each feature/requirement: Given [context], When [action], Then [expected result]. Include: happy path, error paths, edge cases, boundary conditions.`,
        outputHint: 'criteria list with given/when/then format, grouped by feature',
    },
    FEATURE_BREAKDOWN: {
        systemSuffix: `Generate a Feature Breakdown. Include: feature mapping table (Feature | User Need | Business Need | Strategic Value | Priority | Complexity | Phase | Dependencies), grouped by category, with MVP vs Later distinction.`,
        outputHint: 'feature table with priorities, complexity, phases, dependencies',
    },
    PRODUCT_POSITIONING: {
        systemSuffix: `Generate Product Positioning. Include: Market/Category Framing, Target Audience/ICP, Value Proposition, Key Differentiators, Messaging Pillars, Feature Proof Points, Competitive positioning.`,
        outputHint: 'marketFraming, targetAudience, valueProposition, differentiators, messagingPillars, proofPoints, competitive',
    },
    BRAND_POSITIONING: {
        systemSuffix: `Generate Brand/Market Positioning Support. Include: Brand positioning statement, Product-market-fit articulation, Segment-specific messaging, Feature-to-market relevance mapping, Opportunity gaps, Persona-to-value mapping.`,
        outputHint: 'brandStatement, pmfArticulation, segmentMessaging, featureRelevance, opportunities, personaMapping',
    },
    VIBE_CODING_SPEC: {
        systemSuffix: `Generate a Vibe Coding Specification optimized for AI coding tools. Include:
1. Product Context
2. Build Objective
3. Main User Roles
4. Core Workflows
5. Required Screens/Pages
6. Data Entities/Model
7. Functional Requirements (numbered list)
8. Non-Functional Requirements
9. Business Rules
10. Edge Cases
11. APIs/Actions
12. Suggested Implementation Order
13. Explicit "Do Not Build Yet" list
14. Open Questions

End with a dedicated "VIBE CODING PROMPT" block that is ready to copy-paste into an AI coding tool.`,
        outputHint: 'context, objective, roles, workflows, screens, entities, functionalReqs, nonFunctionalReqs, rules, edgeCases, apis, implementationOrder, doNotBuild, openQuestions, vibeCodingPrompt',
    },
    ROADMAP: {
        systemSuffix: `Generate a Roadmap Recommendation. Include: Strategic context, Phase breakdown (Phase 1/MVP, Phase 2, Phase 3+), Feature sequencing with rationale, Dependencies between phases, Risk assessment per phase, Resource considerations, Timeline estimates, Success metrics per phase.`,
        outputHint: 'context, phases with features and rationale, dependencies, risks, resources, timeline, metrics',
    },
    EPIC_BREAKDOWN: {
        systemSuffix: `Generate an Epic + Task Breakdown. Include: Epics (with description, user value, business value), Tasks per epic (with estimates, dependencies, acceptance criteria), Suggested sprint allocation, Critical path identification.`,
        outputHint: 'epics with tasks, estimates, dependencies, acceptanceCriteria, sprintAllocation, criticalPath',
    },
    API_DRAFT: {
        systemSuffix: `Generate an API + Entity Draft. Include: Data model (entities with fields and types), API endpoints (method, path, request/response), Authentication/authorization requirements, Relationships between entities, Validation rules, Error handling patterns.`,
        outputHint: 'entities with fields, endpoints with method/path/request/response, auth, relationships, validation, errors',
    },
    DISCOVERY_ANALYSIS: {
        systemSuffix: `Generate a Discovery Analysis. Include: Customer Pains, Jobs-to-be-Done, Current Alternatives, Feature Desirability assessment, MVP Boundaries recommendation, Risks, Assumptions to validate, Recommended next steps.`,
        outputHint: 'pains, jtbd, alternatives, desirability, mvpBoundaries, risks, assumptions, nextSteps',
    },
};

/**
 * POST /api/product/generate
 * AI-powered product documentation generation with company context.
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });

    try {
        const body = await request.json();
        const {
            outputType,
            title: inputTitle,
            inputPrompt,
            structuredInput,
            audienceType = 'mixed',
            detailLevel = 'detailed',
            useCompanyKnowledge = true,
            sourceDocumentIds,
            // Refinement
            refinementAction,
            previousOutput,
            projectId,
            conversationLog,
        } = body;

        if (!outputType) {
            return NextResponse.json({ error: 'Output type is required' }, { status: 400 });
        }

        const db = createAdminClient();
        const openai = new OpenAI({ apiKey });

        // Try hardcoded templates first; fall back to a custom skill from the database
        let template = OUTPUT_TEMPLATES[outputType] as { systemSuffix: string; outputHint: string } | undefined;
        let skillTrainingContext = '';

        if (!template) {
            // Look up custom/imported skill by key
            const { data: customSkill } = await db
                .from('AssistantSkill')
                .select('instructionPrompt, trainingMaterials, name, description')
                .eq('companyId', auth.dbUser.companyId)
                .eq('key', outputType.toLowerCase())
                .maybeSingle();

            if (!customSkill?.instructionPrompt) {
                return NextResponse.json({ error: 'Invalid output type' }, { status: 400 });
            }

            template = {
                systemSuffix: customSkill.instructionPrompt,
                outputHint: 'title, content, summary (based on skill instructions)',
            };

            // Append training materials from the skill if available
            if (customSkill.trainingMaterials && Array.isArray(customSkill.trainingMaterials)) {
                const tmParts = (customSkill.trainingMaterials as { filename: string; textContent: string }[])
                    .map(m => `[Reference: ${m.filename}]\n${m.textContent}`)
                    .join('\n\n---\n\n');
                if (tmParts) skillTrainingContext = `\n\nSKILL TRAINING MATERIALS:\n${tmParts}`;
            }
        }

        if (!inputPrompt?.trim() && !refinementAction) {
            return NextResponse.json({ error: 'Input prompt is required' }, { status: 400 });
        }

        // Fetch company language
        const { data: companyLangRow } = await db.from('Company').select('language').eq('id', auth.dbUser.companyId).maybeSingle();
        const companyLang = (companyLangRow?.language as Locale) || 'en';
        const langLabel = getAiLanguageName(companyLang);

        // Resolve brain config for Product Assistant
        const resolved = await resolveEffectiveBrainConfig(auth.dbUser.companyId, 'PRODUCT_ASSISTANT');
        const brainSystemPrompt = buildBrainSystemPrompt({
            assistantType: 'PRODUCT_ASSISTANT',
            effectiveConfig: resolved.config,
            advancedInstructions: null,
            companyProfile: '',
            contextText: '',
            aiLanguageName: langLabel,
        });
        const temperature = getBrainTemperature({ ...resolved.config } as BrainConfig);

        // Load company context
        const contextParts: string[] = [];

        if (useCompanyKnowledge) {
            if (projectId) {
                const { data: project } = await db.from('Project').select('name, description, contextText').eq('id', projectId).eq('companyId', auth.dbUser.companyId).maybeSingle();
                if (project) {
                    contextParts.push('=== PROJECT CONTEXT ===');
                    if (project.name) contextParts.push(`Project: ${project.name}`);
                    if (project.description) contextParts.push(`Description: ${project.description}`);
                    if (project.contextText) contextParts.push(`Instructions: ${project.contextText}`);
                }
            } else {
                const { data: profile } = await db
                    .from('CompanyProfile')
                    .select('*')
                    .eq('companyId', auth.dbUser.companyId)
                    .maybeSingle();

                const { data: company } = await db
                    .from('Company')
                    .select('name, website, webContext')
                    .eq('id', auth.dbUser.companyId)
                    .maybeSingle();

                if (profile) {
                    contextParts.push('=== COMPANY PROFILE ===');
                    if (profile.companyName) contextParts.push(`Company: ${profile.companyName}`);
                    if (profile.description) contextParts.push(`Description: ${profile.description}`);
                    if (profile.productsServices) contextParts.push(`Products/Services: ${profile.productsServices}`);
                    if (profile.mainOfferings) contextParts.push(`Main Offerings: ${profile.mainOfferings}`);
                    if (profile.valueProposition) contextParts.push(`Value Proposition: ${profile.valueProposition}`);
                    if (profile.targetCustomers) contextParts.push(`Target Customers: ${profile.targetCustomers}`);
                    if (profile.targetIndustries) contextParts.push(`Target Industries: ${profile.targetIndustries}`);
                    if (profile.markets) contextParts.push(`Markets: ${profile.markets}`);
                    if (profile.competitors) contextParts.push(`Competitors: ${profile.competitors}`);
                    if (profile.strategicGoals) contextParts.push(`Strategic Goals: ${profile.strategicGoals}`);
                } else if (company) {
                    contextParts.push(`Company: ${company.name}`);
                    if (company.website) contextParts.push(`Website: ${company.website}`);
                }

                if (company?.webContext) {
                    contextParts.push(`\nWeb Context:\n${company.webContext}`);
                }
            }
        }

        const companyContext = contextParts.length > 0 ? contextParts.join('\n') : 'No company context available. Generate based on the input provided.';

        // RAG: Automatically retrieve relevant knowledge from embedded documents
        const ragQuery = [inputTitle, inputPrompt, structuredInput?.problemStatement, structuredInput?.targetUsers]
            .filter(Boolean)
            .join(' — ');
        const ragChunks = ragQuery.trim()
            ? await retrieveRelevantKnowledge(auth.dbUser.companyId, ragQuery, { maxChunks: 10 })
            : [];
        const ragContext = formatRAGContext(ragChunks);

        // Audience framing
        const audienceMap: Record<string, string> = {
            business: 'Business stakeholders — simplify technical language, focus on value and outcomes.',
            technical: 'Technical audience — include entities, flows, APIs, rules, and implementation details.',
            mixed: 'Mixed audience — include both business and technical perspectives with separate sections where relevant.',
        };
        const audienceInstruction = audienceMap[audienceType] || audienceMap.mixed;

        // Detail level
        const detailMap: Record<string, string> = {
            brief: 'Keep the output concise and high-level, around 300-500 words.',
            medium: 'Provide a balanced level of detail, around 800-1500 words.',
            detailed: 'Provide comprehensive, execution-ready detail, 1500-3000+ words.',
        };
        const detailInstruction = detailMap[detailLevel] || detailMap.detailed;

        // Build structured input context
        let structuredContext = '';
        if (structuredInput && typeof structuredInput === 'object') {
            const fields = Object.entries(structuredInput)
                .filter(([, v]) => v && String(v).trim())
                .map(([k, v]) => `- ${k}: ${v}`)
                .join('\n');
            if (fields) structuredContext = `\n\nSTRUCTURED INPUT:\n${fields}`;
        }

        // Build user message
        let userMessage: string;

        if (refinementAction && previousOutput) {
            const actionMap: Record<string, string> = {
                regenerate: 'Generate a completely new version with a fresh approach.',
                rewrite: 'Rewrite this output improving clarity, structure, and completeness.',
                shorten: 'Shorten this output significantly while keeping the key information.',
                expand: 'Expand this output with more detail, examples, and depth.',
            };
            userMessage = `${actionMap[refinementAction] || 'Refine this output.'}\n\nOriginal output:\n${previousOutput}`;
        } else {
            userMessage = inputPrompt;
            if (inputTitle) userMessage = `Product/Feature: ${inputTitle}\n\n${userMessage}`;
        }

        const systemPrompt = `${brainSystemPrompt}

You are the Product Assistant — a senior product strategist, product manager, business analyst, and requirements engineer. Your role is to transform ambiguous product ideas into structured, high-quality, execution-ready outputs.

${companyContext}
${ragContext}${skillTrainingContext}

OUTPUT REQUIREMENTS:
- Output type: ${outputType.replace(/_/g, ' ')}
- Language: ${langLabel}
- Audience: ${audienceInstruction}
- Detail level: ${detailInstruction}

${template.systemSuffix}

RULES:
- Write in ${langLabel}.
- Make assumptions explicit — always include an "Assumptions" section when information is missing.
- Challenge vague or unclear inputs — flag what needs clarification.
- Distinguish MVP from later phases.
- Map features to user needs AND business needs where relevant.
- Separate confirmed facts from inferred assumptions.
- Do NOT invent specific metrics, customer data, or unsupported claims.
- Use structured headings, numbered lists, and tables.
- Keep outputs execution-oriented and copy-paste ready.
- When company knowledge base sources are available, USE them to enrich and ground your output with real company data instead of making generic assumptions.
${structuredContext}`;

        // Call OpenAI
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (openai as any).responses.create({
            model: MODEL,
            instructions: systemPrompt,
            input: userMessage,
            temperature,
            text: {
                format: {
                    type: 'json_schema',
                    name: 'product_output',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: {
                            title: { type: 'string', description: 'Generated title for this product output' },
                            content: { type: 'string', description: 'The full generated product output as structured markdown text' },
                            summary: { type: 'string', description: 'One-line summary of what was generated' },
                            vibeCodingBlock: { type: 'string', description: 'If output type is VIBE_CODING_SPEC, the copy-paste ready vibe coding prompt block. Empty string otherwise.' },
                        },
                        required: ['title', 'content', 'summary', 'vibeCodingBlock'],
                        additionalProperties: false,
                    },
                },
            },
        });

        const rawContent = response.output_text || '';
        let output = { title: '', content: '', summary: '', vibeCodingBlock: '' };

        try {
            output = JSON.parse(rawContent);
        } catch (e) {
            console.error('[product/generate] Parse error:', e);
            output = { title: inputTitle || inputPrompt?.substring(0, 80) || 'Product Output', content: rawContent, summary: '', vibeCodingBlock: '' };
        }

        // Save generation run
        const runId = crypto.randomUUID();
        const runTitle = output.title || (inputPrompt?.substring(0, 80) + (inputPrompt?.length > 80 ? '…' : '')) || outputType;

        await db.from('ProductGenerationRun').insert({
            id: runId,
            companyId: auth.dbUser.companyId,
            userId: auth.dbUser.id,
            outputType,
            title: runTitle,
            inputPrompt: inputPrompt || refinementAction || '',
            structuredInput: structuredInput || null,
            generationContext: { audienceType, detailLevel, useCompanyKnowledge, sourceDocumentIds, refinementAction, conversationLog: conversationLog || null },
            outputText: output.content,
            audienceType,
            detailLevel,
            sourceDocumentIds: sourceDocumentIds || null,
            status: 'completed',
            updatedAt: new Date().toISOString(),
        });

        return NextResponse.json({
            generationRunId: runId,
            outputType,
            title: output.title,
            content: output.content,
            summary: output.summary,
            vibeCodingBlock: output.vibeCodingBlock || '',
            usedCompanyProfile: useCompanyKnowledge && contextParts.length > 0,
        });

    } catch (error) {
        console.error('[product/generate] Error:', error);
        return NextResponse.json({ error: 'Product generation failed', detail: String(error) }, { status: 500 });
    }
}
