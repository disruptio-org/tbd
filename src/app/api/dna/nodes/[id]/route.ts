/**
 * GET    /api/dna/nodes/:id — Single node with edges + source docs
 * PUT    /api/dna/nodes/:id — Manual edit (creates FeedbackEvent)
 * DELETE /api/dna/nodes/:id — Soft-delete (status → archived)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureFeedback } from '@/lib/feedback-processor';

export async function GET(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    // Get node
    const { data: node, error } = await db
        .from('KnowledgeNode')
        .select('*')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .single();

    if (error || !node) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Get edges (both directions)
    const { data: edgesFrom } = await db
        .from('KnowledgeEdge')
        .select('id, toNodeId, relationType, strength')
        .eq('fromNodeId', id);

    const { data: edgesTo } = await db
        .from('KnowledgeEdge')
        .select('id, fromNodeId, relationType, strength')
        .eq('toNodeId', id);

    // Resolve edge node titles
    const edgeNodeIds = [
        ...(edgesFrom || []).map(e => e.toNodeId),
        ...(edgesTo || []).map(e => e.fromNodeId),
    ];

    const { data: edgeNodes } = edgeNodeIds.length > 0
        ? await db.from('KnowledgeNode').select('id, title, type').in('id', edgeNodeIds)
        : { data: [] };

    const nodeMap = new Map((edgeNodes || []).map(n => [n.id, n]));

    const edges = [
        ...(edgesFrom || []).map(e => ({
            id: e.id,
            direction: 'outgoing' as const,
            relationType: e.relationType,
            strength: e.strength,
            node: nodeMap.get(e.toNodeId) || { id: e.toNodeId, title: 'Unknown', type: 'unknown' },
        })),
        ...(edgesTo || []).map(e => ({
            id: e.id,
            direction: 'incoming' as const,
            relationType: e.relationType,
            strength: e.strength,
            node: nodeMap.get(e.fromNodeId) || { id: e.fromNodeId, title: 'Unknown', type: 'unknown' },
        })),
    ];

    // Resolve source documents
    const sourceDocIds = Array.isArray(node.sourceDocumentIds) ? node.sourceDocumentIds : [];
    const regularIds = sourceDocIds.filter((id: string) => !id.startsWith('ext-') && id !== 'manual');
    const externalIds = sourceDocIds.filter((id: string) => id.startsWith('ext-')).map((id: string) => id.replace('ext-', ''));

    const { data: regularDocs } = regularIds.length > 0
        ? await db.from('Document').select('id, filename').in('id', regularIds)
        : { data: [] };

    const { data: externalDocs } = externalIds.length > 0
        ? await db.from('ExternalDocument').select('id, filename').in('id', externalIds)
        : { data: [] };

    const sourceDocs = [
        ...(regularDocs || []).map(d => ({ id: d.id, filename: d.filename, source: 'upload' })),
        ...(externalDocs || []).map(d => ({ id: `ext-${d.id}`, filename: d.filename, source: 'external' })),
        ...(sourceDocIds.includes('manual') ? [{ id: 'manual', filename: 'Manual entry', source: 'manual' }] : []),
    ];

    return NextResponse.json({ ...node, edges, sourceDocs });
}

export async function PUT(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();
    const body = await request.json();

    // Verify ownership
    const { data: existing } = await db
        .from('KnowledgeNode')
        .select('id, content, title')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .single();

    if (!existing) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Build update
    const update: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (body.title) update.title = body.title;
    if (body.content) update.content = body.content;
    if (body.summary) update.summary = body.summary;
    if (body.status) update.status = body.status;

    await db.from('KnowledgeNode').update(update).eq('id', id);

    // Capture feedback for learning
    if (body.content) {
        await captureFeedback(
            auth.dbUser.companyId,
            'manual_correction',
            JSON.stringify(existing.content),
            JSON.stringify(body.content),
            [id],
        );
    }

    return NextResponse.json({ success: true });
}

export async function DELETE(
    _request: NextRequest,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    // Soft-delete
    await db
        .from('KnowledgeNode')
        .update({ status: 'archived', updatedAt: new Date().toISOString() })
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId);

    return NextResponse.json({ success: true });
}
