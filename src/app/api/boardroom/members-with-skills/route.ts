import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/boardroom/members-with-skills
 * Returns all enabled team members with their per-member skill assignments.
 * Used by the plan editor to populate member/skill dropdowns.
 */
export async function GET() {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const db = createAdminClient();
    const companyId = auth.dbUser.companyId;

    // Fetch enabled brain profiles
    const { data: brains, error: brainsErr } = await db
        .from('AIBrainProfile')
        .select('id, name, brainType, description, isEnabled')
        .eq('companyId', companyId)
        .eq('isEnabled', true)
        .order('name');

    if (brainsErr) {
        console.error('[boardroom/members-with-skills] Error:', brainsErr);
        return NextResponse.json({ error: 'Failed to fetch members' }, { status: 500 });
    }

    // For each brain, fetch its per-member skills via BrainProfileSkill
    const members = [];
    for (const brain of (brains || [])) {
        const { data: skillLinks } = await db
            .from('BrainProfileSkill')
            .select('skillId')
            .eq('brainProfileId', brain.id);

        let skills: { id: string; key: string; name: string; description: string | null }[] = [];
        if (skillLinks && skillLinks.length > 0) {
            const skillIds = skillLinks.map(s => s.skillId);
            const { data: skillRecords } = await db
                .from('AssistantSkill')
                .select('id, key, name, description')
                .in('id', skillIds)
                .eq('status', 'ACTIVE')
                .order('name');
            skills = skillRecords || [];
        }

        members.push({
            id: brain.id,
            name: brain.name,
            brainType: brain.brainType,
            description: brain.description,
            skills,
        });
    }

    return NextResponse.json({ members });
}
