import { NextResponse } from 'next/server';
import { requireCompanyAdmin } from '@/lib/require-company-admin';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/company/users — List users in the current company.
 * Query params: search, role, status, groupId
 */
export async function GET(request: Request) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    try {
        const url = new URL(request.url);
        const search = url.searchParams.get('search')?.trim();
        const role = url.searchParams.get('role');
        const status = url.searchParams.get('status');
        const groupId = url.searchParams.get('groupId');

        const db = createAdminClient();

        let query = db
            .from('User')
            .select('id, name, email, role, status, avatarUrl, createdAt, updatedAt')
            .eq('companyId', auth.dbUser.companyId)
            .order('createdAt', { ascending: false });

        if (search) {
            query = query.or(`name.ilike.%${search}%,email.ilike.%${search}%`);
        }
        if (role) {
            query = query.eq('role', role);
        }
        if (status) {
            query = query.eq('status', status);
        }

        const { data: users, error: usersErr } = await query;
        if (usersErr) throw usersErr;

        // If filtering by group, load memberships and filter in-memory
        let filteredUsers = users || [];
        if (groupId) {
            const { data: memberships } = await db
                .from('AccessGroupMembership')
                .select('userId')
                .eq('accessGroupId', groupId)
                .eq('companyId', auth.dbUser.companyId);

            const memberUserIds = new Set((memberships || []).map((m: { userId: string }) => m.userId));
            filteredUsers = filteredUsers.filter((u: { id: string }) => memberUserIds.has(u.id));
        }

        // Load group memberships for all users (to show in the table)
        const userIds = filteredUsers.map((u: { id: string }) => u.id);
        let userGroups: Record<string, { id: string; name: string }[]> = {};

        if (userIds.length > 0) {
            const { data: allMemberships } = await db
                .from('AccessGroupMembership')
                .select('userId, accessGroupId')
                .in('userId', userIds)
                .eq('companyId', auth.dbUser.companyId);

            if (allMemberships && allMemberships.length > 0) {
                const groupIds = [...new Set(allMemberships.map((m: { accessGroupId: string }) => m.accessGroupId))];
                const { data: groups } = await db
                    .from('AccessGroup')
                    .select('id, name')
                    .in('id', groupIds)
                    .is('archivedAt', null);

                const groupMap = new Map((groups || []).map((g: { id: string; name: string }) => [g.id, g]));

                for (const m of allMemberships as { userId: string; accessGroupId: string }[]) {
                    if (!userGroups[m.userId]) userGroups[m.userId] = [];
                    const group = groupMap.get(m.accessGroupId);
                    if (group) userGroups[m.userId].push(group);
                }
            }
        }

        // Enrich users with groups
        const enrichedUsers = filteredUsers.map((u: { id: string }) => ({
            ...u,
            groups: userGroups[u.id] || [],
        }));

        return NextResponse.json({ users: enrichedUsers });
    } catch (err) {
        console.error('[/api/company/users GET]', err);
        return NextResponse.json({ error: 'Failed to load users' }, { status: 500 });
    }
}

/**
 * POST /api/company/users — Create a new user in the current company.
 * Body: { name, email, password, role?, groupIds? }
 * Creates a Supabase Auth account so the user can log in with email/password.
 */
