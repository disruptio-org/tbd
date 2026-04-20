import { NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/backoffice/companies/[id]/send-invite
 * Sends (or re-sends) an invite email to a user.
 * Body: { userId: string }
 *
 * MVP: Logs the invite details to console and records the timestamp.
 * In production, integrate with a transactional email service (Resend, SendGrid, etc.).
 */
export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { error } = await requireSuperAdmin();
    if (error) return error;

    try {
        const { id: companyId } = await params;
        const { userId } = await request.json();

        if (!userId) {
            return NextResponse.json({ error: 'userId é obrigatório' }, { status: 400 });
        }

        const db = createAdminClient();

        // Look up the user
        const { data: user } = await db
            .from('User')
            .select('id, email, name, mustChangePassword, isProvisionedByAdmin, inviteSentAt')
            .eq('id', userId)
            .eq('companyId', companyId)
            .maybeSingle();

        if (!user) {
            return NextResponse.json({ error: 'Utilizador não encontrado' }, { status: 404 });
        }

        // Look up company name
        const { data: company } = await db
            .from('Company')
            .select('name')
            .eq('id', companyId)
            .maybeSingle();

        const companyName = company?.name ?? 'a empresa';
        const loginUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000'}/login`;

        // ── MVP: Console log the invite (replace with real email service) ──
        console.log('═══════════════════════════════════════════════');
        console.log('📧 INVITE EMAIL');
        console.log(`To: ${user.email}`);
        console.log(`Company: ${companyName}`);
        console.log(`Login URL: ${loginUrl}`);
        console.log(`Message: Olá ${user.name || user.email},`);
        console.log(`Bem-vindo ao Nousio! A sua conta na empresa "${companyName}" foi criada.`);
        console.log(`Para aceder, entre em ${loginUrl} com o seu email.`);
        console.log(`Na primeira sessão, ser-lhe-á pedido que defina uma nova password.`);
        console.log('═══════════════════════════════════════════════');

        // Record invite sent timestamp
        const now = new Date().toISOString();
        await db
            .from('User')
            .update({ inviteSentAt: now })
            .eq('id', userId);

        return NextResponse.json({
            success: true,
            inviteSentAt: now,
            message: `Convite enviado para ${user.email}`,
        });
    } catch (err) {
        console.error('[backoffice/send-invite POST]', err);
        return NextResponse.json({ error: 'Erro ao enviar convite' }, { status: 500 });
    }
}
