import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { getArtifact } from '@/lib/skills/artifact-manager';

/**
 * GET /api/skills/artifacts/[id]
 * Get a single artifact's metadata and signed download URL.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> },
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const artifact = await getArtifact(id, auth.dbUser.companyId);

    if (!artifact) {
        return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    return NextResponse.json({ artifact });
}
