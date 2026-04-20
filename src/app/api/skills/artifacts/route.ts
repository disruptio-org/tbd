import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { listRunArtifacts, deleteArtifact } from '@/lib/skills/artifact-manager';

/**
 * GET /api/skills/artifacts?runId=xxx
 * List all artifacts for a given skill run.
 */
export async function GET(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const runId = searchParams.get('runId');

    if (!runId) {
        return NextResponse.json({ error: 'runId is required' }, { status: 400 });
    }

    const artifacts = await listRunArtifacts(runId, auth.dbUser.companyId);
    return NextResponse.json({ artifacts });
}

/**
 * DELETE /api/skills/artifacts?id=xxx
 * Delete an artifact by ID.
 */
export async function DELETE(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const artifactId = searchParams.get('id');

    if (!artifactId) {
        return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const success = await deleteArtifact(artifactId, auth.dbUser.companyId);
    if (!success) {
        return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
}
