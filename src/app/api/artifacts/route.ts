import { NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth-guard';

export async function POST(req: Request) {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();
    const body = await req.json();
    const { sessionId, agentId, artifactType, title, metadata } = body;

    if (!sessionId || !agentId || !artifactType || !title) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    const artifactId = crypto.randomUUID();
    const now = new Date().toISOString();

    const { data: artifact, error } = await db.from('Artifact').insert({
        id: artifactId,
        companyId: auth.companyId,
        sessionId,
        agentId,
        artifactType,
        title: title.trim(),
        summary: null,
        currentVersionId: null,
        status: 'DRAFT',
        metadata: metadata || {},
        createdBy: auth.userId,
        createdAt: now,
        updatedAt: now,
    }).select('*').single();

    if (error) {
        console.error('[artifacts POST] Error:', error);
        return NextResponse.json({ error: 'Failed to create artifact' }, { status: 500 });
    }

    return NextResponse.json({ artifact }, { status: 201 });
}

export async function GET(req: Request) {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');

    const db = createAdminClient();
    let query = db.from('Artifact')
        .select('*, versions:ArtifactVersion(id, versionNumber, status, scopeType, createdAt)')
        .eq('companyId', auth.companyId)
        .order('createdAt', { ascending: false });

    if (sessionId) query = query.eq('sessionId', sessionId);

    const { data: artifacts, error } = await query;

    if (error) {
        console.error('[artifacts GET] Error:', error);
        return NextResponse.json({ error: 'Failed to fetch artifacts' }, { status: 500 });
    }

    return NextResponse.json({ artifacts: artifacts || [] });
}
