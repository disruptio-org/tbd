import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { callZapierTool } from '@/lib/mcpClient';

/**
 * POST /api/external-actions/execute — Execute an external action via Zapier MCP
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { actionId, params } = await request.json();

        if (!actionId) {
            return NextResponse.json({ error: 'actionId is required' }, { status: 400 });
        }

        const db = createAdminClient();

        // Load external action
        const { data: action, error: actionErr } = await db
            .from('ExternalAction')
            .select('id, companyId, integrationId, name, toolName, inputSchema')
            .eq('id', actionId)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (actionErr || !action) {
            return NextResponse.json({ error: 'Action not found' }, { status: 404 });
        }

        // Load integration to get MCP endpoint
        const { data: integration, error: intErr } = await db
            .from('CompanyIntegration')
            .select('id, config, isActive')
            .eq('id', action.integrationId)
            .maybeSingle();

        if (intErr || !integration) {
            return NextResponse.json({ error: 'Integration not found' }, { status: 404 });
        }
        if (!integration.isActive) {
            return NextResponse.json({ error: 'Integration is disabled' }, { status: 400 });
        }

        const config = typeof integration.config === 'string'
            ? JSON.parse(integration.config)
            : integration.config;

        const mcpEndpointUrl = config?.mcpEndpointUrl;
        if (!mcpEndpointUrl) {
            return NextResponse.json({ error: 'MCP endpoint not configured' }, { status: 500 });
        }

        console.log(`[external-actions/execute] Executing "${action.name}" (${action.toolName}) for company ${auth.dbUser.companyId}`);

        // Call Zapier MCP
        const result = await callZapierTool(mcpEndpointUrl, action.toolName, params || {});

        if (!result.success) {
            console.error(`[external-actions/execute] Failed:`, result.error);
            return NextResponse.json({ error: result.error || 'Execution failed' }, { status: 502 });
        }

        console.log(`[external-actions/execute] Success:`, JSON.stringify(result.result).substring(0, 200));

        return NextResponse.json({
            success: true,
            result: result.result,
            actionName: action.name,
        });
    } catch (error) {
        console.error('[external-actions/execute] Error:', error);
        return NextResponse.json({ error: 'Failed to execute action' }, { status: 500 });
    }
}
