// ═══════════════════════════════════════════════════════
// GET + PUT /api/ai/brains/team-structure
// Read / update the team-level operating & collaboration models
// Stored in Company DNA brain's configJson.teamStructure
// ═══════════════════════════════════════════════════════

import { NextResponse } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

interface TeamStructure {
    operatingModel: string;
    collaborationModel: string;
    updatedAt?: string;
}

// GET — load current team structure
export async function GET() {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const { data: companyBrain } = await db
            .from('AIBrainProfile')
            .select('configJson')
            .eq('companyId', dbUser.companyId)
            .eq('brainType', 'COMPANY')
            .maybeSingle();

        const structure: TeamStructure = companyBrain?.configJson?.teamStructure || {
            operatingModel: '',
            collaborationModel: '',
        };

        return NextResponse.json(structure);
    } catch (error) {
        console.error('[team-structure GET]', error);
        return NextResponse.json({ error: 'Failed to load team structure' }, { status: 500 });
    }
}

// PUT — save team structure
export async function PUT(request: Request) {
    try {
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });

        const db = createAdminClient();
        const { data: dbUser } = await db.from('User').select('id, companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

        const body = await request.json() as Partial<TeamStructure>;

        // Load current config
        const { data: companyBrain } = await db
            .from('AIBrainProfile')
            .select('id, configJson')
            .eq('companyId', dbUser.companyId)
            .eq('brainType', 'COMPANY')
            .maybeSingle();

        if (!companyBrain) {
            return NextResponse.json({ error: 'Company DNA brain not found' }, { status: 404 });
        }

        const currentConfig = companyBrain.configJson || {};
        const updatedConfig = {
            ...currentConfig,
            teamStructure: {
                operatingModel: body.operatingModel ?? currentConfig.teamStructure?.operatingModel ?? '',
                collaborationModel: body.collaborationModel ?? currentConfig.teamStructure?.collaborationModel ?? '',
                updatedAt: new Date().toISOString(),
            },
        };

        const { error } = await db
            .from('AIBrainProfile')
            .update({ configJson: updatedConfig })
            .eq('id', companyBrain.id);

        if (error) throw error;

        return NextResponse.json({ ok: true, teamStructure: updatedConfig.teamStructure });
    } catch (error) {
        console.error('[team-structure PUT]', error);
        return NextResponse.json({ error: 'Failed to save team structure' }, { status: 500 });
    }
}