export async function POST(request: Request) {
    const { auth, error } = await requireCompanyAdmin();
    if (error) return error;

    try {
        const body = await request.json();
        const { name, email, password, role = 'MEMBER', groupIds = [] } = body;

        if (!name?.trim() || !email?.trim()) {
            return NextResponse.json({ error: 'Name and email are required' }, { status: 400 });
        }

        if (!password || password.length < 6) {
            return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
        }

        // Prevent assigning SUPER_ADMIN
        if (role === 'SUPER_ADMIN') {
            return NextResponse.json({ error: 'Cannot assign SUPER_ADMIN role' }, { status: 403 });
        }

        const db = createAdminClient();
        const normalizedEmail = email.trim().toLowerCase();

        // Check if user already exists within this company
        const { data: existingInCompany } = await db
            .from('User')
            .select('id')
            .eq('email', normalizedEmail)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        if (existingInCompany) {
            return NextResponse.json({ error: 'A user with this email already exists in your company' }, { status: 409 });
        }

        // Check if user exists in a different company (e.g. from self-signup)
        const { data: existingElsewhere } = await db
            .from('User')
            .select('id, companyId')
            .eq('email', normalizedEmail)
            .neq('companyId', auth.dbUser.companyId)
            .maybeSingle();

        let userId: string;
        let newUser: Record<string, unknown>;

        if (existingElsewhere) {
            // Adopt the existing user into this company and update their auth password
            userId = existingElsewhere.id;

            // Update auth password for existing user
            const { data: usersList } = await db.auth.admin.listUsers();
            const existingAuthUser = usersList?.users?.find((u) => u.email === normalizedEmail);
            if (existingAuthUser) {
                await db.auth.admin.updateUserById(existingAuthUser.id, {
                    password,
                    user_metadata: { must_change_password: true },
                });
            }

            const { data: adopted, error: adoptErr } = await db
                .from('User')
                .update({
                    companyId: auth.dbUser.companyId,
                    name: name.trim(),
                    role,
                    status: 'ACTIVE',
                    mustChangePassword: true,
                    isProvisionedByAdmin: true,
                })
                .eq('id', userId)
                .select('*')
                .single();

            if (adoptErr) throw adoptErr;
            newUser = adopted;
        } else {
            // 1. Create Supabase Auth account first
            const { data: authData, error: authErr } = await db.auth.admin.createUser({
                email: normalizedEmail,
                password,
                email_confirm: true,
                user_metadata: {
                    companyId: auth.dbUser.companyId,
                    displayName: name.trim(),
                    role,
                    must_change_password: true,
                },
            });

            let authUserId = authData?.user?.id;

            if (authErr) {
                if (authErr.message?.includes('already been registered')) {
                    // Auth user exists but no DB record — find and update password
                    const { data: usersList } = await db.auth.admin.listUsers();
                    const existingAuthUser = usersList?.users?.find((u) => u.email === normalizedEmail);
                    if (!existingAuthUser) {
                        return NextResponse.json({ error: 'Auth user exists but could not be found' }, { status: 500 });
                    }
                    authUserId = existingAuthUser.id;
                    await db.auth.admin.updateUserById(authUserId, {
                        password,
                        user_metadata: { must_change_password: true },
                    });
                } else {
                    console.error('[/api/company/users POST] Auth createUser error:', authErr);
                    return NextResponse.json({ error: `Failed to create auth account: ${authErr.message}` }, { status: 500 });
                }
            }

            // 2. Create DB user record
            userId = crypto.randomUUID();
            const { data: created, error: createErr } = await db
                .from('User')
                .insert({
                    id: userId,
                    companyId: auth.dbUser.companyId,
                    name: name.trim(),
                    email: normalizedEmail,
                    role,
                    status: 'ACTIVE',
                    authProvider: 'EMAIL',
                    mustChangePassword: true,
                    isProvisionedByAdmin: true,
                })
                .select('*')
                .single();

            if (createErr) {
                // Roll back auth user if DB insert fails
                if (authData?.user?.id) {
                    await db.auth.admin.deleteUser(authData.user.id);
                }
                throw createErr;
            }
            newUser = created;
        }

        // Assign groups if provided
        if (groupIds.length > 0) {
            // Validate groups belong to this company
            const { data: validGroups } = await db
                .from('AccessGroup')
                .select('id')
                .in('id', groupIds)
                .eq('companyId', auth.dbUser.companyId)
                .is('archivedAt', null);

            const validGroupIds = (validGroups || []).map((g: { id: string }) => g.id);

            if (validGroupIds.length > 0) {
                const memberships = validGroupIds.map((gId: string) => ({
                    id: crypto.randomUUID(),
                    companyId: auth.dbUser.companyId,
                    accessGroupId: gId,
                    userId,
                    createdById: auth.dbUser.id,
                }));

                await db.from('AccessGroupMembership').insert(memberships);
            }
        }

        return NextResponse.json({ user: newUser }, { status: 201 });
    } catch (err) {
        console.error('[/api/company/users POST]', err);
        return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
    }
}
