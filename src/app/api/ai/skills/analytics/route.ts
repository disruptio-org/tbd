import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/ai/skills/analytics?assistantType=MARKETING
 * Returns per-skill analytics: total ratings, average rating, thumbs up %, recent trend.
 */
export async function GET(request: Request) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    try {
        const { searchParams } = new URL(request.url);
        const assistantType = searchParams.get('assistantType');

        const db = createAdminClient();

        // Fetch all ratings for company (optionally filtered by assistantType)
        let query = db
            .from('SkillRating')
            .select('skillKey, assistantType, rating, createdAt')
            .eq('companyId', auth.dbUser.companyId)
            .order('createdAt', { ascending: false });

        if (assistantType) {
            query = query.eq('assistantType', assistantType);
        }

        const { data: ratings, error } = await query.limit(500);
        if (error) throw error;

        // Aggregate per skill
        const skillMap: Record<string, {
            skillKey: string;
            assistantType: string;
            totalRatings: number;
            thumbsUp: number;
            thumbsDown: number;
            avgRating: number;
            recentRatings: { rating: number; createdAt: string }[];
        }> = {};

        for (const r of (ratings || [])) {
            const key = `${r.assistantType}::${r.skillKey}`;
            if (!skillMap[key]) {
                skillMap[key] = {
                    skillKey: r.skillKey,
                    assistantType: r.assistantType,
                    totalRatings: 0,
                    thumbsUp: 0,
                    thumbsDown: 0,
                    avgRating: 0,
                    recentRatings: [],
                };
            }
            const s = skillMap[key];
            s.totalRatings++;
            if (r.rating >= 4) s.thumbsUp++;
            else s.thumbsDown++;
            if (s.recentRatings.length < 5) {
                s.recentRatings.push({ rating: r.rating, createdAt: r.createdAt });
            }
        }

        // Calculate averages
        for (const s of Object.values(skillMap)) {
            s.avgRating = s.totalRatings > 0
                ? Math.round((s.thumbsUp / s.totalRatings) * 100)
                : 0;
        }

        return NextResponse.json({ analytics: Object.values(skillMap) });
    } catch (err) {
        console.error('[/api/ai/skills/analytics GET]', err);
        return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
    }
}
