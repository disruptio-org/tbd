/**
 * ═══════════════════════════════════════════════════════
 * Nousio Skill Runtime — Core Type Definitions
 * ═══════════════════════════════════════════════════════
 *
 * These types define the ChatGPT-compatible skill runtime model.
 * They are used across import, execution, artifact handling,
 * chain orchestration, and frontend rendering.
 */

// ─── Enums ────────────────────────────────────────────

export type RuntimeCategory =
    | 'content-generation'
    | 'tool-orchestrated'
    | 'artifact-generation'
    | 'ui-rendering'
    | 'connector-workflow'
    | 'hybrid';

export type ResponseMode =
    | 'chat'
    | 'artifact_first'
    | 'artifact_plus_chat'
    | 'ui_rendered'
    | 'action_result'
    | 'multi_output';

export type ImportMode =
    | 'LEGACY'        // Pre-runtime skills (backward compat)
    | 'PRESERVED'     // Raw instructions kept as-is
    | 'COMPATIBLE'    // Adapted with runtime metadata preserved
    | 'DEGRADED';     // Flattened to content-only prompt

export type CompatibilityState =
    | 'FULLY_COMPATIBLE'
    | 'COMPATIBLE_DEGRADED'
    | 'INCOMPATIBLE'
    | 'UNKNOWN';

// ─── Capabilities ─────────────────────────────────────

export type CapabilityId =
    | 'content_generation'
    | 'web_search'
    | 'image_generation'
    | 'document_export_pdf'
    | 'document_export_docx'
    | 'presentation_generation'
    | 'spreadsheet_generation'
    | 'chart_generation'
    | 'file_search'
    | 'code_execution'
    | 'connector_access';

export type CapabilityStatus = 'supported' | 'planned' | 'unsupported';

export interface CapabilityEntry {
    id: CapabilityId;
    status: CapabilityStatus;
    version: string;
    description: string;
}

// ─── Artifact Contracts ───────────────────────────────

export type ArtifactType =
    | 'presentation'
    | 'document'
    | 'spreadsheet'
    | 'pdf'
    | 'image'
    | 'zip'
    | 'chart'
    | 'structured_ui';

export interface ArtifactContract {
    type: ArtifactType;
    mimeType: string;
    description: string;
}

export interface ArtifactRef {
    id: string;
    type: ArtifactType;
    mimeType: string;
    filename: string;
    storagePath: string;
    downloadUrl?: string;
    previewUrl?: string;
    sizeBytes?: number;
    metadata?: Record<string, unknown>;
}

// ─── UI Contracts & Intents ───────────────────────────

export type UIIntentType =
    | 'show_preview'
    | 'open_artifact'
    | 'render_gallery'
    | 'render_chart'
    | 'open_editor'
    | 'show_download'
    | 'show_action_result';

export interface UIContract {
    intent: UIIntentType;
    params?: Record<string, unknown>;
}

export interface UIIntent {
    intent: UIIntentType;
    artifactId?: string;
    params?: Record<string, unknown>;
}

// ─── Skill Manifest ───────────────────────────────────

export interface PackageFileEntry {
    path: string;
    classification: 'instructions' | 'metadata' | 'references' | 'execution_assets' | 'templates' | 'examples' | 'executable_resources' | 'ui_resources' | 'unknown';
    content?: string;
    sizeBytes?: number;
}

export interface SkillManifest {
    // Identity
    key: string;
    name: string;
    description?: string;
    category?: string;

    // Instructions
    primaryInstructions: string;
    rawInstructions: string;

    // Runtime classification
    runtimeCategory: RuntimeCategory;
    responseMode: ResponseMode;

    // Requirements
    requiredCapabilities: CapabilityId[];
    requiredConnectors: string[];
    artifactContracts: ArtifactContract[];
    uiContracts: UIContract[];

    // Package contents
    packageFiles: PackageFileEntry[];
    trainingMaterials: { id: string; filename: string; textContent: string; uploadedAt: string }[];

