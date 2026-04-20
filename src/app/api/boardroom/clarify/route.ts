import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { openai } from '@/lib/openai';

/**
 * POST /api/boardroom/clarify — Pre-planning clarification step
 * Body: { command: string, projectId?: string }
 * 
 * Returns 3-5 clarifying questions that help the planner produce
 * a more detailed and actionable execution plan.
 */
export async function POST(req: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await req.json();
        const { command, projectId } = body;

        if (!command?.trim()) {
            return NextResponse.json({ error: 'command is required' }, { status: 400 });
        }

        const db = createAdminClient();
        const companyId = auth.dbUser.companyId;

        // Gather minimal context for question generation
        let companyContext = '';
        const { data: company } = await db
            .from('Company')
            .select('name, website, webContext')
            .eq('id', companyId)
            .maybeSingle();

        if (company) {
            companyContext += `Company: ${company.name}\n`;
            if (company.webContext) companyContext += `About: ${company.webContext}\n`;
        }

        let projectContext = '';
        if (projectId) {
            const { data: project } = await db
                .from('Project')
                .select('name, description, customerId')
                .eq('id', projectId)
                .eq('companyId', companyId)
                .maybeSingle();

            if (project) {
                projectContext = `Project: ${project.name}`;
                if (project.description) projectContext += `\nDescription: ${project.description}`;

                if (project.customerId) {
                    const { data: customer } = await db
                        .from('Customer')
                        .select('name, industry')
                        .eq('id', project.customerId)
                        .maybeSingle();
                    if (customer) {
                        projectContext += `\nCustomer: ${customer.name}`;
                        if (customer.industry) projectContext += ` (${customer.industry})`;
                    }
                }
            }
        }

        // Get team capabilities summary
        const { data: brains } = await db
            .from('AIBrainProfile')
            .select('name, brainType')
            .eq('companyId', companyId)
            .eq('isEnabled', true);

        const teamSummary = (brains || [])
            .map(b => `${b.name} (${b.brainType})`)
            .join(', ');

        const systemPrompt = `You are Company DNA — the executive AI brain for a company. Before generating an execution plan, you ask smart clarifying questions to ensure the plan is specific and actionable.

COMPANY CONTEXT:
${companyContext}
${projectContext ? `\nPROJECT: ${projectContext}` : ''}
${teamSummary ? `\nAVAILABLE TEAM: ${teamSummary}` : ''}

The user has given a command. You need to ask 3-5 clarifying questions that will help you produce a better plan. Focus on:
1. SPECIFICS that affect scope (e.g., "What pages should the website have?")
2. BRAND/STYLE preferences (e.g., "Do you have brand colors, fonts, or reference sites?")
3. TARGET AUDIENCE details (e.g., "Who is the primary audience for this?")
4. DELIVERABLE FORMAT (e.g., "What format do you expect — mockups, code, document?")
5. SUCCESS CRITERIA (e.g., "How will you measure success?")

DO NOT ask obvious questions or repeat information already in the context.
Each question should have a short label, the question text, and an optional placeholder/hint.

Respond with valid JSON ONLY:
{
  "questions": [
    {
      "id": "q1",
      "label": "Short label (2-4 words)",
      "question": "The full question text",
      "placeholder": "Example answer or hint",
      "required": true
    }
  ]
}`;

        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: `USER COMMAND: ${command.trim()}` },
            ],
            temperature: 0.5,
            max_tokens: 1500,
            response_format: { type: 'json_object' },
        });

        const raw = completion.choices[0]?.message?.content;
        if (!raw) {
            return NextResponse.json({ error: 'Empty AI response' }, { status: 500 });
        }

        const parsed = JSON.parse(raw);
        return NextResponse.json({
            questions: parsed.questions || [],
            command: command.trim(),
            projectId: projectId || null,
        });
    } catch (error) {
        console.error('[boardroom/clarify] Error:', error);
        return NextResponse.json({ error: 'Failed to generate questions' }, { status: 500 });
    }
}
