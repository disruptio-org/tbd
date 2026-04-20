import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/tasks/[id]/checklists — Fetch all checklists + items for a task
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    const { data: task } = await db.from('Task').select('id').eq('id', id).eq('companyId', auth.dbUser.companyId).maybeSingle();
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const { data: checklists } = await db
        .from('TaskChecklist')
        .select('*')
        .eq('taskId', id)
        .order('position', { ascending: true });

    const checklistIds = (checklists || []).map(c => c.id);
    let items: Record<string, unknown>[] = [];
    if (checklistIds.length > 0) {
        const { data } = await db
            .from('TaskChecklistItem')
            .select('*')
            .in('checklistId', checklistIds)
            .order('position', { ascending: true });
        items = data || [];
    }

    // Group items by checklist
    const itemsByChecklist: Record<string, unknown[]> = {};
    for (const item of items) {
        const cid = item.checklistId as string;
        if (!itemsByChecklist[cid]) itemsByChecklist[cid] = [];
        itemsByChecklist[cid].push(item);
    }

    const result = (checklists || []).map(cl => ({
        ...cl,
        items: itemsByChecklist[cl.id] || [],
    }));

    return NextResponse.json({ checklists: result });
}

/**
 * POST /api/tasks/[id]/checklists — Create a new checklist
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    const { data: task } = await db.from('Task').select('id').eq('id', id).eq('companyId', auth.dbUser.companyId).maybeSingle();
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const { title } = await req.json();
    if (!title?.trim()) return NextResponse.json({ error: 'title is required' }, { status: 400 });

    // Get max position
    const { data: existing } = await db.from('TaskChecklist').select('position').eq('taskId', id).order('position', { ascending: false }).limit(1);
    const nextPos = (existing && existing.length > 0 ? existing[0].position : -1) + 1;

    const checklistId = crypto.randomUUID();
    await db.from('TaskChecklist').insert({
        id: checklistId,
        taskId: id,
        title: title.trim(),
        position: nextPos,
    });

    // Log activity
    await db.from('TaskActivity').insert({
        id: crypto.randomUUID(),
        taskId: id,
        actorId: auth.dbUser.id,
        action: 'checklist_added',
        metadata: { title: title.trim() },
    });

    return NextResponse.json({
        checklist: { id: checklistId, taskId: id, title: title.trim(), position: nextPos, items: [] },
    });
}

/**
 * PUT /api/tasks/[id]/checklists — Update a checklist item (toggle, rename, etc.)
 * Body: { checklistId, itemId?, action: 'rename_checklist'|'delete_checklist'|'add_item'|'toggle_item'|'rename_item'|'delete_item', ... }
 */
export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    const { data: task } = await db.from('Task').select('id').eq('id', id).eq('companyId', auth.dbUser.companyId).maybeSingle();
    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    const body = await req.json();
    const { action, checklistId, itemId, title, isChecked } = body;

    switch (action) {
        case 'rename_checklist': {
            if (!checklistId || !title?.trim()) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
            await db.from('TaskChecklist').update({ title: title.trim() }).eq('id', checklistId);
            break;
        }
        case 'delete_checklist': {
            if (!checklistId) return NextResponse.json({ error: 'Missing checklistId' }, { status: 400 });
            await db.from('TaskChecklistItem').delete().eq('checklistId', checklistId);
            await db.from('TaskChecklist').delete().eq('id', checklistId);
            break;
        }
        case 'add_item': {
            if (!checklistId || !title?.trim()) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
            const { data: existing } = await db.from('TaskChecklistItem').select('position').eq('checklistId', checklistId).order('position', { ascending: false }).limit(1);
            const nextPos = (existing && existing.length > 0 ? existing[0].position : -1) + 1;
            const itemIdNew = crypto.randomUUID();
            await db.from('TaskChecklistItem').insert({
                id: itemIdNew,
                checklistId,
                title: title.trim(),
                isChecked: false,
                position: nextPos,
            });
            return NextResponse.json({ item: { id: itemIdNew, checklistId, title: title.trim(), isChecked: false, position: nextPos } });
        }
        case 'toggle_item': {
            if (!itemId) return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
            await db.from('TaskChecklistItem').update({ isChecked: !!isChecked }).eq('id', itemId);
            break;
        }
        case 'rename_item': {
            if (!itemId || !title?.trim()) return NextResponse.json({ error: 'Missing params' }, { status: 400 });
            await db.from('TaskChecklistItem').update({ title: title.trim() }).eq('id', itemId);
            break;
        }
        case 'delete_item': {
            if (!itemId) return NextResponse.json({ error: 'Missing itemId' }, { status: 400 });
            await db.from('TaskChecklistItem').delete().eq('id', itemId);
            break;
        }
        default:
            return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
}
