import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/user/profile
 * Returns the current user's profile data.
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const db = createAdminClient();
        const { data, error } = await db
            .from('User')
            .select('id, name, email, avatarUrl, timezone, language, role, createdAt')
            .eq('email', auth.dbUser.email)
            .single();

        if (error) throw error;

        // Supplement with Supabase user data if DB fields are empty
        const profile = {
            ...data,
            name: data.name || auth.dbUser.name || auth.supabaseUser.user_metadata?.full_name || auth.supabaseUser.user_metadata?.name || auth.supabaseUser.email?.split('@')[0] || '',
            email: data.email || auth.dbUser.email || auth.supabaseUser.email || '',
        };

        return NextResponse.json({ profile });
    } catch (err) {
        console.error('[/api/user/profile] GET error:', err);
        // Fallback: return data from auth.dbUser if DB query fails
        return NextResponse.json({
            profile: {
                id: auth.dbUser.id,
                name: auth.dbUser.name || auth.supabaseUser.email?.split('@')[0] || '',
                email: auth.dbUser.email || auth.supabaseUser.email || '',
                avatarUrl: auth.dbUser.avatarUrl || null,
                timezone: auth.dbUser.timezone || null,
                language: auth.dbUser.language || null,
                role: auth.dbUser.role || 'MEMBER',
                createdAt: auth.dbUser.createdAt || null,
            }
        });
    }
}

/**
 * PUT /api/user/profile
 * Updates the current user's profile (name, avatarUrl, timezone).
 * Email is read-only; role changes require admin.
 */
export async function PUT(request: NextRequest) {
    const auth = await getCurrentUser();
    if (!auth) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await request.json();
        const { name, avatarUrl, timezone, language } = body;

        // Validate required fields
        if (!name || typeof name !== 'string' || !name.trim()) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const updateData: Record<string, string | null> = {
            name: name.trim(),
        };

        // Optional fields
        if (timezone !== undefined) {
            updateData.timezone = timezone;
        }
        if (avatarUrl !== undefined) {
            updateData.avatarUrl = avatarUrl || null;
        }
        if (language !== undefined) {
            updateData.language = language;
        }

        const db = createAdminClient();
        const { data, error } = await db
            .from('User')
            .update(updateData)
            .eq('email', auth.dbUser.email)
            .select('id, name, email, avatarUrl, timezone, language, role, createdAt')
            .single();

        if (error) throw error;

        return NextResponse.json({ profile: data });
    } catch (err) {
        console.error('[/api/user/profile] PUT error:', err);
        return NextResponse.json({ error: 'Failed to save profile' }, { status: 500 });
    }
}
