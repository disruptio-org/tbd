/**
 * GET  /api/dna/resources — List resources with node counts
 * POST /api/dna/resources — Create a custom resource
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

    // Ensure DNA + default resources exist
    await ensureCompanyDNA(companyId);

    const { data: resources } = await db
        .from('Resource')
        .select('*')
        .eq('companyId', companyId)
        .order('createdAt', { ascending: true });

    // Count nodes per resource (by node type overlap) — scoped
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

    const typeCounts: Record<string, number> = {};
    for (const node of nodes || []) {
        typeCounts[node.type] = (typeCounts[node.type] || 0) + 1;
    }

    const enriched = (resources || []).map(r => {
        const nodeTypes = Array.isArray(r.nodeTypes) ? r.nodeTypes : [];
        const nodeCount = nodeTypes.reduce((sum: number, t: string) => sum + (typeCounts[t] || 0), 0);
        return { ...r, nodeCount };
    });

    return NextResponse.json(enriched);
}

export async function POST(request: NextRequest) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = auth.dbUser.companyId;
    const db = createAdminClient();
    const body = await request.json();

    const { data, error } = await db.from('Resource').insert({
        id: crypto.randomUUID(),
        companyId,
        name: body.name || 'New Resource',
        description: body.description || '',
        icon: body.icon || 'folder',
        nodeTypes: body.nodeTypes || [],
        isDefault: false,
        updatedAt: new Date().toISOString(),
    }).select().single();

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
}
