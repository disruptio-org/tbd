import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/tasks/[id]/documents — List documents linked to a task
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id } = await params;
    const db = createAdminClient();

    // Verify task belongs to user's company
    const { data: task } = await db
        .from('Task')
        .select('id, boardId')
        .eq('id', id)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    // Fetch linked documents via TaskDocument join table
    const { data: taskDocs } = await db
        .from('TaskDocument')
        .select('id, documentId, createdAt')
        .eq('taskId', id)
        .order('createdAt', { ascending: false });

    if (!taskDocs || taskDocs.length === 0) {
        return NextResponse.json({ documents: [] });
    }

    // Fetch document details
    const docIds = taskDocs.map(td => td.documentId);
    const { data: docs } = await db
        .from('Document')
        .select('id, filename, mimeType, size, storageKey, ocrStatus, createdAt')
        .in('id', docIds);

    const docsMap = Object.fromEntries((docs || []).map(d => [d.id, d]));

    const enriched = taskDocs.map(td => ({
        linkId: td.id,
        linkedAt: td.createdAt,
        ...(docsMap[td.documentId] || { id: td.documentId, filename: 'Unknown', mimeType: '', size: 0 }),
    }));

    return NextResponse.json({ documents: enriched });
}

/**
 * POST /api/tasks/[id]/documents — Upload & link a document to a task
 * Reuses the existing document upload logic, then creates a TaskDocument link.
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: taskId } = await params;
    const db = createAdminClient();

    // Verify task belongs to user's company
    const { data: task } = await db
        .from('Task')
        .select('id, boardId')
        .eq('id', taskId)
        .eq('companyId', auth.dbUser.companyId)
        .maybeSingle();

    if (!task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });

    // Get the board to find projectId
    const { data: board } = await db
        .from('TaskBoard')
        .select('projectId')
        .eq('id', task.boardId)
        .maybeSingle();

    const projectId = board?.projectId || null;

    // Handle file upload
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) {
        return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Create document record
    const safeName = file.name
        .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-zA-Z0-9._-]/g, '_');
    const storageKey = `${auth.dbUser.companyId}/${crypto.randomUUID()}-${safeName}`;
    const docId = crypto.randomUUID();

    const { data: doc, error: docErr } = await db.from('Document').insert({
        id: docId,
        companyId: auth.dbUser.companyId,
        projectId,
        filename: file.name,
        mimeType: file.type || 'application/octet-stream',
        size: file.size,
        storageKey,
        uploadedById: auth.dbUser.id,
        ocrProcessed: true,
        updatedAt: new Date().toISOString(),
    }).select().single();

    if (docErr || !doc) {
        return NextResponse.json({ error: 'Document save failed', detail: docErr?.message }, { status: 500 });
    }

    // Upload to storage
    const { data: buckets } = await db.storage.listBuckets();
    if (!buckets?.find((b: { name: string }) => b.name === 'documents')) {
        await db.storage.createBucket('documents', { public: false });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const { error: storageErr } = await db.storage
        .from('documents')
        .upload(storageKey, fileBuffer, {
            contentType: file.type || 'application/octet-stream',
            upsert: false,
        });

    if (storageErr) {
        console.error('[task-doc-upload] Storage error:', storageErr);
    }

    // Create TaskDocument link
    const { error: linkErr } = await db.from('TaskDocument').insert({
        id: crypto.randomUUID(),
        taskId,
        documentId: docId,
    });

    if (linkErr) {
        console.error('[task-doc-upload] Link error:', linkErr);
    }

    // Log activity
    await db.from('TaskActivity').insert({
        id: crypto.randomUUID(),
        taskId,
        actorId: auth.dbUser.id,
        action: 'document_attached',
        metadata: { filename: file.name, documentId: docId },
    });

    return NextResponse.json({
        linkId: crypto.randomUUID(),
        id: docId,
        filename: file.name,
        mimeType: file.type,
        size: file.size,
        createdAt: new Date().toISOString(),
    });
}

/**
 * DELETE /api/tasks/[id]/documents — Remove a document link (and optionally the document)
 * Query param: ?linkId=xxx or ?documentId=xxx
 */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id: taskId } = await params;
    const db = createAdminClient();

    const url = new URL(req.url);
    const documentId = url.searchParams.get('documentId');

    if (!documentId) {
        return NextResponse.json({ error: 'documentId required' }, { status: 400 });
    }

    // Remove the link
    await db.from('TaskDocument')
        .delete()
        .eq('taskId', taskId)
        .eq('documentId', documentId);

    // Log activity
    await db.from('TaskActivity').insert({
        id: crypto.randomUUID(),
        taskId,
        actorId: auth.dbUser.id,
        action: 'document_removed',
        metadata: { documentId },
    });

    return NextResponse.json({ success: true });
}
