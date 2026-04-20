/**
 * POST /api/dna/process — Process all unprocessed documents for DNA extraction
 * Streams progress events back to the client.
 * Accepts optional scope filter: { scope: 'customer'|'project', customerId?, projectId? }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { processAllDocuments } from '@/lib/organizer';

export async function POST(request: NextRequest) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const companyId = auth.dbUser.companyId;

    // Parse optional scope from body
    let scopeCustomerId: string | undefined;
    let scopeProjectId: string | undefined;
    try {
        const body = await request.json();
        if (body.scope === 'customer' && body.customerId) scopeCustomerId = body.customerId;
        if (body.scope === 'project' && body.projectId) scopeProjectId = body.projectId;
    } catch {
        // No body or invalid JSON — process all (company-wide)
    }

    // Stream progress events
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
        async start(controller) {
            try {
                const result = await processAllDocuments(companyId, (event) => {
                    const line = JSON.stringify(event) + '\n';
                    controller.enqueue(encoder.encode(line));
                }, { customerId: scopeCustomerId, projectId: scopeProjectId });

                controller.enqueue(encoder.encode(JSON.stringify({
                    step: 'complete',
                    totalProcessed: result.totalProcessed,
                    totalEntities: result.totalEntities,
                    totalRelationships: result.totalRelationships,
                    coverageScore: result.coverageScore,
                }) + '\n'));
            } catch (err) {
                controller.enqueue(encoder.encode(JSON.stringify({
                    step: 'error',
                    detail: String(err),
                }) + '\n'));
            } finally {
                controller.close();
            }
        },
    });

    return new NextResponse(stream, {
        headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-cache',
        },
    });
}
