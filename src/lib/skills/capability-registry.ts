/**
 * ═══════════════════════════════════════════════════════
 * Capability Registry — Platform-supported runtime capabilities
 * ═══════════════════════════════════════════════════════
 *
 * Static registry of all capabilities the Nousio runtime supports.
 * Used by the compatibility validator to determine what a skill can do.
 */

import type { CapabilityEntry, CapabilityId, CapabilityStatus } from './types';

const CAPABILITIES: CapabilityEntry[] = [
    { id: 'content_generation',       status: 'supported',   version: '1.0', description: 'Text content generation via OpenAI structured output' },
    { id: 'web_search',              status: 'supported',   version: '1.0', description: 'Web search via OpenAI web_search_preview tool' },
    { id: 'image_generation',        status: 'supported',   version: '1.0', description: 'Image generation via DALL-E 3' },
    { id: 'document_export_pdf',     status: 'supported',   version: '1.0', description: 'PDF document generation' },
    { id: 'document_export_docx',    status: 'supported',   version: '1.0', description: 'DOCX document generation via docx package' },
    { id: 'presentation_generation', status: 'supported',   version: '1.0', description: 'PPTX presentation generation via pptxgenjs' },
    { id: 'spreadsheet_generation',  status: 'supported',   version: '1.0', description: 'XLSX spreadsheet generation via xlsx package' },
    { id: 'chart_generation',        status: 'supported',   version: '1.0', description: 'Chart rendering as SVG/PNG' },
    { id: 'file_search',            status: 'planned',     version: '0.0', description: 'File search across uploaded documents (not yet available)' },
    { id: 'code_execution',         status: 'unsupported', version: '0.0', description: 'Sandboxed code execution (not supported)' },
    { id: 'connector_access',       status: 'supported',   version: '1.0', description: 'External system access via Zapier MCP / webhooks' },
];

const capabilityMap = new Map<string, CapabilityEntry>(
    CAPABILITIES.map(c => [c.id, c])
);

/**
 * Get a specific capability entry.
 */
export function getCapability(id: CapabilityId): CapabilityEntry | undefined {
    return capabilityMap.get(id);
}

/**
 * Check if a capability is currently supported.
 */
export function isCapabilitySupported(id: CapabilityId): boolean {
    const cap = capabilityMap.get(id);
    return cap?.status === 'supported';
}

/**
 * Get the status of a capability.
 */
export function getCapabilityStatus(id: CapabilityId): CapabilityStatus {
    return capabilityMap.get(id)?.status || 'unsupported';
}

/**
 * Get all registered capabilities.
 */
export function getAllCapabilities(): CapabilityEntry[] {
    return [...CAPABILITIES];
}

/**
 * Get all supported capability IDs.
 */
export function getSupportedCapabilities(): CapabilityId[] {
    return CAPABILITIES
        .filter(c => c.status === 'supported')
        .map(c => c.id);
}

/**
 * Given a list of required capabilities, return which are missing.
 */
export function findMissingCapabilities(required: CapabilityId[]): CapabilityId[] {
    return required.filter(id => !isCapabilitySupported(id));
}
