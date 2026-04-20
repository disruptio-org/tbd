import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * POST /api/ai/skills/rate
 * Submit a rating for a generation output.
 * Body: { skillKey, assistantType, generationRunId, rating (1 or 5), feedback? }
 */
export async function POST(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { skillKey, assistantType, generationRunId, rating, feedback } = await request.json();

        if (!skillKey || !assistantType || !generationRunId) {
            return NextResponse.json({ error: 'skillKey, assistantType, and generationRunId are required' }, { status: 400 });
        }
        if (![1, 5].includes(rating)) {
            return NextResponse.json({ error: 'rating must be 1 (thumbs down) or 5 (thumbs up)' }, { status: 400 });
        }

        const db = createAdminClient();

        // Upsert: if user already rated this generation, update it
        const { data: existing } = await db
            .from('SkillRating')
            .select('id')
            .eq('generationRunId', generationRunId)
            .eq('userId', auth.dbUser.id)
            .maybeSingle();

        if (existing) {
            await db.from('SkillRating').update({
                rating,
                feedback: feedback || null,
            }).eq('id', existing.id);

            return NextResponse.json({ id: existing.id, updated: true });
        }

        const id = crypto.randomUUID();
        await db.from('SkillRating').insert({
            id,
            companyId: auth.dbUser.companyId,
            skillKey,
            assistantType,
            generationRunId,
            userId: auth.dbUser.id,
            rating,
            feedback: feedback || null,
        });

        return NextResponse.json({ id, created: true });
    } catch (err) {
        console.error('[/api/ai/skills/rate POST]', err);
        return NextResponse.json({ error: 'Failed to save rating' }, { status: 500 });
    }
}
