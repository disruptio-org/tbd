/**
 * GET /api/dna — Returns Company DNA overview for current user's company
 * Accepts optional scope: ?scope=customer&customerId=X or ?scope=project&projectId=X
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureCompanyDNA } from '@/lib/dna-builder';

export async function GET(request: NextRequest) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = auth.dbUser.companyId;
    const db = createAdminClient();

    // Parse scope params
    const url = new URL(request.url);
    const scope = url.searchParams.get('scope');
    const customerId = url.searchParams.get('customerId');
    const projectId = url.searchParams.get('projectId');

    // Ensure DNA exists
    const dna = await ensureCompanyDNA(companyId);

    // Get full DNA record
    const { data: dnaRecord } = await db
        .from('CompanyDNA')
        .select('*')
        .eq('id', dna.id)
        .single();

    // Count nodes by type — scoped
    let nodeQuery = db
        .from('KnowledgeNode')
        .select('type')
        .eq('companyId', companyId)
        .eq('status', 'active');

    // Apply scope filter
    if (scope === 'company') {
        nodeQuery = nodeQuery.is('projectId', null).is('customerId', null);
    } else if (scope === 'customer' && customerId) {
        nodeQuery = nodeQuery.eq('customerId', customerId);
    } else if (scope === 'project' && projectId) {
        nodeQuery = nodeQuery.eq('projectId', projectId);
    }

    const { data: nodes } = await nodeQuery;

    const nodesByType: Record<string, number> = {};
    for (const node of nodes || []) {
        nodesByType[node.type] = (nodesByType[node.type] || 0) + 1;
    }

    // Compute scoped coverage
    const expectedTypes = ['product', 'persona', 'process', 'competitor', 'messaging', 'policy', 'case_study', 'market', 'pricing', 'content_strategy', 'metric', 'methodology', 'integration'];
    const coveredCount = expectedTypes.filter(t => (nodesByType[t] || 0) > 0).length;
    const scopedCoverage = expectedTypes.length > 0 ? coveredCount / expectedTypes.length : 0;

    return NextResponse.json({
        id: dnaRecord?.id,
        version: dnaRecord?.version || 1,
        coverageScore: (scope && scope !== 'company') ? scopedCoverage : (dnaRecord?.coverageScore || 0),
        lastProcessedAt: dnaRecord?.lastProcessedAt,
        nodeCount: (nodes || []).length,
        nodesByType,
    });
}
