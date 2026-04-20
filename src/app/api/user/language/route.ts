import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/user/language
 * Returns the effective language for the current authenticated user.
 * Priority: user.language > company.language > 'en'
 */
export async function GET() {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ language: 'en' });
        }

        const db = createAdminClient();

        const { data: dbUser } = await db
            .from('User')
            .select('companyId, language')
            .eq('email', user.email ?? '')
            .maybeSingle();

        if (!dbUser?.companyId) {
            return NextResponse.json({ language: dbUser?.language || 'en' });
        }

        // User-level language takes priority over company language
        if (dbUser.language && ['en', 'pt-PT', 'fr'].includes(dbUser.language)) {
            return NextResponse.json({ language: dbUser.language });
        }

        const { data: company } = await db
            .from('Company')
            .select('language')
            .eq('id', dbUser.companyId)
            .maybeSingle();

        return NextResponse.json({ language: company?.language ?? 'en' });
    } catch {
        return NextResponse.json({ language: 'en' });
    }
}
