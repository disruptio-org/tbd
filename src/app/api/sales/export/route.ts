import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { content, title, taskType } = await request.json();
        if (!content) return NextResponse.json({ error: 'Content is required' }, { status: 400 });

        const exportTitle = title || 'sales_content';
        const header = `${exportTitle}\nType: ${taskType || 'General'}\nGenerated: ${new Date().toLocaleDateString('pt-PT')}\n${'─'.repeat(50)}\n\n`;
        const txt = header + content;

        return new Response(txt, {
            status: 200,
            headers: {
                'Content-Type': 'text/plain; charset=utf-8',
                'Content-Disposition': `attachment; filename="${exportTitle.replace(/[^a-z0-9]/gi, '_').substring(0, 50)}.txt"`,
            },
        });
    } catch (err) {
        console.error('[/api/sales/export POST]', err);
        return NextResponse.json({ error: 'Export failed' }, { status: 500 });
    }
}
