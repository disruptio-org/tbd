import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createClient } from '@supabase/supabase-js';

// Route segment config for App Router — support large uploads
export const dynamic = 'force-dynamic';
export const maxDuration = 120;
export const fetchCache = 'force-no-store';

function getAdminDb() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    return createClient(url, key, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}

export async function POST(request: Request) {
    try {
        // 1. Auth check
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        // 2. Get admin DB
        const db = getAdminDb();

        // 3. Look up or create user
        const { data: existingUser, error: lookupErr } = await db
            .from('User')
            .select('*')
            .eq('email', user.email ?? '')
            .maybeSingle();

        console.log('[upload] DB user lookup:', existingUser?.id ?? 'NOT FOUND', 'err:', lookupErr?.message ?? 'none');

        let companyId: string;
        let userId: string;

        if (existingUser) {
            companyId = existingUser.companyId;
            userId = existingUser.id;
        } else {
            const name = user.user_metadata?.full_name ?? user.user_metadata?.name ?? (user.email ?? '').split('@')[0];

            const companyRes = await db.from('Company').insert({ id: crypto.randomUUID(), name: `${name}'s Company`, plan: 'starter' }).select().single();

            if (companyRes.error || !companyRes.data) {
                return NextResponse.json({
                    error: 'Company creation failed',
                    detail: companyRes.error?.message ?? 'No data returned',
                }, { status: 500 });
            }

            const userRes = await db.from('User').insert({
                id: user.id,
                companyId: companyRes.data.id,
                name,
                email: user.email,
                authProvider: user.app_metadata?.provider === 'google' ? 'GOOGLE' : 'EMAIL',
                avatarUrl: user.user_metadata?.avatar_url ?? null,
                role: 'ADMIN',
            }).select('*').single();

            if (userRes.error || !userRes.data) {
                return NextResponse.json({
                    error: 'User creation failed',
                    detail: userRes.error?.message ?? 'No data returned',
                }, { status: 500 });
            }

            companyId = userRes.data.companyId;
            userId = userRes.data.id;
        }

        // 4. Handle file
        const formData = await request.formData();
        const file = formData.get('file') as File | null;
        const folderId = formData.get('folderId') as string | null;
        const projectId = formData.get('projectId') as string | null;
        if (!file) {
            return NextResponse.json({ error: 'No file provided' }, { status: 400 });
        }

        // 5. Compute SHA-256 hash of file content
        const fileBuffer = Buffer.from(await file.arrayBuffer());
        const hashBuffer = await crypto.subtle.digest('SHA-256', fileBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        // 6. Check for existing document with same filename in this company
        const { data: existingDoc } = await db
            .from('Document')
            .select('id, hash, version, storageKey')
            .eq('companyId', companyId)
            .eq('filename', file.name)
            .maybeSingle();

        if (existingDoc) {
            if (existingDoc.hash === fileHash) {
                // Exact duplicate — reject
                return NextResponse.json(
                    { error: 'Duplicate document', detail: 'This exact file already exists (identical content).' },
                    { status: 409 }
                );
            }

            // Same filename, different content — version bump (update in-place)
            const newVersion = (existingDoc.version || 1) + 1;
            const safeName = file.name
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/[^a-zA-Z0-9._-]/g, '_');
            const newStorageKey = `${companyId}/${crypto.randomUUID()}-${safeName}`;

            // Upload new file to storage
            const { data: buckets } = await db.storage.listBuckets();
            if (!buckets?.find((b: { name: string }) => b.name === 'documents')) {
                await db.storage.createBucket('documents', { public: false });
            }
            const { error: storageErr } = await db.storage
                .from('documents')
                .upload(newStorageKey, fileBuffer, {
                    contentType: file.type || 'application/octet-stream',
                    upsert: false,
                });
            if (storageErr) {
                console.error('[upload] Storage error (version update):', storageErr);
            }

            // Delete old file from storage (best-effort)
            if (existingDoc.storageKey) {
                const oldKey = existingDoc.storageKey.startsWith('documents/')
                    ? existingDoc.storageKey.substring('documents/'.length)
                    : existingDoc.storageKey;
                await db.storage.from('documents').remove([oldKey]);
            }

            // Delete old embeddings
            await db.from('DocumentEmbedding').delete().eq('documentId', existingDoc.id);

            // Update the existing document record
            const { data: updatedDoc, error: updateErr } = await db
                .from('Document')
                .update({
                    size: file.size,
                    mimeType: file.type || 'application/octet-stream',
                    storageKey: newStorageKey,
                    hash: fileHash,
                    version: newVersion,
                    ocrProcessed: false,
                    ocrStatus: 'PENDING',
                    ocrError: null,
                    extractedText: null,
                    updatedAt: new Date().toISOString(),
                })
                .eq('id', existingDoc.id)
                .select()
                .single();

            if (updateErr || !updatedDoc) {
                return NextResponse.json({ error: 'Version update failed', detail: updateErr?.message }, { status: 500 });
            }

            console.log(`[upload] Version bump: ${file.name} → v${newVersion}`);
            return NextResponse.json(updatedDoc);
        }

        // 7. New document — insert record
        const safeName = file.name
            .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
            .replace(/[^a-zA-Z0-9._-]/g, '_');
        const storageKey = `${companyId}/${crypto.randomUUID()}-${safeName}`;
        const { data: doc, error: docErr } = await db.from('Document').insert({
            id: crypto.randomUUID(),
            companyId,
            folderId: folderId || null,
            projectId: projectId || null,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            size: file.size,
            storageKey,
            uploadedById: userId,
            hash: fileHash,
            version: 1,
            ocrStatus: 'PENDING',
            updatedAt: new Date().toISOString(),
        }).select().single();

        if (docErr || !doc) {
            return NextResponse.json({ error: 'Document save failed', detail: docErr?.message }, { status: 500 });
        }

        // 8. Ensure bucket exists, then upload file
        const { data: buckets } = await db.storage.listBuckets();
        if (!buckets?.find((b: { name: string }) => b.name === 'documents')) {
            await db.storage.createBucket('documents', { public: false });
        }

        const { error: storageErr } = await db.storage
            .from('documents')
            .upload(storageKey, fileBuffer, {
                contentType: file.type || 'application/octet-stream',
                upsert: false,
            });

        if (storageErr) {
            console.error('[upload] Storage error:', storageErr);
        } else {
            console.log('[upload] Stored:', storageKey);
        }

        return NextResponse.json(doc);
    } catch (error) {
        console.error('[upload] CATCH:', error);
        return NextResponse.json({ error: 'Upload failed', detail: String(error) }, { status: 500 });
    }
}

export async function GET(request: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            return NextResponse.json([]);
        }

        const db = getAdminDb();
        const { data: dbUser } = await db.from('User').select('companyId').eq('email', user.email ?? '').maybeSingle();

        if (!dbUser) {
            return NextResponse.json([]);
        }

        const url = new URL(request.url);
        const projectId = url.searchParams.get('projectId');

        let query = db
            .from('Document')
            .select('*')
            .eq('companyId', dbUser.companyId);

        if (projectId) {
            query = query.eq('projectId', projectId);
        }
        // If no projectId is provided, we now return ALL documents (both global and project-specific)
        // so that project documents show up in the main documents view.

        const { data } = await query
            .neq('filename', '__external_sentinel__')
            .order('createdAt', { ascending: false });

        return NextResponse.json(data ?? []);
    } catch (error) {
        console.error('[upload GET] CATCH:', error);
        return NextResponse.json([]);
    }
}
