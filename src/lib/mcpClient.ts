import { createAdminClient } from '@/lib/supabase/admin';

/**
 * Zapier MCP Client — discovers actions and executes tools.
 * 
 * Zapier's MCP uses Streamable HTTP transport:
 *   POST to endpoint with JSON-RPC body
 *   Accept: application/json, text/event-stream
 * 
 * The endpoint URL from Zapier is typically:
 *   https://mcp.zapier.com/api/v1/connect (with Bearer token)
 *   or a full URL with token as query param
 */

interface ZapierTool {
    name: string;
    description: string;
    inputSchema?: Record<string, unknown>;
}

/**
 * Parse SSE response text to extract JSON-RPC result.
 */
function parseSSEResponse(sseText: string): unknown | null {
    const lines = sseText.split('\n');
    for (const line of lines) {
        if (line.startsWith('data: ')) {
            try {
                return JSON.parse(line.slice(6));
            } catch { /* continue */ }
        }
    }
    return null;
}

/**
 * Send a JSON-RPC request to Zapier MCP endpoint.
 * Handles both direct JSON and SSE responses.
 */
async function mcpRequest(
    endpointUrl: string,
    method: string,
    params: Record<string, unknown> = {}
): Promise<{ result?: unknown; error?: string }> {
    try {
        // Parse the URL to extract token if present
        const url = new URL(endpointUrl);
        const token = url.searchParams.get('token');

        // Build headers — support both Bearer token and URL-embedded token
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            'Accept': 'application/json, text/event-stream',
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
            // Remove token from URL for the fetch call (it's in the header now)
            url.searchParams.delete('token');
        }

        const body = JSON.stringify({
            jsonrpc: '2.0',
            id: 1,
            method,
            params,
        });

        console.log(`[mcpClient] ${method} → ${url.origin}${url.pathname}`);

        const res = await fetch(url.toString(), {
            method: 'POST',
            headers,
            body,
        });

        if (!res.ok) {
            const text = await res.text().catch(() => '');
            return { error: `Zapier returned ${res.status}: ${res.statusText}. ${text.substring(0, 200)}` };
        }

        const contentType = res.headers.get('content-type') || '';

        // Handle SSE response
        if (contentType.includes('text/event-stream')) {
            const text = await res.text();
            const parsed = parseSSEResponse(text);
            if (parsed) return { result: parsed };
            return { error: 'Could not parse SSE response' };
        }

        // Handle direct JSON response
        const data = await res.json();
        if (data.error) {
            return { error: data.error.message || JSON.stringify(data.error) };
        }
        return { result: data.result || data };

    } catch (err) {
        return { error: `Connection failed: ${(err as Error).message}` };
    }
}

/**
 * Discover available Zapier actions from an MCP endpoint.
 */
export async function discoverZapierActions(mcpEndpointUrl: string): Promise<{
    tools: ZapierTool[];
    error?: string;
}> {
    const { result, error } = await mcpRequest(mcpEndpointUrl, 'tools/list');

    if (error) return { tools: [], error };

    // Extract tools from various response shapes
    const data = result as Record<string, unknown>;
    const tools = (data?.tools || (data as any)?.result?.tools || []) as ZapierTool[];

    return { tools };
}

/**
 * Execute a Zapier action via MCP.
 */
export async function executeZapierAction(
    mcpEndpointUrl: string,
    toolName: string,
    args: Record<string, unknown>
): Promise<{
    success: boolean;
    result?: string;
    error?: string;
}> {
    const { result, error } = await mcpRequest(mcpEndpointUrl, 'tools/call', {
        name: toolName,
        arguments: args,
    });

    if (error) return { success: false, error };

    const data = result as Record<string, unknown>;
    const content = (data?.content || []) as Array<{ type: string; text?: string }>;
    const textParts = content
        .filter(c => c.type === 'text')
        .map(c => c.text || '')
        .join('\n');

    if (data?.isError) {
        return { success: false, error: textParts || 'Action failed' };
    }

    return { success: true, result: textParts };
}

/**
 * Call a specific Zapier tool with parameters.
 * Used by the post-generation action execution flow.
 */
export async function callZapierTool(
    mcpEndpointUrl: string,
    toolName: string,
    params: Record<string, unknown>
): Promise<{ success: boolean; result?: unknown; error?: string }> {
    console.log(`[mcpClient] callZapierTool: ${toolName}`, Object.keys(params));

    const { result, error } = await mcpRequest(mcpEndpointUrl, 'tools/call', {
        name: toolName,
        arguments: params,
    });

    if (error) {
        console.error(`[mcpClient] Tool call failed:`, error);
        return { success: false, error };
    }

    // Detect JSON-RPC error in result (Zapier returns {jsonrpc, id, error})
    const rpcOuter = result as { jsonrpc?: string; error?: { message?: string; code?: number } };
    if (rpcOuter?.jsonrpc && rpcOuter?.error) {
        const errMsg = rpcOuter.error.message || JSON.stringify(rpcOuter.error);
        console.error(`[mcpClient] JSON-RPC error:`, errMsg);
        return { success: false, error: errMsg };
    }

    // Extract text from result
    const rpcResult = result as { result?: { content?: { type: string; text: string }[] } };
    const content = rpcResult?.result?.content;
    if (Array.isArray(content)) {
        const textParts = content
            .filter((c: { type: string }) => c.type === 'text')
            .map((c: { text: string }) => c.text);
        return { success: true, result: textParts.join('\n') };
    }

    return { success: true, result };
}

/**
 * Sync Zapier actions into ExternalAction catalog for a company.
 */
export async function syncZapierSkills(
    companyId: string,
    integrationId: string,
    mcpEndpointUrl: string
): Promise<{ imported: number; total: number; error?: string }> {
    const { tools, error } = await discoverZapierActions(mcpEndpointUrl);
    if (error) return { imported: 0, total: 0, error };

    const db = createAdminClient();
    const now = new Date().toISOString();

    // Update integration metadata
    await db.from('CompanyIntegration').update({
        lastSyncedAt: now,
        actionCount: tools.length,
        updatedAt: now,
    }).eq('id', integrationId);

    // Get existing external actions for this company
    const { data: existing } = await db
        .from('ExternalAction')
        .select('id, toolName')
        .eq('companyId', companyId);

    const existingTools = new Set((existing || []).map(a => a.toolName));

    let imported = 0;
    for (const tool of tools) {
        if (existingTools.has(tool.name)) continue;

        // Extract service app from tool name (e.g., "gmail_send_email" → "Gmail")
        const parts = tool.name.split('_');
        let serviceApp = 'Zapier';
        if (parts.length > 1) {
            serviceApp = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
            // Handle multi-word app names
            if (parts[0] === 'google' && parts.length > 2) serviceApp = 'Google ' + parts[1].charAt(0).toUpperCase() + parts[1].slice(1);
        }

        // Friendly display name
        const displayName = tool.name
            .replace(/^(gmail|google_sheets|slack|notion|hubspot)_/i, '')
            .replace(/_/g, ' ')
            .replace(/\b\w/g, c => c.toUpperCase());

        await db.from('ExternalAction').insert({
            id: crypto.randomUUID(),
            companyId,
            integrationId,
            name: displayName,
            description: tool.description || null,
            toolName: tool.name,
            serviceApp,
            inputSchema: tool.inputSchema || null,
            isActive: true,
            updatedAt: now,
        });
        imported++;
    }

    return { imported, total: tools.length };
}

