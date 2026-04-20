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
    const { prompt, metadata } = body;

    // Load artifact
    const { data: artifact, error: artErr } = await db.from('Artifact')
        .select('*')
        .eq('id', artifactId)
        .eq('companyId', auth.companyId)
        .single();

    if (artErr || !artifact) {
        return NextResponse.json({ error: 'Artifact not found' }, { status: 404 });
    }

    // Count existing versions
    const { count } = await db.from('ArtifactVersion')
        .select('id', { count: 'exact', head: true })
        .eq('artifactId', artifactId);

    const versionNumber = (count || 0) + 1;
    const versionId = crypto.randomUUID();
    const artMeta = (artifact.metadata || {}) as Record<string, unknown>;
    const merged = { ...artMeta, ...metadata };

    // Create version record in GENERATING state
    await db.from('ArtifactVersion').insert({
        id: versionId,
        artifactId,
        parentVersionId: artifact.currentVersionId || null,
        versionNumber,
        prompt: prompt || `Generate ${artifact.artifactType} for ${artifact.title}`,
        scopeType: 'initial',
        status: 'GENERATING',
        createdAt: new Date().toISOString(),
    });

    try {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

        const openai = new OpenAI({ apiKey });

        // Load company context
        const { data: profile } = await db.from('CompanyProfile')
            .select('companyName, productDescription, targetCustomers, brandVoice')
            .eq('companyId', auth.companyId).maybeSingle();

        // Retrieve wiki context for the artifact topic
        let wikiBlock = '';
        try {
            const { retrieveWikiContext } = await import('@/lib/wiki/retriever');
            const wikiResult = await retrieveWikiContext(auth.companyId, String(merged.topic || artifact.title), { maxPages: 5 });
            wikiBlock = wikiResult.formattedContext;
        } catch { /* wiki retrieval optional */ }

        const audience = String(merged.audience || 'general');
        const goal = String(merged.goal || 'inform');
        const topic = String(merged.topic || artifact.title);
        const platform = String(merged.platform || 'desktop');

        const artifactDraftType = String(merged.contentType || artifact.artifactType || 'draft');
        const systemPrompt = `You are a world-class expert working in the Nousio platform.
Company: ${profile?.companyName || 'Unknown'}
Product: ${profile?.productDescription || 'Not specified'}
Target customers: ${profile?.targetCustomers || 'Not specified'}
Brand voice: ${profile?.brandVoice || 'Professional'}
${wikiBlock}
Generate a detailed ${artifactDraftType} structure for: "${topic}"
Target audience: ${audience}
Goal: ${goal}
Platform: ${platform}

Return complete JSON with sections, headlines, subtext, CTAs, layout type, and design annotations. The JSON must exactly match the required schema.`;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (openai as any).responses.create({
            model: MODEL,
            instructions: systemPrompt,
            input: prompt || `Create a ${artifactDraftType} for ${topic}. Audience: ${audience}. Goal: ${goal}.`,
            temperature: 0.6,
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

        // Update artifact
        await db.from('Artifact').update({
            currentVersionId: versionId,
            title: output.title || artifact.title,
            summary: output.summary || null,
            status: 'GENERATED',
            metadata: merged,
            updatedAt: new Date().toISOString(),
        }).eq('id', artifactId);

        const version = {
            id: versionId,
            artifactId,
            parentVersionId: artifact.currentVersionId || null,
            versionNumber,
            prompt: prompt || `Generate ${artifact.artifactType} for ${artifact.title}`,
            scopeType: 'initial',
            outputPayload: output,
            previewPayload: { sections: output.sections, platform: output.platform },
            specPayload: output.spec,
            status: 'SUCCESS',
        };

        return NextResponse.json({ version, artifact: { ...artifact, currentVersionId: versionId, status: 'GENERATED', title: output.title || artifact.title, summary: output.summary } });
    } catch (err) {
        console.error('[artifacts/generate] Error:', err);

        await db.from('ArtifactVersion').update({ status: 'FAILED' }).eq('id', versionId);

        return NextResponse.json({ error: 'Generation failed', details: String(err) }, { status: 500 });
    }
}
