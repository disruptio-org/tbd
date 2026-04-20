import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { openai } from '@/lib/openai';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await params;
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Get project details
        const { data: project } = await db
            .from('Project')
            .select('name, description, contextText')
            .eq('id', id)
            .eq('companyId', dbUser.companyId)
            .single();

        if (!project) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        // Get project documents with extracted text
        const { data: docs } = await db
            .from('Document')
            .select('filename, extractedText')
            .eq('projectId', id)
            .eq('companyId', dbUser.companyId)
            .not('extractedText', 'is', null);

        if (!docs || docs.length === 0) {
            return NextResponse.json({ error: 'No processed documents found to generate context from. Please ensure documents are uploaded and OCR is processed.' }, { status: 400 });
        }

        const docTexts = docs
            .map(d => `--- Document: ${d.filename} ---\n${d.extractedText?.slice(0, 5000) || ''}`)
            .join('\n\n');

        const systemMessage = `You are an expert product and marketing strategist. Your task is to analyze the provided documents and write a comprehensive "Project Context" for a project named "${project.name}" (Description: ${project.description || 'N/A'}).

This context will be fed to an AI Assistant later to help the user generate marketing materials, sales pitches, and feature requirements.
Extract and synthesize the following:
- Core objective of the project
- Target audience or demographics
- Key value propositions or features
- Tone of voice or brand guidelines mentioned
- Any other critical constraints or details

Do not hallucinate. If information is not in the documents, omit that section. Write in a clear, highly-structured markdown format. DO NOT add chatty conversational filler (e.g. "Here is the context"). Output ONLY the finalized project context.`;

        const messages: any = [
            { role: 'system', content: systemMessage },
            { role: 'user', content: `Here are the documents for this project:\n\n${docTexts}` }
        ];

        const completion = await openai.chat.completions.create({
            model: 'gpt-5.4-mini',
            messages,
            temperature: 0.2, // Low temp for extraction/synthesis
            max_completion_tokens: 2000, // Long enough for comprehensive context
        });

        const generatedContext = completion.choices[0]?.message?.content?.trim();

        if (!generatedContext) {
            return NextResponse.json({ error: 'Failed to generate context from OpenAI' }, { status: 500 });
        }

        // Update project with the new context
        const { data: updatedProject, error } = await db
            .from('Project')
            .update({
                contextText: generatedContext,
                updatedAt: new Date().toISOString()
            })
            .eq('id', id)
            .eq('companyId', dbUser.companyId)
            .select('*')
            .single();

        if (error) {
            console.error('[Generate Context] Database update error:', error);
            return NextResponse.json({ error: 'Failed to update project context' }, { status: 500 });
        }

        return NextResponse.json({ project: updatedProject });

    } catch (error) {
        console.error('[Generate Context] CATCH error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
