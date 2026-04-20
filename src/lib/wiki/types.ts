/**
 * Wiki Types — Interfaces for the LLM-Wiki knowledge compilation system.
 * 
 * Wiki pages are stored as KnowledgeNode rows with specific type values.
 * No new database tables required.
 */

/* ─── Entity Taxonomy ─────────────────────────────────── */

export const WIKI_ENTITY_TYPES = [
    'product',
    'persona',
    'messaging',
    'case_study',
    'market',
    'pricing',
    'competitor',
    'process',
    'methodology',
    'metric',
    'content_strategy',
    'integration',
    'policy',
] as const;

export type WikiEntityType = (typeof WIKI_ENTITY_TYPES)[number];

/** Human-readable labels for each entity type */
export const WIKI_TYPE_LABELS: Record<WikiEntityType, string> = {
    product: 'Products & Features',
    persona: 'Target Personas',
    messaging: 'Messaging & Brand',
    case_study: 'Case Studies & Outcomes',
    market: 'Market & Industry',
    pricing: 'Pricing & Packaging',
    competitor: 'Competitors',
    process: 'Processes & Workflows',
    methodology: 'Methodologies & Frameworks',
    metric: 'Metrics & KPIs',
    content_strategy: 'Content Strategy',
    integration: 'Tools & Integrations',
    policy: 'Policies & Standards',
};

/** Descriptions used in the LLM extraction prompt */
export const WIKI_TYPE_DESCRIPTIONS: Record<WikiEntityType, string> = {
    product: 'Products, services, features, capabilities, technical specifications',
    persona: 'Ideal customer profiles, buyer personas, user archetypes, customer segments',
    messaging: 'Brand voice, value propositions, taglines, key messages, communication guidelines',
    case_study: 'Client success stories, project outcomes, ROI data, testimonials, proof points',
    market: 'Market segments, industries served, geographic markets, TAM/SAM, market trends',
    pricing: 'Pricing tiers, packaging, discount policies, billing terms, revenue model',
    competitor: 'Named competitors, competitive positioning, SWOT analysis, differentiation points',
    process: 'Internal workflows, SOPs, operational procedures, delivery processes',
    methodology: 'Frameworks, best practices, design systems, playbooks, reusable templates',
    metric: 'KPIs, benchmarks, performance data, OKRs, financial targets, success metrics',
    content_strategy: 'Content pillars, campaign history, editorial calendar, channel strategy',
    integration: 'Tools, platforms, tech stack, API connections, vendor relationships',
    policy: 'Company policies, compliance rules, HR guidelines, legal constraints, guardrails',
};

/* ─── System Types ────────────────────────────────────── */

export const WIKI_SYSTEM_TYPES = ['wiki_index', 'wiki_log'] as const;
export type WikiSystemType = (typeof WIKI_SYSTEM_TYPES)[number];

/* ─── Compile Result ──────────────────────────────────── */

export interface ExtractedEntity {
    type: WikiEntityType;
    title: string;
    content: Record<string, unknown>;
    confidence: number;
}

export interface ExtractedRelationship {
    fromTitle: string;
    toTitle: string;
    relationType: string;
}

export interface CompileResult {
    documentId: string;
    companyId: string;
    entitiesExtracted: number;
    entitiesCreated: number;
    entitiesUpdated: number;
    entitiesSkipped: number;
    edgesCreated: number;
    durationMs: number;
}

/* ─── Wiki Index ──────────────────────────────────────── */

export interface WikiIndexEntry {
    type: WikiEntityType;
    count: number;
    titles: string[];
}

export interface WikiIndex {
    companyId: string;
    totalNodes: number;
    typeBreakdown: WikiIndexEntry[];
    lastUpdated: string;
}

/* ─── Wiki Log ────────────────────────────────────────── */

export interface WikiLogEntry {
    action: 'compile' | 'lint' | 'backfill' | 'manual_edit';
    sourceDocumentId?: string;
    sourceDocumentName?: string;
    entitiesExtracted?: number;
    edgesCreated?: number;
    details?: string;
    timestamp: string;
}

/* ─── Wiki Health / Lint Report ───────────────────────── */

export interface WikiLintIssue {
    type: 'orphan' | 'stale' | 'gap' | 'low_confidence' | 'duplicate_suspect';
    severity: 'critical' | 'warning' | 'info';
    nodeId?: string;
    nodeTitle?: string;
    entityType?: WikiEntityType;
    description: string;
    suggestion: string;
}

export interface WikiHealthReport {
    companyId: string;
    totalNodes: number;
    totalEdges: number;
    coverageScore: number;
    issues: WikiLintIssue[];
    issueCounts: { critical: number; warning: number; info: number };
    generatedAt: string;
}

/* ─── Coverage Weights ────────────────────────────────── */

export const WIKI_COVERAGE_WEIGHTS: Record<WikiEntityType, number> = {
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

export const WIKI_EXPECTED_NODE_COUNTS: Record<WikiEntityType, number> = {
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
