/**
 * ═══════════════════════════════════════════════════════
 * Artifact Executor — Generates real file artifacts
 * ═══════════════════════════════════════════════════════
 *
 * Handles skills classified as 'artifact-generation'.
 * 1. Calls OpenAI to produce structured data for the artifact
 * 2. Feeds structured data into the appropriate generator
 * 3. Stores the generated file via artifact-manager
 * 4. Returns a ResultEnvelope with artifact references
 */

import OpenAI from 'openai';
import { createArtifact } from '../artifact-manager';
import { EnvelopeBuilder } from './result-envelope';
import type { ArtifactContract, ResultEnvelope, ArtifactType } from '../types';

const MODEL = 'gpt-5.4';

interface ArtifactExecOptions {
    companyId: string;
    userId: string;
    skillRunId: string;
    skillName: string;
    instructionPrompt: string;
    topic: string;
    language: string;
    companyContext: string;
    artifactContracts: ArtifactContract[];
    chainStepIndex?: number;
}

/**
 * Execute an artifact-generating skill.
 */
export async function executeArtifactSkill(options: ArtifactExecOptions): Promise<ResultEnvelope> {
    const {
        companyId,
        skillRunId,
        skillName,
        instructionPrompt,
        topic,
        language,
        companyContext,
        artifactContracts,
        chainStepIndex,
    } = options;

    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const openai = new OpenAI({ apiKey });
    const builder = new EnvelopeBuilder(
        artifactContracts.length > 1 ? 'multi_output' : 'artifact_first'
    );
    builder.setModel(MODEL);

    // For each expected artifact, generate structured data then file
    for (const contract of artifactContracts) {
        try {
            const structuredData = await generateStructuredDataForArtifact(
                openai, contract, instructionPrompt, topic, language, companyContext, skillName
            );

            const buffer = await generateArtifactFile(contract.type, structuredData);

            const artifactRef = await createArtifact({
                companyId,
                skillRunId,
                chainStepIndex,
                type: contract.type,
                buffer,
                mimeType: contract.mimeType,
                metadata: { generatedFrom: skillName, topic },
            });

            builder.addArtifact(artifactRef);
            builder.addUIIntent({
                intent: 'show_preview',
                artifactId: artifactRef.id,
                params: { artifactType: contract.type },
            });
            builder.addUIIntent({
                intent: 'show_download',
                artifactId: artifactRef.id,
                params: { filename: artifactRef.filename, mimeType: contract.mimeType },
            });
        } catch (err) {
            builder.addWarning(`Failed to generate ${contract.type} artifact: ${(err as Error).message}`);
        }
    }

    // Generate a summary message
    const artifactCount = builder.build().artifacts.length;
    if (artifactCount > 0) {
        builder.setMessage(
            `Generated ${artifactCount} artifact${artifactCount > 1 ? 's' : ''} for "${topic}".`
        );
    } else {
        builder.setFailed('No artifacts were successfully generated.');
    }

    return builder.build();
}

/**
 * Call OpenAI to produce structured data suitable for artifact generation.
 */
async function generateStructuredDataForArtifact(
    openai: OpenAI,
    contract: ArtifactContract,
    instructions: string,
    topic: string,
    language: string,
    companyContext: string,
    skillName: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
): Promise<any> {
    const schemaByType = getOutputSchemaForType(contract.type);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (openai as any).responses.create({
        model: MODEL,
        instructions: `You are an AI assistant executing skill "${skillName}".
Your task is to produce structured data that will be used to generate a ${contract.type} file.

${instructions}

${companyContext}

IMPORTANT: Output ONLY the structured JSON that matches the schema. Write in ${language}.`,
        input: `Topic: ${topic}\nOutput type: ${contract.type}`,
        temperature: 0.6,
        text: {
            format: {
                type: 'json_schema',
                name: `artifact_${contract.type}`,
                strict: true,
                schema: schemaByType,
            },
        },
    });

    const raw = response.output_text || '{}';
    return JSON.parse(raw);
}

/**
 * Get the JSON schema for structured output based on artifact type.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getOutputSchemaForType(type: ArtifactType): any {
    switch (type) {
        case 'presentation':
            return {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    subtitle: { type: 'string' },
                    slides: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                title: { type: 'string' },
                                content: { type: 'string' },
                                notes: { type: 'string' },
                                layout: { type: 'string' },
                            },
                            required: ['title', 'content', 'notes', 'layout'],
                            additionalProperties: false,
                        },
                    },
                    summary: { type: 'string' },
                },
                required: ['title', 'subtitle', 'slides', 'summary'],
                additionalProperties: false,
            };

        case 'document':
            return {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    sections: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                heading: { type: 'string' },
                                content: { type: 'string' },
                                level: { type: 'string' },
                            },
                            required: ['heading', 'content', 'level'],
                            additionalProperties: false,
                        },
                    },
                    summary: { type: 'string' },
                },
                required: ['title', 'sections', 'summary'],
                additionalProperties: false,
            };

        case 'spreadsheet':
            return {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    sheets: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                headers: { type: 'array', items: { type: 'string' } },
                                rows: {
                                    type: 'array',
                                    items: { type: 'array', items: { type: 'string' } },
                                },
                            },
                            required: ['name', 'headers', 'rows'],
                            additionalProperties: false,
                        },
                    },
                    summary: { type: 'string' },
                },
                required: ['title', 'sheets', 'summary'],
                additionalProperties: false,
            };

        case 'chart':
            return {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    chartType: { type: 'string' },
                    labels: { type: 'array', items: { type: 'string' } },
                    datasets: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                label: { type: 'string' },
                                data: { type: 'array', items: { type: 'string' } },
                                color: { type: 'string' },
                            },
                            required: ['label', 'data', 'color'],
                            additionalProperties: false,
                        },
                    },
                    summary: { type: 'string' },
                },
                required: ['title', 'chartType', 'labels', 'datasets', 'summary'],
                additionalProperties: false,
            };

        default:
            // Generic text-based
            return {
                type: 'object',
                properties: {
                    title: { type: 'string' },
                    content: { type: 'string' },
                    summary: { type: 'string' },
                },
                required: ['title', 'content', 'summary'],
                additionalProperties: false,
            };
    }
}

/**
 * Generate the actual file buffer from structured data.
 * Dynamically imports generators to avoid loading all libs upfront.
 */
async function generateArtifactFile(type: ArtifactType, data: unknown): Promise<Buffer> {
    switch (type) {
        case 'presentation': {
            const { generatePptx } = await import('../tools/generators/pptx-generator');
            return generatePptx(data as Parameters<typeof generatePptx>[0]);
        }
        case 'document': {
            const { generateDocx } = await import('../tools/generators/docx-generator');
            return generateDocx(data as Parameters<typeof generateDocx>[0]);
        }
        case 'spreadsheet': {
            const { generateXlsx } = await import('../tools/generators/xlsx-generator');
            return generateXlsx(data as Parameters<typeof generateXlsx>[0]);
        }
        case 'pdf': {
            // For PDFs, generate a DOCX first, or use a simple text-to-PDF approach
            const { generateDocx } = await import('../tools/generators/docx-generator');
            return generateDocx(data as Parameters<typeof generateDocx>[0]);
        }
        case 'chart': {
            const { generateChart } = await import('../tools/generators/chart-generator');
            return generateChart(data as Parameters<typeof generateChart>[0]);
        }
        default: {
            // Fallback: serialize as JSON
            return Buffer.from(JSON.stringify(data, null, 2), 'utf-8');
        }
    }
}
