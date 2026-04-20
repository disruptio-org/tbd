import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/marketing/export
 * Export marketing content to TXT.
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { content, title, contentType } = await request.json();

        if (!content) {
            return NextResponse.json({ error: 'Content is required' }, { status: 400 });
        }

        // Also try loading from draft if draftId provided
        const { draftId } = await request.json().catch(() => ({ draftId: null }));
        let exportContent = content;
        let exportTitle = title || 'marketing_content';

        if (draftId && !content) {
            const db = createAdminClient();
            const { data: draft } = await db
                .from('MarketingDraft')
                .select('title, content')
                .eq('id', draftId)
                .eq('companyId', auth.dbUser.companyId)
                .maybeSingle();

            if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
            exportContent = draft.content;
            exportTitle = draft.title;
        }

        const header = `${exportTitle}\nType: ${contentType || 'General'}\nGenerated: ${new Date().toLocaleDateString('pt-PT')}\n${'─'.repeat(50)}\n\n`;
        const txt = header + exportContent;

        return new Response(txt, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="${exportTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.txt"`,
            },
        });
    } catch (err) {
        console.error('[/api/marketing/export POST]', err);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}
