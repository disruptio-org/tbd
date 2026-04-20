/**
 * ═══════════════════════════════════════════════════════
 * Compatibility Validator — Skill compatibility assessment
 * ═══════════════════════════════════════════════════════
 *
 * Validates a skill's runtime requirements against the platform's
 * current capability set and tenant-specific configuration.
 * Produces a CompatibilityReport used at import, publish, and runtime.
 */

import type {
    SkillManifest,
    CompatibilityReport,
    CompatibilityIssue,
    CompatibilityState,
    CapabilityId,
    ArtifactType,
} from './types';
import {
    isCapabilitySupported,
    getCapabilityStatus,
    getSupportedCapabilities,
    findMissingCapabilities,
} from './capability-registry';

// Artifact types the platform can generate
const SUPPORTED_ARTIFACT_TYPES: Set<ArtifactType> = new Set([
    'presentation',
    'document',
    'spreadsheet',
    'pdf',
    'image',
    'zip',
    'chart',
    'structured_ui',
]);

/**
 * Validate a skill manifest against the platform's current capabilities.
 * Optionally pass tenant-specific context (active connectors, etc.).
 */
export function validateCompatibility(
    manifest: SkillManifest,
    tenantContext?: {
        activeConnectorIds?: string[];
        activeIntegrationSlugs?: string[];
    },
): CompatibilityReport {
    const issues: CompatibilityIssue[] = [];
    const recommendations: string[] = [];

    // ── 1. Capability validation ──────────────────────
    const missingCapabilities = findMissingCapabilities(manifest.requiredCapabilities);

    for (const capId of missingCapabilities) {
        const status = getCapabilityStatus(capId);
        issues.push({
            category: 'capability',
            id: capId,
            description: `Required capability "${capId}" is ${status}`,
            severity: status === 'planned' ? 'degrading' : 'blocking',
        });

        if (status === 'planned') {
            recommendations.push(`Capability "${capId}" is planned for a future release. The skill can run in degraded mode.`);
        } else {
            recommendations.push(`Capability "${capId}" is not supported. Consider importing in degraded mode.`);
        }
    }

    // ── 2. Artifact type validation ────────────────────
    const supportedArtifactTypes: ArtifactType[] = [];
    const unsupportedArtifactTypes: ArtifactType[] = [];

    for (const contract of manifest.artifactContracts) {
        if (SUPPORTED_ARTIFACT_TYPES.has(contract.type)) {
            supportedArtifactTypes.push(contract.type);
        } else {
            unsupportedArtifactTypes.push(contract.type);
            issues.push({
                category: 'artifact',
                id: contract.type,
                description: `Artifact type "${contract.type}" (${contract.mimeType}) is not supported`,
                severity: 'degrading',
            });
        }
    }

    // ── 3. Connector validation ───────────────────────
    const missingConnectors: string[] = [];
    if (manifest.requiredConnectors.length > 0 && tenantContext) {
        const activeIds = new Set([
            ...(tenantContext.activeConnectorIds || []),
            ...(tenantContext.activeIntegrationSlugs || []),
        ]);
        for (const connectorId of manifest.requiredConnectors) {
            if (!activeIds.has(connectorId)) {
                missingConnectors.push(connectorId);
                issues.push({
                    category: 'connector',
                    id: connectorId,
                    description: `Required connector "${connectorId}" is not configured for this workspace`,
                    severity: 'degrading',
                });
            }
        }
    }

    // ── 4. UI intent validation ───────────────────────
    for (const uiContract of manifest.uiContracts) {
        // All UI intents in the registry are supported for now
        // Future: check tenant feature flags
    }

    // ── 5. Tool dependency analysis ───────────────────
    const toolPatterns = manifest.detectedPatterns.filter(p => p.startsWith('uses_'));
    for (const pattern of toolPatterns) {
        if (pattern === 'uses_code_execution') {
            issues.push({
                category: 'tool',
                id: 'code_execution',
                description: 'Skill expects sandboxed code execution which is not available',
                severity: 'blocking',
            });
        }
        if (pattern === 'uses_file_search') {
            issues.push({
                category: 'tool',
                id: 'file_search',
                description: 'File search across uploaded documents is planned but not yet available',
                severity: 'degrading',
            });
        }
    }

    // ── 6. Compute final state ────────────────────────
    const blockingIssues = issues.filter(i => i.severity === 'blocking');
    const degradingIssues = issues.filter(i => i.severity === 'degrading');

    let state: CompatibilityState;
    if (blockingIssues.length > 0) {
        state = 'INCOMPATIBLE';
    } else if (degradingIssues.length > 0) {
        state = 'COMPATIBLE_DEGRADED';
    } else {
        state = 'FULLY_COMPATIBLE';
    }

    // Score: 100 = fully compatible, 0 = nothing works
    const totalRequirements = manifest.requiredCapabilities.length +
        manifest.artifactContracts.length +
        manifest.requiredConnectors.length;
    const blockedCount = blockingIssues.length;
    const degradedCount = degradingIssues.length;
    const score = totalRequirements > 0
        ? Math.round(((totalRequirements - blockedCount - degradedCount * 0.5) / totalRequirements) * 100)
        : 100;

    return {
        state,
        score: Math.max(0, Math.min(100, score)),
        issues,
        supportedCapabilities: getSupportedCapabilities().filter(c =>
            manifest.requiredCapabilities.includes(c) && isCapabilitySupported(c)
        ),
        missingCapabilities,
        supportedArtifactTypes,
        unsupportedArtifactTypes,
        missingConnectors,
        recommendations,
    };
}

/**
 * Quick check: can a skill run in the current environment?
 * Returns the compatibility state without a full report.
 */
export function quickCompatibilityCheck(
    requiredCapabilities: CapabilityId[],
): CompatibilityState {
    const missing = findMissingCapabilities(requiredCapabilities);
    if (missing.length === 0) return 'FULLY_COMPATIBLE';

    const hasBlocking = missing.some(id => getCapabilityStatus(id) === 'unsupported');
    return hasBlocking ? 'INCOMPATIBLE' : 'COMPATIBLE_DEGRADED';
}
