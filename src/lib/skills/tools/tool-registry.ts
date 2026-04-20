/**
 * ═══════════════════════════════════════════════════════
 * Tool Registry — Platform-supported runtime tools
 * ═══════════════════════════════════════════════════════
 *
 * Central registry of tools available for skill execution.
 * Maps tool IDs to their handlers and schemas.
 */

import type { CapabilityId } from '../types';

export interface ToolDefinition {
    id: string;
    capabilityId: CapabilityId;
    name: string;
    description: string;
    status: 'active' | 'gated' | 'disabled';
    inputSchema: Record<string, unknown>;
    outputType: 'text' | 'artifact' | 'structured';
}

const TOOL_DEFINITIONS: ToolDefinition[] = [
    {
        id: 'web_search_preview',
        capabilityId: 'web_search',
        name: 'Web Search',
        description: 'Search the web for current information',
        status: 'active',
        inputSchema: {},
        outputType: 'text',
    },
    {
        id: 'image_gen_dalle',
        capabilityId: 'image_generation',
        name: 'DALL-E Image Generation',
        description: 'Generate images using DALL-E 3',
        status: 'active',
        inputSchema: {
            type: 'object',
            properties: {
                prompt: { type: 'string', description: 'Image generation prompt' },
                size: { type: 'string', enum: ['1024x1024', '1792x1024', '1024x1792'] },
            },
            required: ['prompt'],
        },
        outputType: 'artifact',
    },
    {
        id: 'pptx_export',
        capabilityId: 'presentation_generation',
        name: 'PPTX Export',
        description: 'Generate PowerPoint presentations',
        status: 'active',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                slides: { type: 'array' },
            },
            required: ['title', 'slides'],
        },
        outputType: 'artifact',
    },
    {
        id: 'docx_export',
        capabilityId: 'document_export_docx',
        name: 'DOCX Export',
        description: 'Generate Word documents',
        status: 'active',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                sections: { type: 'array' },
            },
            required: ['title', 'sections'],
        },
        outputType: 'artifact',
    },
    {
        id: 'xlsx_export',
        capabilityId: 'spreadsheet_generation',
        name: 'XLSX Export',
        description: 'Generate Excel spreadsheets',
        status: 'active',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                sheets: { type: 'array' },
            },
            required: ['title', 'sheets'],
        },
        outputType: 'artifact',
    },
    {
        id: 'pdf_export',
        capabilityId: 'document_export_pdf',
        name: 'PDF Export',
        description: 'Generate PDF documents',
        status: 'active',
        inputSchema: {
            type: 'object',
            properties: {
                title: { type: 'string' },
                content: { type: 'string' },
            },
            required: ['title', 'content'],
        },
        outputType: 'artifact',
    },
    {
        id: 'chart_render',
        capabilityId: 'chart_generation',
        name: 'Chart Renderer',
        description: 'Generate SVG/PNG charts from data',
        status: 'active',
        inputSchema: {
            type: 'object',
            properties: {
                chartType: { type: 'string' },
                labels: { type: 'array' },
                datasets: { type: 'array' },
            },
            required: ['chartType', 'labels', 'datasets'],
        },
        outputType: 'artifact',
    },
    {
        id: 'connector_call',
        capabilityId: 'connector_access',
        name: 'External Connector',
        description: 'Invoke external systems via Zapier MCP or webhooks',
        status: 'gated',
        inputSchema: {
            type: 'object',
            properties: {
                connectorId: { type: 'string' },
                action: { type: 'string' },
                params: { type: 'object' },
            },
            required: ['connectorId', 'action'],
        },
        outputType: 'structured',
    },
];

const toolMap = new Map<string, ToolDefinition>(
    TOOL_DEFINITIONS.map(t => [t.id, t])
);

/**
 * Get a tool definition by ID.
 */
export function getTool(id: string): ToolDefinition | undefined {
    return toolMap.get(id);
}

/**
 * Get all tools.
 */
export function getAllTools(): ToolDefinition[] {
    return [...TOOL_DEFINITIONS];
}

/**
 * Get tools available for a given set of capabilities.
 */
export function getToolsForCapabilities(capabilities: CapabilityId[]): ToolDefinition[] {
    const capSet = new Set(capabilities);
    return TOOL_DEFINITIONS.filter(t => capSet.has(t.capabilityId) && t.status !== 'disabled');
}

/**
 * Get OpenAI-compatible tool definitions for the Responses API.
 */
export function getOpenAITools(capabilities: CapabilityId[]): { type: string; [key: string]: unknown }[] {
    const tools: { type: string; [key: string]: unknown }[] = [];

    // Always include web_search if supported
    if (capabilities.includes('web_search')) {
        tools.push({ type: 'web_search_preview' });
    }

    // Image generation via DALL-E
    if (capabilities.includes('image_generation')) {
        tools.push({ type: 'image_generation' });
    }

    return tools;
}
