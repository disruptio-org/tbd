import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth-guard';

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: artifactId } = await params;
    const db = createAdminClient();

    const { data: artifact, error: artErr } = await db.from('Artifact')
        .select('*')
        .eq('id', artifactId)
        .eq('companyId', auth.companyId)
        .single();

    if (artErr || !artifact) {
        return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    const { data: versions } = await db.from('ArtifactVersion')
        .select('*')
        .eq('artifactId', artifactId)
        .order('versionNumber', { ascending: true });

    return NextResponse.json({ artifact, versions: versions || [] });
}
