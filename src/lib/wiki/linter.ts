/**
 * Wiki Linter — Health checker for the company knowledge wiki.
 *
 * Detects: orphan nodes, stale content, coverage gaps, low confidence,
 * and suspected duplicates. Returns a structured health report.
 *
 * Designed to run on an automated schedule (e.g., daily CRON).
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { appendWikiLog } from './log';
import {
    WIKI_ENTITY_TYPES,
    WIKI_TYPE_LABELS,
    WIKI_EXPECTED_NODE_COUNTS,
    type WikiEntityType,
    type WikiLintIssue,
    type WikiHealthReport,
} from './types';

/**
 * Run a full lint of the wiki for a company.
 */
export async function lintWiki(companyId: string): Promise<WikiHealthReport> {
    const db = createAdminClient();
    const issues: WikiLintIssue[] = [];

    // Load all active wiki nodes (exclude system types)
    const { data: nodes } = await db
        .from('KnowledgeNode')
        .select('id, type, title, confidenceScore, sourceDocumentIds, updatedAt')
        .eq('companyId', companyId)
        .eq('status', 'active')
        .not('type', 'in', '("wiki_index","wiki_log")');

    // Load all edges
    const nodeIds = (nodes || []).map(n => n.id);
    let edges: { fromNodeId: string; toNodeId: string }[] = [];
    if (nodeIds.length > 0) {
        const { data: edgeData } = await db
            .from('KnowledgeEdge')
            .select('fromNodeId, toNodeId')
            .or(`fromNodeId.in.(${nodeIds.join(',')}),toNodeId.in.(${nodeIds.join(',')})`);
        edges = edgeData || [];
    }

    const totalNodes = (nodes || []).length;
    const totalEdges = edges.length;

    // 1. Orphan detection — nodes with no edges
    const connectedNodeIds = new Set<string>();
    for (const edge of edges) {
        connectedNodeIds.add(edge.fromNodeId);
        connectedNodeIds.add(edge.toNodeId);
    }

    for (const node of (nodes || [])) {
        if (!connectedNodeIds.has(node.id) && totalNodes > 3) {
            issues.push({
                type: 'orphan',
                severity: 'warning',
                nodeId: node.id,
                nodeTitle: node.title,
                entityType: node.type as WikiEntityType,
                description: `"${node.title}" has no connections to other knowledge nodes.`,
                suggestion: 'Re-process source documents or manually link this node to related entities.',
            });
        }
    }

    // 2. Coverage gaps — expected types with zero nodes
    const typeCounts: Record<string, number> = {};
    for (const node of (nodes || [])) {
        typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
    }

    for (const type of WIKI_ENTITY_TYPES) {
        const count = typeCounts[type] || 0;
        const expected = WIKI_EXPECTED_NODE_COUNTS[type];

        if (count === 0) {
            issues.push({
                type: 'gap',
                severity: 'critical',
                entityType: type,
                description: `No ${WIKI_TYPE_LABELS[type]} knowledge found.`,
                suggestion: `Upload documents containing ${WIKI_TYPE_LABELS[type].toLowerCase()} information to fill this gap.`,
            });
        } else if (count < Math.ceil(expected / 2)) {
            issues.push({
                type: 'gap',
                severity: 'warning',
                entityType: type,
                description: `Only ${count} ${WIKI_TYPE_LABELS[type]} node(s) — expected at least ${expected}.`,
                suggestion: `Upload more ${WIKI_TYPE_LABELS[type].toLowerCase()} documents to improve coverage.`,
            });
        }
    }

    // 3. Low confidence nodes
    for (const node of (nodes || [])) {
        if (node.confidenceScore < 0.5) {
            issues.push({
                type: 'low_confidence',
                severity: 'warning',
                nodeId: node.id,
                nodeTitle: node.title,
                entityType: node.type as WikiEntityType,
                description: `"${node.title}" has low confidence (${Math.round(node.confidenceScore * 100)}%).`,
                suggestion: 'Upload more detailed documents about this topic to improve extraction quality.',
            });
        }
    }

    // 4. Staleness check — nodes from source docs that were updated after compilation
    const sourceDocIds = new Set<string>();
    for (const node of (nodes || [])) {
        for (const id of (node.sourceDocumentIds || [])) {
            sourceDocIds.add(id);
        }
    }

    if (sourceDocIds.size > 0) {
        const { data: sourceDocs } = await db
            .from('Document')
            .select('id, updatedAt')
            .in('id', Array.from(sourceDocIds));

        if (sourceDocs) {
            const docUpdateMap: Record<string, string> = {};
            for (const doc of sourceDocs) {
                docUpdateMap[doc.id] = doc.updatedAt;
            }

            for (const node of (nodes || [])) {
                for (const docId of (node.sourceDocumentIds || [])) {
                    const docUpdated = docUpdateMap[docId];
                    if (docUpdated && new Date(docUpdated) > new Date(node.updatedAt)) {
                        issues.push({
                            type: 'stale',
                            severity: 'warning',
                            nodeId: node.id,
                            nodeTitle: node.title,
                            entityType: node.type as WikiEntityType,
                            description: `"${node.title}" may be outdated — source document was updated after this node was compiled.`,
                            suggestion: 'Re-process the source document to update this wiki page.',
                        });
                        break; // Only report once per node
                    }
                }
            }
        }
    }

    // 5. Suspected duplicates — nodes of same type with very similar titles
    const nodesByType: Record<string, { id: string; title: string }[]> = {};
    for (const node of (nodes || [])) {
        if (!nodesByType[node.type]) nodesByType[node.type] = [];
        nodesByType[node.type].push({ id: node.id, title: node.title });
    }

    for (const [type, typeNodes] of Object.entries(nodesByType)) {
        for (let i = 0; i < typeNodes.length; i++) {
            for (let j = i + 1; j < typeNodes.length; j++) {
                const a = typeNodes[i].title.toLowerCase().trim();
                const b = typeNodes[j].title.toLowerCase().trim();
                if (a.includes(b) || b.includes(a)) {
                    issues.push({
                        type: 'duplicate_suspect',
                        severity: 'info',
                        nodeId: typeNodes[i].id,
                        nodeTitle: `${typeNodes[i].title}" & "${typeNodes[j].title}`,
                        entityType: type as WikiEntityType,
                        description: `Suspected duplicate: "${typeNodes[i].title}" and "${typeNodes[j].title}" may refer to the same entity.`,
                        suggestion: 'Review and merge these nodes if they represent the same concept.',
                    });
                }
            }
        }
    }

    // Compute coverage score
    let coverageScore = 0;
    const weights: Record<string, number> = {};
    for (const type of WIKI_ENTITY_TYPES) {
        weights[type] = 1 / WIKI_ENTITY_TYPES.length; // Equal weight for lint
    }
    for (const type of WIKI_ENTITY_TYPES) {
        const count = typeCounts[type] || 0;
        const expected = WIKI_EXPECTED_NODE_COUNTS[type];
        coverageScore += weights[type] * Math.min(count / expected, 1.0);
    }

    // Count issues by severity
    const issueCounts = {
        critical: issues.filter(i => i.severity === 'critical').length,
        warning: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length,
    };

    const report: WikiHealthReport = {
        companyId,
        totalNodes,
        totalEdges,
        coverageScore: Math.round(coverageScore * 100) / 100,
        issues,
        issueCounts,
        generatedAt: new Date().toISOString(),
    };

    // Log the lint run
    try {
        const { data: dna } = await db
            .from('CompanyDNA')
            .select('id')
            .eq('companyId', companyId)
            .maybeSingle();

        if (dna) {
            await appendWikiLog(companyId, dna.id, {
                action: 'lint',
                details: `${issueCounts.critical} critical, ${issueCounts.warning} warnings, ${issueCounts.info} info — ${totalNodes} nodes, ${totalEdges} edges`,
                timestamp: report.generatedAt,
            });
        }
    } catch { /* non-critical */ }

    console.log(`[wiki/linter] Lint complete: ${issues.length} issues (${issueCounts.critical} critical, ${issueCounts.warning} warning)`);
    return report;
}
