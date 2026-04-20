import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export async function GET(request: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId, role').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        // Get projects with their document counts
        let query = db
            .from('Project')
            .select(`
                id, name, description, contextText, customerId, status, createdAt, updatedAt,
                documents:Document ( id ),
                customer:Customer!customerId ( name )
            `)
            .eq('companyId', dbUser.companyId)
            .order('createdAt', { ascending: false });

        // For MEMBER users, apply project scope filtering from access groups
        if (dbUser.role === 'MEMBER') {
            const { resolveEffectiveAccess } = await import('@/lib/access-resolver');
            const access = await resolveEffectiveAccess(dbUser.id, dbUser.companyId);

            if (access.scopes.projects.mode === 'selected') {
                // Only return projects the user has access to
                if (access.scopes.projects.ids.length === 0) {
                    return NextResponse.json({ projects: [] });
                }
                query = query.in('id', access.scopes.projects.ids);
            }
            // mode === 'all' → no additional filtering needed
        }

        const { data: projects, error } = await query;

        if (error) {
            console.error('[projects GET] Error fetching projects:', error);
            return NextResponse.json({ error: 'Failed to fetch projects' }, { status: 500 });
        }

        // Map the result to include documentCount
        const formattedProjects = (projects as any[]).map(p => ({
            ...p,
            documentCount: p.documents?.length || 0,
            customerName: p.customer?.name || null,
            documents: undefined,
            customer: undefined,
        }));

        return NextResponse.json({ projects: formattedProjects });
    } catch (error) {
        console.error('[projects GET] Uncaught error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await request.json();
        const { name, description, contextText, customerId } = body;

        if (!name || !name.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const projectId = crypto.randomUUID();
        const now = new Date().toISOString();

        const { data: newProject, error } = await db
            .from('Project')
            .insert({
                id: projectId,
                companyId: dbUser.companyId,
                customerId: customerId || null,
                name: name.trim(),
                description: description?.trim() || null,
                contextText: contextText?.trim() || null,
                createdAt: now,
                updatedAt: now,
            })
            .select('*')
            .single();

        if (error) {
            console.error('[projects POST] Error creating project:', error);
            const errorMessage = typeof error === 'object' && error !== null && 'message' in error 
                                ? error.message 
                                : JSON.stringify(error);
            return NextResponse.json({ error: `Failed to create project: ${errorMessage}` }, { status: 500 });
        }

        return NextResponse.json({ project: newProject }, { status: 201 });
    } catch (error) {
        console.error('[projects POST] Uncaught error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
