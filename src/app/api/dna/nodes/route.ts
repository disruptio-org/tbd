/**
 * GET  /api/dna/nodes — List knowledge nodes (with optional type/status filter)
 * POST /api/dna/nodes — Manually create a knowledge node
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { ensureCompanyDNA, upsertNode } from '@/lib/dna-builder';

export async function GET(request: NextRequest) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = auth.dbUser.companyId;
    const db = createAdminClient();
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const status = url.searchParams.get('status') || 'active';
    const projectId = url.searchParams.get('projectId');
    const customerId = url.searchParams.get('customerId');
    const scope = url.searchParams.get('scope'); // 'company' | 'customer' | 'project'

    let query = db
        .from('KnowledgeNode')
        .select('id, type, title, content, summary, confidenceScore, sourceDocumentIds, status, projectId, customerId, createdAt, updatedAt')
        .eq('companyId', companyId)
        .eq('status', status)
        .order('updatedAt', { ascending: false });

    if (type) {
        query = query.eq('type', type);
    }

    // Scope filtering
    if (scope === 'company') {
        query = query.is('projectId', null).is('customerId', null);
    } else if (scope === 'customer' && customerId) {
        query = query.eq('customerId', customerId);
    } else if (scope === 'project' && projectId) {
        query = query.eq('projectId', projectId);
    } else if (projectId) {
        query = query.eq('projectId', projectId);
    } else if (customerId) {
        query = query.eq('customerId', customerId);
    }

    const { data, error } = await query.limit(1000);

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data || []);
}

export async function POST(request: NextRequest) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = auth.dbUser.companyId;
    const body = await request.json();
    const { type, title, content } = body;

    if (!type || !title || !content) {
        return NextResponse.json({ error: 'type, title, and content are required' }, { status: 400 });
    }

    const dna = await ensureCompanyDNA(companyId);

    const result = await upsertNode(companyId, dna.id, {
        type,
        title,
        content,
        confidence: 0.9, // Manual entries get high confidence
        sourceDocumentId: 'manual',
    });

    return NextResponse.json(result, { status: 201 });
}
