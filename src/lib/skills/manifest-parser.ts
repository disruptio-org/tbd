/**
 * ═══════════════════════════════════════════════════════
 * Manifest Parser — Skill package analysis and classification
 * ═══════════════════════════════════════════════════════
 *
 * Parses imported skill packages (.zip, .md, GitHub) into a SkillManifest.
 * Classifies files, detects runtime requirements, and derives capability needs.
 */

import type {
    SkillManifest,
    RuntimeCategory,
    ResponseMode,
    CapabilityId,
    ArtifactContract,
    UIContract,
    PackageFileEntry,
} from './types';

// ─── Pattern detectors ────────────────────────────────

interface PatternDetection {
    pattern: string;
    keywords: RegExp;
    capabilities: CapabilityId[];
    artifactType?: string;
    mimeType?: string;
    responseMode?: ResponseMode;
}

const PATTERN_DETECTIONS: PatternDetection[] = [
    {
        pattern: 'creates_slides',
        keywords: /\b(slides?|presentation|pptx|powerpoint|deck)\b/i,
        capabilities: ['presentation_generation'],
        artifactType: 'presentation',
        mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        responseMode: 'artifact_first',
    },
    {
        pattern: 'creates_documents',
        keywords: /\b(docx|word document|\.doc\b|create a document|generate document)\b/i,
        capabilities: ['document_export_docx'],
        artifactType: 'document',
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        responseMode: 'artifact_plus_chat',
    },
    {
        pattern: 'creates_pdf',
        keywords: /\b(pdf|generate pdf|export pdf|create pdf)\b/i,
        capabilities: ['document_export_pdf'],
        artifactType: 'pdf',
        mimeType: 'application/pdf',
        responseMode: 'artifact_first',
    },
    {
        pattern: 'creates_spreadsheet',
        keywords: /\b(xlsx|spreadsheet|excel|csv export|data table export)\b/i,
        capabilities: ['spreadsheet_generation'],
        artifactType: 'spreadsheet',
        mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        responseMode: 'artifact_first',
    },
    {
        pattern: 'uses_dalle',
        keywords: /\b(dall[-\s]?e|image[\s_-]?generat|create[\s_]?image|generate[\s_]?image|visual[\s_]?generat)\b/i,
        capabilities: ['image_generation'],
        artifactType: 'image',
        mimeType: 'image/png',
        responseMode: 'artifact_plus_chat',
    },
    {
        pattern: 'uses_browsing',
        keywords: /\b(web[\s_-]?search|browse|internet|search the web|look up online)\b/i,
        capabilities: ['web_search'],
    },
    {
        pattern: 'creates_charts',
        keywords: /\b(chart|graph|plot|histogram|bar chart|line chart|pie chart|visualization)\b/i,
        capabilities: ['chart_generation'],
        artifactType: 'chart',
        mimeType: 'image/svg+xml',
        responseMode: 'artifact_plus_chat',
    },
    {
        pattern: 'uses_file_search',
        keywords: /\b(file[\s_-]?search|search[\s_]?files|knowledge[\s_]?retrieval|document[\s_]?search)\b/i,
        capabilities: ['file_search'],
    },
    {
        pattern: 'uses_code_execution',
        keywords: /\b(code[\s_-]?interpreter|execute[\s_]?code|run[\s_]?code|sandbox|python[\s_]?sandbox)\b/i,
        capabilities: ['code_execution'],
    },
    {
        pattern: 'uses_connectors',
        keywords: /\b(api[\s_]?call|external[\s_-]?service|webhook|zapier|send[\s_]?email|slack[\s_]?message|crm)\b/i,
        capabilities: ['connector_access'],
        responseMode: 'action_result',
    },
    {
        pattern: 'uses_tools',
        keywords: /\b(tool[\s_-]?use|tool[\s_-]?call|function[\s_-]?call|invoke[\s_]?tool)\b/i,
        capabilities: [],
    },
];

// ─── File classification ──────────────────────────────

