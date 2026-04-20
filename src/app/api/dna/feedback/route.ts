/**
 * POST /api/dna/feedback — Submit feedback from output edit
 * GET  /api/dna/feedback — List pending feedback events
 */

import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { captureFeedback, processFeedback } from '@/lib/feedback-processor';

export async function POST(request: NextRequest) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { sourceType, originalContent, editedContent, affectedNodeIds } = body;

    const feedbackId = await captureFeedback(
        auth.dbUser.companyId,
        sourceType || 'output_edit',
        originalContent || null,
        editedContent || null,
        affectedNodeIds || [],
    );

    // Process immediately (synchronous for now)
    const result = await processFeedback(feedbackId);

    return NextResponse.json({ feedbackId, ...result }, { status: 201 });
}

export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();

    const { data } = await db
        .from('FeedbackEvent')
        .select('*')
        .eq('companyId', auth.dbUser.companyId)
        .order('createdAt', { ascending: false })
        .limit(50);

    return NextResponse.json(data || []);
}
