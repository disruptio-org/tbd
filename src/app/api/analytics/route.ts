import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';

/**
 * GET /api/analytics
 * Returns dashboard stats for the current user's company.
 */
export async function GET() {
    try {
        const auth = await getCurrentUser();
        if (!auth) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const db = createAdminClient();
        const companyId = auth.dbUser.companyId;

        // Parallel queries for performance
        const [
            docsResult,
            ocrResult,
            curatedResult,
            conversationsResult,
            classificationsResult,
            gapsResult,
            profileResult,
            guideResult,
            recentDocsResult,
            recentConvsResult,
        ] = await Promise.all([
            // Total documents
            db.from('Document')
                .select('id', { count: 'exact', head: true })
                .eq('companyId', companyId),

            // Documents with OCR processed
            db.from('Document')
                .select('id', { count: 'exact', head: true })
                .eq('companyId', companyId)
                .eq('ocrProcessed', true),

            // Curated knowledge sources
            db.from('Document')
                .select('id', { count: 'exact', head: true })
                .eq('companyId', companyId)
                .eq('useAsKnowledgeSource', true),

            // Total conversations
            db.from('Conversation')
                .select('id', { count: 'exact', head: true })
                .eq('companyId', companyId),

            // Classification results
            db.from('ClassificationResult')
                .select('id', { count: 'exact', head: true })
                .eq('companyId', companyId),

            // Open knowledge gaps
            db.from('KnowledgeGap')
                .select('id', { count: 'exact', head: true })
                .eq('companyId', companyId)
                .eq('status', 'open'),

            // Company profile exists?
            db.from('CompanyProfile')
                .select('id')
                .eq('companyId', companyId)
                .maybeSingle(),

            // Onboarding guide exists?
            db.from('CompanyOnboardingGuide')
                .select('companyId')
                .eq('companyId', companyId)
                .maybeSingle(),

            // Recent documents (last 5)
            db.from('Document')
                .select('id, filename, mimeType, ocrProcessed, createdAt')
                .eq('companyId', companyId)
                .order('createdAt', { ascending: false })
                .limit(5),

            // Recent conversations (last 5)
            db.from('Conversation')
                .select('id, title, assistantType, createdAt')
                .eq('companyId', companyId)
                .order('createdAt', { ascending: false })
                .limit(5),
        ]);

        const totalDocs = docsResult.count ?? 0;
        const ocrDocs = ocrResult.count ?? 0;

        return NextResponse.json({
            overview: {
                documents: totalDocs,
                ocrProcessed: ocrDocs,
                curatedSources: curatedResult.count ?? 0,
                conversations: conversationsResult.count ?? 0,
                classifications: classificationsResult.count ?? 0,
                openKnowledgeGaps: gapsResult.count ?? 0,
                ocrRate: totalDocs > 0 ? Math.round((ocrDocs / totalDocs) * 100) : 0,
            },
            status: {
                hasCompanyProfile: !!profileResult.data,
                hasOnboardingGuide: !!guideResult.data,
            },
            recent: {
                documents: recentDocsResult.data ?? [],
                conversations: recentConvsResult.data ?? [],
            },
        });
    } catch (error) {
        console.error('[analytics] Error:', error);
        return NextResponse.json({ error: 'Failed' }, { status: 500 });
    }
}