    // Metadata
    detectedPatterns: string[];        // e.g. 'uses_dalle', 'creates_slides', 'uses_browsing'
    sourceFormat: 'zip' | 'md' | 'github';
}

// ─── Compatibility Report ─────────────────────────────

export interface CompatibilityIssue {
    category: 'capability' | 'connector' | 'artifact' | 'ui' | 'tool';
    id: string;
    description: string;
    severity: 'blocking' | 'degrading' | 'informational';
}

export interface CompatibilityReport {
    state: CompatibilityState;
    score: number;                     // 0-100
    issues: CompatibilityIssue[];
    supportedCapabilities: CapabilityId[];
    missingCapabilities: CapabilityId[];
    supportedArtifactTypes: ArtifactType[];
    unsupportedArtifactTypes: ArtifactType[];
    missingConnectors: string[];
    recommendations: string[];
}

// ─── Execution Trace ──────────────────────────────────

export interface ToolInvocation {
    toolId: string;
    input: Record<string, unknown>;
    output: Record<string, unknown>;
    durationMs: number;
    status: 'success' | 'error';
    error?: string;
    artifactProduced?: string;         // artifactId if tool produced an artifact
}

export interface ConnectorInvocation {
    connectorId: string;
    action: string;
    input: Record<string, unknown>;
    output?: Record<string, unknown>;
    durationMs: number;
    status: 'success' | 'error';
    error?: string;
}

export interface ExecutionTraceStep {
    step: number;
    action: string;                     // 'capability_check' | 'tool_call' | 'model_call' | 'artifact_generation' | 'connector_call'
    detail: string;
    durationMs?: number;
    status: 'success' | 'error' | 'skipped' | 'degraded';
    data?: Record<string, unknown>;
}

export interface ExecutionTrace {
    steps: ExecutionTraceStep[];
    capabilityCheckResult: CompatibilityState;
    degradationDecisions: DegradationDecision[];
    toolInvocations: ToolInvocation[];
    connectorInvocations: ConnectorInvocation[];
    totalDurationMs: number;
}

// ─── Degradation ──────────────────────────────────────

export interface DegradationDecision {
    capability: string;
    reason: string;
    substitution: string;              // What was done instead
    semanticallyIncomplete: boolean;
}

export interface DegradationReport {
    isDegraded: boolean;
    decisions: DegradationDecision[];
    summary: string;
}

// ─── Result Envelope ──────────────────────────────────

export interface Citation {
    url: string;
    title: string;
    snippet?: string;
}

export interface ActionResult {
    actionId: string;
    actionName: string;
    status: 'success' | 'error' | 'skipped';
    detail?: string;
}

export interface ExecutionMeta {
    durationMs: number;
    modelUsed: string;
    tokensUsed?: number;
    toolCalls: number;
    connectorCalls: number;
    artifactsProduced: number;
}

export interface ResultEnvelope {
    responseMode: ResponseMode;
    assistantMessage?: string;
    artifacts: ArtifactRef[];
    uiIntents: UIIntent[];
    executionMeta: ExecutionMeta;
    warnings: string[];
    actionResults: ActionResult[];
    citations: Citation[];
    status: 'success' | 'degraded' | 'failed';
    degradationReport?: DegradationReport;
    executionTrace?: ExecutionTrace;
}

// ─── Chain State ──────────────────────────────────────

export interface ChainStepState {
    skillKey: string;
    skillName: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
    input: {
        text?: string;
        structuredData?: Record<string, unknown>;
        artifactRefs?: ArtifactRef[];
        metadata?: Record<string, unknown>;
    };
    output?: {
        text?: string;
        structuredData?: Record<string, unknown>;
        artifacts?: ArtifactRef[];
        uiIntents?: UIIntent[];
        metadata?: Record<string, unknown>;
    };
    compatibilityState?: CompatibilityState;
    degradationDecisions?: DegradationDecision[];
    durationMs?: number;
    error?: string;
}

export interface ChainResult {
    chainId: string;
    status: 'completed' | 'partial' | 'failed';
    steps: ChainStepState[];
    finalEnvelope: ResultEnvelope;
    totalDurationMs: number;
}
