import { NextResponse, type NextRequest } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth-guard';
import OpenAI from 'openai';

const MODEL = 'gpt-5.4';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: artifactId } = await params;
    const db = createAdminClient();
    const body = await req.json();
    const { prompt, scopeType, selectedArea, parentVersionId } = body;

    if (!prompt?.trim()) {
        return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

    // Load artifact
    const { data: artifact, error: artErr } = await db.from('Artifact')
        .select('*')
        .eq('id', artifactId)
        .eq('companyId', auth.companyId)
        .single();

    if (artErr || !artifact) {
        return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    // Load parent version output
    const parentId = parentVersionId || artifact.currentVersionId;
    let parentOutput = null;
    if (parentId) {
        const { data: parentVer } = await db.from('ArtifactVersion')
            .select('outputPayload, versionNumber')
            .eq('id', parentId).single();
        parentOutput = parentVer?.outputPayload;
    }

    // Count existing versions
    const { count } = await db.from('ArtifactVersion')
        .select('id', { count: 'exact', head: true })
        .eq('artifactId', artifactId);

    const versionNumber = (count || 0) + 1;
    const versionId = crypto.randomUUID();
    const scope = scopeType || 'global';

    // Create version record
    await db.from('ArtifactVersion').insert({
        id: versionId,
        artifactId,
        parentVersionId: parentId || null,
        versionNumber,
        prompt: prompt.trim(),
        scopeType: scope,
        selectedArea: selectedArea || null,
        status: 'GENERATING',
        createdAt: new Date().toISOString(),
    });

    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

        const openai = new OpenAI({ apiKey });
        const artMeta = (artifact.metadata || {}) as Record<string, unknown>;

        const scopeInstruction = scope === 'scoped' && selectedArea
            ? `SCOPED EDIT: Only modify the "${selectedArea}" section. Keep all other sections unchanged from the previous version.`
            : 'GLOBAL EDIT: Apply the refinement across the entire wireframe.';

        const systemPrompt = `You are refining an existing wireframe artifact.

Previous wireframe output:
${JSON.stringify(parentOutput, null, 2)}

${scopeInstruction}

User refinement request: "${prompt}"

Audience: ${artMeta.audience || 'general'}
Goal: ${artMeta.goal || 'inform'}

Return the complete updated wireframe JSON with the same structure.`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (openai as any).responses.create({
            model: MODEL,
            instructions: systemPrompt,
            input: prompt,
            temperature: 0.5,
            text: {
                format: {
                    type: 'json_schema',
                    name: 'wireframe_output',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: {
                            title: { type: 'string' },
                            summary: { type: 'string' },
                            platform: { type: 'string' },
                            sections: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        id: { type: 'string' },
                                        label: { type: 'string' },
                                        type: { type: 'string' },
                                        headline: { type: 'string' },
                                        subtext: { type: 'string' },
                                        ctas: { type: 'array', items: { type: 'string' } },
                                        items: { type: 'array', items: { type: 'string' } },
                                    },
                                    required: ['id', 'label', 'type', 'headline', 'subtext', 'ctas', 'items'],
                                    additionalProperties: false,
                                },
                            },
                            spec: {
                                type: 'object',
                                properties: {
                                    objective: { type: 'string' },
                                    primaryUser: { type: 'string' },
                                    threadBehavior: { type: 'string' },
                                    outputModel: { type: 'string' },
                                    iterationModel: { type: 'string' },
                                    versioning: { type: 'string' },
                                },
                                required: ['objective', 'primaryUser', 'threadBehavior', 'outputModel', 'iterationModel', 'versioning'],
                                additionalProperties: false,
                            },
                            annotations: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string' },
                                        note: { type: 'string' },
                                    },
                                    required: ['title', 'note'],
                                    additionalProperties: false,
                                },
                            },
                        },
                        required: ['title', 'summary', 'platform', 'sections', 'spec', 'annotations'],
                        additionalProperties: false,
                    },
                },
            },
        });

        const output = JSON.parse(response.output_text || '{}');

        // Update version with output
        await db.from('ArtifactVersion').update({
            outputPayload: output,
            previewPayload: { sections: output.sections, platform: output.platform },
            specPayload: output.spec,
            status: 'SUCCESS',
        }).eq('id', versionId);

        // Update artifact current version
        await db.from('Artifact').update({
            currentVersionId: versionId,
            summary: output.summary || artifact.summary,
            updatedAt: new Date().toISOString(),
        }).eq('id', artifactId);

        return NextResponse.json({
            version: {
                id: versionId,
                artifactId,
                versionNumber,
                prompt: prompt.trim(),
                scopeType: scope,
                selectedArea: selectedArea || null,
                outputPayload: output,
                previewPayload: { sections: output.sections, platform: output.platform },
                specPayload: output.spec,
                status: 'SUCCESS',
                createdAt: new Date().toISOString(),
            },
        });
    } catch (err) {
        console.error('[artifacts/iterate] Error:', err);
        await db.from('ArtifactVersion').update({ status: 'FAILED' }).eq('id', versionId);
        return NextResponse.json({ error: 'Iteration failed', details: String(err) }, { status: 500 });
    }
}
