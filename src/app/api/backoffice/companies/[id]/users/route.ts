import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/backoffice/companies/[id]/users
 * List users in a company.
 */
export async function GET(
    _request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const db = createAdminClient();

        const { data, error: dbErr } = await db
            .from('User')
            .select('id, name, email, role, authProvider, avatarUrl, createdAt, mustChangePassword, isProvisionedByAdmin, inviteSentAt, firstLoginAt, passwordChangedAt')
            .eq('companyId', id)
            .order('createdAt', { ascending: true });

        if (dbErr) throw dbErr;

        return NextResponse.json(data ?? []);
    } catch (err) {
        console.error('[backoffice/users GET]', err);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}

/**
 * POST /api/backoffice/companies/[id]/users
 * Create a new user for the company with a preset password.
 * - Creates a Supabase Auth account (email pre-confirmed, no invite email sent).
 * - Creates the User record in the DB linked to the company.
 * Body: { email: string, password: string, name?: string, role?: 'MEMBER' | 'ADMIN' }
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const { email, password, name, role } = await request.json();

        if (!email) {
            return NextResponse.json({ error: 'email é obrigatório' }, { status: 400 });
        }
        if (!password || password.length < 6) {
            return NextResponse.json({ error: 'A palavra-passe deve ter pelo menos 6 caracteres' }, { status: 400 });
        }

        const userRole = role === 'ADMIN' ? 'ADMIN' : 'MEMBER';
        const db = createAdminClient();

        // Verify company exists
        const { data: company } = await db
            .from('Company')
            .select('id, name')
            .eq('id', id)
            .maybeSingle();

        if (!company) {
            return NextResponse.json({ error: 'Empresa não encontrada' }, { status: 404 });
        }

        // Check if DB user with this email already exists (globally unique)
        const { data: existingUser } = await db
            .from('User')
            .select('id, companyId')
            .eq('email', email)
            .maybeSingle();

        if (existingUser) {
            if (existingUser.companyId === id) {
                return NextResponse.json({ error: 'Utilizador já existe nesta empresa' }, { status: 409 });
            }
            return NextResponse.json({ error: 'Este email já está registado noutro empresa' }, { status: 409 });
        }

        const displayName = name?.trim() || email.split('@')[0];

        // Create auth user directly with password — no email confirmation needed.
        // email_confirm: true marks the email as already verified.
        const { data: authData, error: authErr } = await db.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                companyId: id,
                displayName,
                role: userRole,
                must_change_password: true,
            },
        });

        let authUserId = authData?.user?.id;

        if (authErr) {
            if (authErr.message?.includes('already been registered')) {
                // Auth user already exists — find them and update their password
                const { data: usersList } = await db.auth.admin.listUsers();
                const existingAuthUser = usersList?.users?.find((u) => u.email === email);
                if (!existingAuthUser) {
                    return NextResponse.json({ error: 'Utilizador já registado mas não encontrado' }, { status: 500 });
                }
                authUserId = existingAuthUser.id;
                // Update password so the admin-provided one takes effect
                await db.auth.admin.updateUserById(authUserId, {
                    password,
                    user_metadata: { must_change_password: true },
                });
            } else {
                console.error('[backoffice/users POST] Auth createUser error:', authErr);
                return NextResponse.json({ error: `Erro ao criar conta: ${authErr.message}` }, { status: 500 });
            }
        }

        // Create the DB User record
        const userId = crypto.randomUUID();

        const { data: newUser, error: userErr } = await db
            .from('User')
            .insert({
                id: userId,
                email,
                name: displayName,
                companyId: id,
                role: userRole,
                authProvider: 'EMAIL',
                mustChangePassword: true,
                isProvisionedByAdmin: true,
            })
            .select('id, name, email, role, authProvider, avatarUrl, createdAt, mustChangePassword, isProvisionedByAdmin')
            .single();

        if (userErr) {
            // Roll back auth user if DB insert fails
            if (authData?.user?.id) {
                await db.auth.admin.deleteUser(authData.user.id);
            }
            console.error('[backoffice/users POST] DB insert error:', userErr);
            return NextResponse.json({ error: `Erro ao criar utilizador: ${userErr.message}` }, { status: 500 });
        }

        return NextResponse.json(newUser, { status: 201 });
    } catch (err) {
        console.error('[backoffice/users POST]', err);
        return NextResponse.json({ error: 'Erro interno ao criar utilizador' }, { status: 500 });
    }
}

/**
 * PUT /api/backoffice/companies/[id]/users
 * Update a user's role within the company.
 * Body: { userId: string, role: 'MEMBER' | 'ADMIN' }
 */
export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const { id } = await params;
        const { userId, role } = await request.json();

        if (!userId || !role) {
            return NextResponse.json({ error: 'userId and role required' }, { status: 400 });
        }

        if (!['MEMBER', 'ADMIN'].includes(role)) {
            return NextResponse.json({ error: 'Role must be MEMBER or ADMIN' }, { status: 400 });
        }

        const db = createAdminClient();

        const { data: user } = await db
            .from('User')
            .select('id')
            .eq('id', userId)
            .eq('companyId', id)
            .maybeSingle();

        if (!user) {
            return NextResponse.json({ error: 'User not found in this company' }, { status: 404 });
        }

        const { data, error: dbErr } = await db
            .from('User')
            .update({ role })
            .eq('id', userId)
            .select('id, name, email, role, authProvider, avatarUrl, createdAt')
            .single();

        if (dbErr) throw dbErr;

        return NextResponse.json(data);
    } catch (err) {
        console.error('[backoffice/users PUT]', err);
        return NextResponse.json({ error: 'Update failed' }, { status: 500 });
    }
}
