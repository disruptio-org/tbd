import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { openai } from '@/lib/openai';

type RouteContext = { params: Promise<{ id: string }> };

/**
 * POST /api/boardroom/initiatives/[id]/discuss
 * Body: { message: string }
 * 
 * Chat with Company DNA about the initiative plan.
 * Returns the AI response for plan review/discussion.
 */
export async function POST(req: Request, ctx: RouteContext) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await ctx.params;
    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    // Fetch initiative + related data
    const { data: initiative } = await db
        .from('Initiative')
        .select('*')
        .eq('id', id)
        .eq('companyId', companyId)
        .maybeSingle();

    if (!initiative) {
        return NextResponse.json({ error: 'Initiative not found' }, { status: 404 });
    }

    const body = await req.json();
    const { message, history } = body;

    if (!message?.trim()) {
        return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }

    // Fetch tasks, workstreams, approvals for context
    const [
        { data: tasks },
        { data: workstreams },
        { data: approvals },
    ] = await Promise.all([
        db.from('InitiativeTask').select('title, description, assignedBrainType, requiredSkill, status, dependsOnTaskIds').eq('initiativeId', id).order('position'),
        db.from('InitiativeWorkstream').select('title, description, position, status').eq('initiativeId', id).order('position'),
        db.from('ApprovalRequest').select('gateType, title, description, status').eq('initiativeId', id),
    ]);

    // Company context
    const { data: company } = await db
        .from('Company')
        .select('name, webContext')
        .eq('id', companyId)
        .maybeSingle();

    // Build plan context
    const planContext = `
INITIATIVE: ${initiative.title}
OBJECTIVE: ${initiative.objective}
WORK TYPE: ${initiative.workType || 'Not classified'}
STATUS: ${initiative.status}
PRIORITY: ${initiative.priority}
PLAN SUMMARY: ${initiative.planSummary || 'N/A'}
BUSINESS GOAL: ${initiative.businessGoal || 'N/A'}
REQUESTED OUTCOME: ${initiative.requestedOutcome || 'N/A'}
CONFIDENCE SCORE: ${initiative.confidenceScore ?? 'N/A'}%

WORKSTREAMS:
${(workstreams || []).map((ws, i) => `${i + 1}. ${ws.title}${ws.description ? ' — ' + ws.description : ''}`).join('\n')}

TASKS:
${(tasks || []).map((t, i) => `${i + 1}. ${t.title} [${t.status}] → Assigned: ${t.assignedBrainType || 'Unassigned'}${t.requiredSkill ? ', Skill: ' + t.requiredSkill : ''}${t.description ? '\n   Description: ' + t.description : ''}`).join('\n')}

APPROVAL GATES:
${(approvals || []).map(a => `• ${a.title} (${a.gateType}) — ${a.status}${a.description ? ': ' + a.description : ''}`).join('\n')}
`.trim();

    const systemPrompt = `You are Company DNA, the strategic AI brain of ${company?.name || 'the company'}. 
You are reviewing an initiative plan with the executive team. 
You have full visibility into the plan details below.

${planContext}

Your role:
- Answer questions about the plan clearly and concisely
- Explain the reasoning behind task assignments, dependencies, and approval gates
- Suggest improvements if asked
- Help the user understand risks, timeline implications, and resource allocation
- If the user requests changes, acknowledge them and explain how they'd impact the plan
- Be direct, strategic, and professional

Keep responses concise (2-4 paragraphs max). Use uppercase labels for emphasis where appropriate.`;

    // Build message history
    const messages: { role: 'system' | 'user' | 'assistant'; content: string }[] = [
        { role: 'system', content: systemPrompt },
    ];

    // Include conversation history
    if (Array.isArray(history)) {
        for (const msg of history.slice(-8)) {
            messages.push({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content,
            });
        }
    }

    messages.push({ role: 'user', content: message.trim() });

    try {
        const completion = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages,
            temperature: 0.5,
            max_tokens: 1000,
        });

        const reply = completion.choices[0]?.message?.content || 'No response.';

        return NextResponse.json({ reply });
    } catch (error) {
        console.error('[boardroom/discuss] Error:', error);
        return NextResponse.json({ error: 'Failed to generate response' }, { status: 500 });
    }
}
