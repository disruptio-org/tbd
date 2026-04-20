import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { requireAuth } from '@/lib/auth-guard';
import { orchestrate, type OrchestratorRequest } from '@/lib/assistant/orchestrator';

/**
 * POST /api/ai/members/[id]/chat
 * Member-scoped conversation endpoint.
 * Creates or continues an AssistantSession tied to this brainProfileId.
 *
 * Flow:
 *  1. Passes through the orchestrator for direct actions (navigate)
 *  2. For content-generation requests (everything else), forwards to
 *     the conversational chat pipeline so the member extracts params
 *     via friendly dialogue instead of returning dry interpretations.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
    const auth = await requireAuth(req);
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: memberId } = await params;
    const { message, sessionId, skillKey, projectId, messages: chatHistory, extractedParams, contentType, availableContentTypes, result, docIds } = await req.json();

    if (!message?.trim()) {
        return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const db = createAdminClient();

    // Load the brain profile
    const { data: brain, error: brainErr } = await db
        .from('AIBrainProfile')
        .select('id, name, brainType, configJson, advancedInstructions')
        .eq('id', memberId)
        .single();

    if (brainErr || !brain) {
        return NextResponse.json({ error: 'AI member not found' }, { status: 404 });
    }

    // Optionally load project context
    let projectName: string | undefined;
    if (projectId) {
        const { data: proj } = await db
            .from('Project')
            .select('name')
            .eq('id', projectId)
            .single();
        projectName = proj?.name;
    }

    // Optionally load attached document context
    let documentContext = '';
    if (docIds && Array.isArray(docIds) && docIds.length > 0) {
        const { data: docs } = await db
            .from('Document')
            .select('id, filename, extractedText')
            .in('id', docIds.slice(0, 5)); // limit to 5 docs
        if (docs && docs.length > 0) {
            const docTexts = docs
                .filter(d => d.extractedText)
                .map(d => `--- Document: ${d.filename} ---\n${(d.extractedText || '').substring(0, 4000)}`)
                .join('\n\n');
            if (docTexts) {
                documentContext = `\n\nThe user has attached the following documents for reference:\n${docTexts}`;
            }
        }
    }

    // Resolve or create session scoped to this member
    let activeSessionId = sessionId;

    if (!activeSessionId) {
        // Find most recent active session for this member, or create new
        const { data: existingSessions } = await db
            .from('AssistantSession')
            .select('id')
            .eq('userId', auth.userId)
            .eq('companyId', auth.companyId)
            .eq('brainProfileId', memberId)
            .eq('status', 'ACTIVE')
            .order('startedAt', { ascending: false })
            .limit(1);

        if (existingSessions && existingSessions.length > 0) {
            activeSessionId = existingSessions[0].id;
        }
    }

    // Build orchestrator request (with member context to bypass V2 routing)
    const orchReq: OrchestratorRequest = {
        sessionId: activeSessionId || undefined,
        message: (skillKey ? `[skill:${skillKey}] ` : '') + message + documentContext,
        inputMode: 'TEXT',
        pageContext: {
            route: `/ai-team/${memberId}`,
            objectId: projectId || memberId,
            objectType: projectId ? 'project' : 'ai_member',
            pageTitle: projectName ? `${brain.name} — ${projectName}` : brain.name,
        },
        memberContext: {
            memberId,
            brainType: brain.brainType,
        },
    };

    try {
        const result_orch = await orchestrate(orchReq, {
            userId: auth.userId,
            companyId: auth.companyId,
            email: auth.email,
            role: auth.role,
            projectId: projectId || undefined,
        });

        // Update the session's brainProfileId if it was created by the orchestrator
        if (result_orch.sessionId && !activeSessionId) {
            await db
                .from('AssistantSession')
                .update({ brainProfileId: memberId })
                .eq('id', result_orch.sessionId);
            activeSessionId = result_orch.sessionId;
        }

        // If the orchestrator executed a real action (navigation, etc.), return it
        if (result_orch.actionRun) {
            return NextResponse.json({
                sessionId: result_orch.sessionId,
                response: result_orch.assistantMessage,
                actionRun: result_orch.actionRun,
            });
        }

        // ── Orchestrator bypassed: forward to AI assistant chat pipeline ──
        // This gives the member a proper conversational flow for gathering
        // parameters and generating content, instead of dry interpretations.
        const chatMessages = chatHistory || [{ role: 'user', content: message }];
        const chatUrl = new URL('/api/ai-assistant/chat', req.url);
        const chatRes = await fetch(chatUrl.toString(), {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cookie': req.headers.get('cookie') || '',
            },
            body: JSON.stringify({
                assistantType: brain.brainType,
                messages: chatMessages,
                contentType: contentType || '',
                availableContentTypes: availableContentTypes || [],
                workspace: projectId ? { id: projectId, name: projectName } : null,
                extractedParams: extractedParams || {},
                result: result || null,
            }),
        });

        if (chatRes.ok) {
            const chatData = await chatRes.json();
            return NextResponse.json({
                sessionId: activeSessionId || result_orch.sessionId,
                response: chatData.reply || chatData.response || result_orch.assistantMessage,
                extractedParams: chatData.extractedParams || {},
                isReady: chatData.isReady || false,
                refinementAction: chatData.refinementAction || null,
            });
        }

        // If chat pipeline failed, return the orchestrator's pass-through
        return NextResponse.json({
            sessionId: result_orch.sessionId,
            response: result_orch.assistantMessage,
            actionRun: null,
        });

    } catch (orchErr) {
        console.error('[members/chat] Orchestrator error:', orchErr);

        // Fallback: simple acknowledgement
        const name = brain.name.split(' ')[0];
        const fallbackResponse = `Got it. I'll work on that. (${name} orchestrator is being connected.)`;

        return NextResponse.json({
            sessionId: activeSessionId || null,
            response: fallbackResponse,
        });
    }
}
