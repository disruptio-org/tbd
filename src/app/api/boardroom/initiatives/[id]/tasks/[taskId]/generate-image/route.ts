import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { openai } from '@/lib/openai';

type RouteContext = { params: Promise<{ id: string; taskId: string }> };

/**
 * POST /api/boardroom/initiatives/[id]/tasks/[taskId]/generate-image
 * 
 * Generates a wireframe/design image using DALL-E 3 and stores it.
 * Body: { prompt: string, pageTitle: string }
 */
export async function POST(req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id, taskId } = await ctx.params;
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    // Verify initiative + task
    const { data: initiative } = await db
        .from('Initiative')
        .select('id, title, objective, workType')
        .eq('id', id)
        .eq('companyId', companyId)
        .maybeSingle();

    if (!initiative) return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });

    const { data: task } = await db
        .from('InitiativeTask')
        .select('id, title, description, outputSummary')
        .eq('id', taskId)
        .eq('initiativeId', id)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const body = await req.json();
    const { prompt, pageTitle } = body;

    if (!prompt?.trim()) {
        return NextResponse.json({ error: 'prompt is required' }, { status: 400 });
    }

    // Company context for better wireframes
    const { data: company } = await db
        .from('Company')
        .select('name')
        .eq('id', companyId)
        .maybeSingle();

    const { data: dna } = await db
        .from('CompanyDNA')
        .select('productsServices, targetAudience')
        .eq('companyId', companyId)
        .maybeSingle();

    const wireframePrompt = `Professional website wireframe mockup for "${pageTitle || 'webpage'}".
Company: ${company?.name || 'Tech Company'}
${dna?.productsServices ? `Products/Services: ${dna.productsServices}` : ''}
${dna?.targetAudience ? `Target Audience: ${dna.targetAudience}` : ''}

Design Instructions: ${prompt}

Style: Clean, modern, professional wireframe with a white/light gray background. 
Show clear layout structure with:
- Navigation bar, content sections, CTAs, and footer
- Use placeholder boxes for images with 'X' marks
- Use horizontal lines for text content
- Clear visual hierarchy with distinct sections
- Include representative UI elements (buttons, icons, forms)
- Professional, minimalist wireframe aesthetic
- Desktop viewport (1440px width ratio)`;

    try {
        const imageResponse = await openai.images.generate({
            model: 'dall-e-3',
            prompt: wireframePrompt,
            n: 1,
            size: '1024x1024',
            quality: 'standard',
            response_format: 'b64_json',
        });

        const b64 = imageResponse.data?.[0]?.b64_json;
        if (!b64) {
            return NextResponse.json({ error: 'No image generated' }, { status: 500 });
        }

        // Upload to Supabase storage
        const imageBuffer = Buffer.from(b64, 'base64');
        const fileName = `${companyId}/boardroom/${id}/${taskId}/${crypto.randomUUID()}.png`;

        // Ensure bucket exists
        const { data: buckets } = await db.storage.listBuckets();
        if (!buckets?.find((b: { name: string }) => b.name === 'documents')) {
            await db.storage.createBucket('documents', { public: false });
        }

        const { error: uploadError } = await db.storage
            .from('documents')
            .upload(fileName, imageBuffer, {
                contentType: 'image/png',
                upsert: false,
            });

        if (uploadError) {
            console.error('[generate-image] Upload error:', uploadError);
            return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 });
        }

        // Get public/signed URL
        const { data: urlData } = await db.storage
            .from('documents')
            .createSignedUrl(fileName, 60 * 60 * 24 * 365); // 1 year

        const imageUrl = urlData?.signedUrl || '';

        // Create artifact record
        const now = new Date().toISOString();
        const artifactId = crypto.randomUUID();

        await db.from('InitiativeArtifact').insert({
            id: artifactId,
            initiativeId: id,
            taskId: taskId,
            artifactType: 'image',
            title: pageTitle || 'Wireframe',
            content: prompt,
            contentUrl: imageUrl,
            storageKey: fileName,
            status: 'draft',
            createdAt: now,
            updatedAt: now,
        });

        // Log event
        await db.from('InitiativeEvent').insert({
            id: crypto.randomUUID(),
            initiativeId: id,
            taskId: taskId,
            actorType: 'ai_member',
            actorLabel: 'DALL-E 3',
            action: 'artifact_created',
            description: `Wireframe generated: "${pageTitle || 'Wireframe'}"`,
        });

        return NextResponse.json({
            success: true,
            artifact: {
                id: artifactId,
                title: pageTitle || 'Wireframe',
                contentUrl: imageUrl,
                storageKey: fileName,
            },
        });
    } catch (error) {
        console.error('[generate-image] Error:', error);
        return NextResponse.json({ error: 'Image generation failed' }, { status: 500 });
    }
}
