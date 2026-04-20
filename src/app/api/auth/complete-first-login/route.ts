import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/auth/complete-first-login
 * Forces password change for admin-provisioned users.
 * Body: { newPassword: string }
 */
export async function POST(request: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user: supabaseUser } } = await supabase.auth.getUser();

        if (!supabaseUser) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const { newPassword } = await request.json();

        if (!newPassword || newPassword.length < 8) {
            return NextResponse.json(
                { error: 'A nova palavra-passe deve ter pelo menos 8 caracteres' },
                { status: 400 }
            );
        }

        const db = createAdminClient();

        // Verify user has mustChangePassword flag
        const { data: dbUser } = await db
            .from('User')
            .select('id, companyId, mustChangePassword')
            .eq('email', supabaseUser.email ?? '')
            .maybeSingle();

        if (!dbUser) {
            return NextResponse.json({ error: 'Utilizador não encontrado' }, { status: 404 });
        }

        if (!dbUser.mustChangePassword) {
            return NextResponse.json({ error: 'Alteração de password não necessária' }, { status: 400 });
        }

        // Update password in Supabase Auth
        const { error: authErr } = await db.auth.admin.updateUserById(
            supabaseUser.id,
            {
                password: newPassword,
                user_metadata: { must_change_password: false },
            }
        );

        if (authErr) {
            console.error('[complete-first-login] Auth update error:', authErr);
            return NextResponse.json(
                { error: `Erro ao atualizar password: ${authErr.message}` },
                { status: 500 }
            );
        }

        const now = new Date().toISOString();

        // Update DB user flags
        await db
            .from('User')
            .update({
                mustChangePassword: false,
                passwordChangedAt: now,
                firstLoginAt: now,
            })
            .eq('id', dbUser.id);

        // Create or update CompanyOnboardingState
        const { data: existingState } = await db
            .from('CompanyOnboardingState')
            .select('id')
            .eq('companyId', dbUser.companyId)
            .maybeSingle();

        if (!existingState) {
            await db
                .from('CompanyOnboardingState')
                .insert({
                    id: crypto.randomUUID(),
                    companyId: dbUser.companyId,
                    primaryUserId: dbUser.id,
                    status: 'IN_PROGRESS',
                    currentStep: 1,
                    completedSteps: [],
                    stepDrafts: {},
                    startedAt: now,
                    updatedAt: now,
                });
        } else {
            await db
                .from('CompanyOnboardingState')
                .update({ status: 'IN_PROGRESS', startedAt: now, updatedAt: now })
                .eq('companyId', dbUser.companyId);
        }

        return NextResponse.json({ success: true });
    } catch (err) {
        console.error('[complete-first-login]', err);
        return NextResponse.json({ error: 'Erro interno' }, { status: 500 });
    }
}