function classifyFile(path: string): PackageFileEntry['classification'] {
    const lower = path.toLowerCase();

    if (lower.endsWith('skill.md') || lower.includes('instructions')) return 'instructions';
    if (lower.includes('agents/') && (lower.endsWith('.yaml') || lower.endsWith('.yml'))) return 'metadata';
    if (lower.includes('references/')) return 'references';
    if (lower.includes('scripts/')) return 'execution_assets';
    if (lower.includes('templates/')) return 'templates';
    if (lower.includes('examples/')) return 'examples';
    if (lower.includes('resources/')) return 'executable_resources';
    if (lower.includes('ui/') || lower.includes('components/')) return 'ui_resources';

    // Fallback by extension
    if (lower.endsWith('.md') || lower.endsWith('.txt')) return 'references';
    if (lower.endsWith('.json') || lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'metadata';
    if (lower.endsWith('.ts') || lower.endsWith('.js') || lower.endsWith('.py')) return 'execution_assets';

    return 'unknown';
}

// ─── Runtime category derivation ──────────────────────

function deriveRuntimeCategory(detectedPatterns: string[]): RuntimeCategory {
    const hasArtifact = detectedPatterns.some(p =>
        p.startsWith('creates_')
    );
    const hasTool = detectedPatterns.some(p =>
        p.startsWith('uses_') && p !== 'uses_browsing'
    );
    const hasConnector = detectedPatterns.includes('uses_connectors');

    if (hasArtifact && hasTool) return 'hybrid';
    if (hasArtifact) return 'artifact-generation';
    if (hasConnector) return 'connector-workflow';
    if (hasTool) return 'tool-orchestrated';
    return 'content-generation';
}

/**
 * Parse a skill's instructions and package files into a full SkillManifest.
 */
export function parseSkillManifest(options: {
    key: string;
    name: string;
    description?: string;
    category?: string;
    instructions: string;
    packageFiles?: { path: string; content?: string; sizeBytes?: number }[];
    sourceFormat: 'zip' | 'md' | 'github';
}): SkillManifest {
    const { key, name, description, category, instructions, packageFiles = [], sourceFormat } = options;

    // Detect patterns from instructions
    const detectedPatterns: string[] = [];
    const requiredCapabilities: Set<CapabilityId> = new Set();
    const artifactContracts: ArtifactContract[] = [];
    const uiContracts: UIContract[] = [];
    let derivedResponseMode: ResponseMode = 'chat';

    // Always add content_generation
    requiredCapabilities.add('content_generation');

    for (const detection of PATTERN_DETECTIONS) {
        if (detection.keywords.test(instructions)) {
            detectedPatterns.push(detection.pattern);
            for (const cap of detection.capabilities) {
                requiredCapabilities.add(cap);
            }
            if (detection.artifactType && detection.mimeType) {
                // Avoid duplicates
                if (!artifactContracts.find(a => a.type === detection.artifactType)) {
                    artifactContracts.push({
                        type: detection.artifactType as ArtifactContract['type'],
                        mimeType: detection.mimeType,
                        description: `Auto-detected from skill instructions (pattern: ${detection.pattern})`,
                    });
                }
            }
            if (detection.responseMode) {
                // Higher-priority response modes win
                const priority: Record<string, number> = {
                    chat: 0,
                    action_result: 1,
                    artifact_plus_chat: 2,
                    artifact_first: 3,
                    ui_rendered: 4,
                    multi_output: 5,
                };
                if ((priority[detection.responseMode] || 0) > (priority[derivedResponseMode] || 0)) {
                    derivedResponseMode = detection.responseMode;
                }
            }
        }
    }

    // If multiple artifact types, upgrade to multi_output
    if (artifactContracts.length > 1) {
        derivedResponseMode = 'multi_output';
    }

    // Add UI intents based on artifacts
    for (const artifact of artifactContracts) {
        uiContracts.push({
            intent: 'show_preview',
            params: { artifactType: artifact.type },
        });
        uiContracts.push({
            intent: 'show_download',
            params: { artifactType: artifact.type, mimeType: artifact.mimeType },
        });
    }

    // Classify package files
    const classifiedFiles: PackageFileEntry[] = packageFiles.map(f => ({
        path: f.path,
        classification: classifyFile(f.path),
        content: f.content,
        sizeBytes: f.sizeBytes,
    }));

    // Separate training materials from classified files
    const trainingMaterials = classifiedFiles
        .filter(f =>
            ['references', 'examples', 'templates'].includes(f.classification) &&
            f.content
        )
        .map(f => ({
            id: crypto.randomUUID(),
            filename: f.path.split('/').pop() || f.path,
            textContent: (f.content || '').substring(0, 50000),
            uploadedAt: new Date().toISOString(),
        }));

    const runtimeCategory = deriveRuntimeCategory(detectedPatterns);

    return {
        key,
        name,
        description,
        category,
        primaryInstructions: instructions,
        rawInstructions: instructions,
        runtimeCategory,
        responseMode: derivedResponseMode,
        requiredCapabilities: [...requiredCapabilities],
        requiredConnectors: [],
        artifactContracts,
        uiContracts,
        packageFiles: classifiedFiles,
        trainingMaterials,
        detectedPatterns,
        sourceFormat,
    };
}
