import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/assistant/preferences
 * Get user's assistant preferences (display name, voice enabled).
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const db = createAdminClient();
        const { data: pref } = await db
            .from('UserAssistantPreference')
            .select('*')
            .eq('userId', auth.dbUser.id)
            .maybeSingle();

        return NextResponse.json({
            preferences: pref || {
                displayName: 'Nousio',
                voiceEnabled: true,
            },
        });
    } catch (err) {
        console.error('[/api/assistant/preferences] GET error:', err);
        return NextResponse.json({ preferences: { displayName: 'Nousio', voiceEnabled: true } });
    }
}

/**
 * PUT /api/assistant/preferences
 * Update user's assistant display name and preferences.
 */
export async function PUT(request: NextRequest) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const body = await request.json();
        const { displayName, voiceEnabled } = body;

        if (!displayName || typeof displayName !== 'string' || !displayName.trim()) {
            return NextResponse.json({ error: 'Display name is required' }, { status: 400 });
        }

        const cleanName = displayName.trim().substring(0, 20);
        const db = createAdminClient();

        // Upsert
        const { data: existing } = await db
            .from('UserAssistantPreference')
            .select('id')
            .eq('userId', auth.dbUser.id)
            .maybeSingle();

        let pref;
        if (existing) {
            const { data } = await db
                .from('UserAssistantPreference')
                .update({
                    displayName: cleanName,
                    voiceEnabled: voiceEnabled !== undefined ? voiceEnabled : true,
                    updatedAt: new Date().toISOString(),
                })
                .eq('id', existing.id)
                .select()
                .single();
            pref = data;
        } else {
            const { data } = await db
                .from('UserAssistantPreference')
                .insert({
                    id: crypto.randomUUID(),
                    userId: auth.dbUser.id,
                    companyId: auth.dbUser.companyId,
                    displayName: cleanName,
                    voiceEnabled: voiceEnabled !== undefined ? voiceEnabled : true,
                    updatedAt: new Date().toISOString(),
                })
                .select()
                .single();
            pref = data;
        }

        return NextResponse.json({ preferences: pref });
    } catch (err) {
        console.error('[/api/assistant/preferences] PUT error:', err);
        return NextResponse.json({ error: 'Failed to save preferences' }, { status: 500 });
    }
}
