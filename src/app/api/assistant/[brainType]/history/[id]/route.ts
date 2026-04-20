import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

const TABLE_MAP: Record<string, string> = {
    MARKETING: 'MarketingGenerationRun',
    SALES: 'SalesGenerationRun',
    PRODUCT_ASSISTANT: 'ProductGenerationRun',
    ONBOARDING: 'OnboardingGenerationRun',
    COMPANY_ADVISOR: 'AdvisorGenerationRun',
    GENERAL_AI: 'GeneralAIGenerationRun',
};

function getTable(brainType: string): string {
    return TABLE_MAP[brainType.toUpperCase()] || 'GeneralAIGenerationRun';
}

export async function GET(
    _request: Request,
    { params }: { params: Promise<{ brainType: string; id: string }> }
) {
    const auth = await getCurrentUser();
    if (!auth) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { brainType, id } = await params;
    const table = getTable(brainType);

    try {
        const db = createAdminClient();
        const { data: run, error } = await db
            .from(table)
            .select('*')
            .eq('id', id)
            .eq('companyId', auth.dbUser.companyId)
            .maybeSingle();
        if (error) throw error;
        return NextResponse.json({ run });
    } catch (err) {
        console.error(`[/api/assistant/${brainType}/history/${id} GET]`, err);
        return NextResponse.json({ error: 'Failed to fetch run' }, { status: 500 });
    }
}
