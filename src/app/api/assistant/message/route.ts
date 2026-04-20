import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { orchestrate, type OrchestratorRequest } from '@/lib/assistant/orchestrator';

/**
 * POST /api/assistant/message
 * Main orchestration endpoint for the Action Assistant.
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { sessionId, message, inputMode, pageContext, respondingToActionId, confirmAction } = body;

        if (!message?.trim() && confirmAction === undefined) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const req: OrchestratorRequest = {
            sessionId: sessionId || undefined,
            message: message?.trim() || '',
            inputMode: inputMode || 'TEXT',
            pageContext: pageContext || { route: '/dashboard' },
            respondingToActionId: respondingToActionId || undefined,
            confirmAction: confirmAction,
        };

        const result = await orchestrate(req, {
            userId: auth.dbUser.id,
            companyId: auth.dbUser.companyId,
            email: auth.dbUser.email,
            role: auth.dbUser.role,
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('[/api/assistant/message] Error:', error);
        return NextResponse.json({ error: 'Assistant request failed', detail: String(error) }, { status: 500 });
    }
}
