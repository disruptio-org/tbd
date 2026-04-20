import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/today/analytics — Executive KPIs and trends.
 * Query params: ?period=7d|30d|90d (default 30d)
 */
export async function GET(req: Request) {
    try {
        const { prisma } = await import('@/lib/prisma');
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const dbUser = await prisma.user.findUnique({
            where: { email: user.email! },
            include: { company: true },
        });
        if (!dbUser?.companyId) return NextResponse.json({ error: 'No company' }, { status: 404 });

        const companyId = dbUser.companyId;
        const url = new URL(req.url);
        const period = url.searchParams.get('period') || '30d';

        const periodMs = period === '7d' ? 7 * 86400000
            : period === '90d' ? 90 * 86400000
            : 30 * 86400000;
        const now = new Date();
        const since = new Date(now.getTime() - periodMs);
        const prevSince = new Date(since.getTime() - periodMs); // comparison period

        // ── KPIs (current + previous for trend) ──
        const [
            tasksCompletedCurrent,
            tasksCompletedPrev,
            contentMktCurrent,
            contentMktPrev,
            contentSalesCurrent,
            contentSalesPrev,
            sessionsCurrent,
            sessionsPrev,
            pendingApprovals,
            blockedCurrent,
            blockedPrev,
        ] = await Promise.all([
            // Tasks completed
            prisma.task.count({ where: { companyId, isCompleted: true, updatedAt: { gte: since } } }).catch(() => 0),
            prisma.task.count({ where: { companyId, isCompleted: true, updatedAt: { gte: prevSince, lt: since } } }).catch(() => 0),
            // Marketing content
            prisma.marketingGenerationRun.count({ where: { companyId, createdAt: { gte: since }, status: 'completed' } }).catch(() => 0),
            prisma.marketingGenerationRun.count({ where: { companyId, createdAt: { gte: prevSince, lt: since }, status: 'completed' } }).catch(() => 0),
            // Sales content
            prisma.salesGenerationRun.count({ where: { companyId, createdAt: { gte: since }, status: 'completed' } }).catch(() => 0),
            prisma.salesGenerationRun.count({ where: { companyId, createdAt: { gte: prevSince, lt: since }, status: 'completed' } }).catch(() => 0),
            // AI conversations
            prisma.assistantSession.count({ where: { companyId, startedAt: { gte: since } } }).catch(() => 0),
            prisma.assistantSession.count({ where: { companyId, startedAt: { gte: prevSince, lt: since } } }).catch(() => 0),
            // Pending approvals (current only)
            prisma.approvalRequest.count({ where: { status: 'PENDING', initiative: { companyId } } }).catch(() => 0),
            // Blocked items
            prisma.initiativeTask.count({ where: { initiative: { companyId }, status: 'BLOCKED' } }).catch(() => 0),
            prisma.initiativeTask.count({ where: { initiative: { companyId }, status: 'BLOCKED', updatedAt: { gte: prevSince, lt: since } } }).catch(() => 0),
        ]);

        const contentCurrent = contentMktCurrent + contentSalesCurrent;
        const contentPrev = contentMktPrev + contentSalesPrev;

        const trend = (cur: number, prev: number): 'up' | 'down' | 'flat' =>
            cur > prev ? 'up' : cur < prev ? 'down' : 'flat';

        // ── Knowledge Coverage ──
        let knowledgeCoverage = 0;
        try {
            const dna = await prisma.companyDNA.findUnique({ where: { companyId }, select: { coverageScore: true } });
            knowledgeCoverage = dna?.coverageScore || 0;
        } catch { /* non-critical */ }

        // ── Agent Utilization ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let agentUtilization: Array<Record<string, any>> = [];
        try {
            const actionRuns = await prisma.assistantActionRun.findMany({
                where: { companyId, createdAt: { gte: since }, status: 'SUCCESS' },
                select: { targetModule: true },
            });
            const moduleMap = new Map<string, number>();
            for (const r of actionRuns) {
                moduleMap.set(r.targetModule, (moduleMap.get(r.targetModule) || 0) + 1);
            }
            const totalActions = actionRuns.length || 1;
            agentUtilization = Array.from(moduleMap.entries())
                .map(([name, actions]) => ({
                    name: name.charAt(0).toUpperCase() + name.slice(1),
                    actions,
                    percentage: Math.round((actions / totalActions) * 100),
                }))
                .sort((a, b) => b.actions - a.actions)
                .slice(0, 8);
        } catch { /* non-critical */ }

        // ── Project Health ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let projectHealth: Array<Record<string, any>> = [];
        try {
            const projects = await prisma.project.findMany({
                where: { companyId, status: { in: ['active', 'in_progress', 'planning'] } },
                take: 8,
                orderBy: { updatedAt: 'desc' },
                include: {
                    taskBoards: {
                        include: { tasks: { select: { isCompleted: true } } },
                    },
                },
            });
            projectHealth = projects.map(p => {
                const allTasks = p.taskBoards.flatMap(b => b.tasks);
                const total = allTasks.length;
                const completed = allTasks.filter(t => t.isCompleted).length;
                return {
                    name: p.name,
                    tasksTotal: total,
                    tasksCompleted: completed,
                    progress: total > 0 ? Math.round((completed / total) * 100) : 0,
                };
            });
        } catch { /* non-critical */ }

        // ── Daily Activity (sparkline data) ──
        const dailyActivity: Array<{ date: string; actions: number; tasks: number; content: number }> = [];
        try {
            const periodDays = Math.min(Math.ceil(periodMs / 86400000), 90);
            for (let i = periodDays - 1; i >= 0; i--) {
                const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
                const dayEnd = new Date(dayStart.getTime() + 86400000);
                const dateStr = dayStart.toISOString().split('T')[0];

                const [dayActions, dayTasks, dayContent] = await Promise.all([
                    prisma.assistantActionRun.count({ where: { companyId, createdAt: { gte: dayStart, lt: dayEnd }, status: 'SUCCESS' } }).catch(() => 0),
                    prisma.task.count({ where: { companyId, isCompleted: true, updatedAt: { gte: dayStart, lt: dayEnd } } }).catch(() => 0),
                    prisma.marketingGenerationRun.count({ where: { companyId, createdAt: { gte: dayStart, lt: dayEnd }, status: 'completed' } }).catch(() => 0),
                ]);
                dailyActivity.push({ date: dateStr, actions: dayActions, tasks: dayTasks, content: dayContent });
            }
        } catch { /* non-critical */ }

        return NextResponse.json({
            period,
            kpis: {
                tasksCompleted: { value: tasksCompletedCurrent, previousValue: tasksCompletedPrev, trend: trend(tasksCompletedCurrent, tasksCompletedPrev) },
                contentGenerated: { value: contentCurrent, previousValue: contentPrev, trend: trend(contentCurrent, contentPrev) },
                aiConversations: { value: sessionsCurrent, previousValue: sessionsPrev, trend: trend(sessionsCurrent, sessionsPrev) },
                pendingApprovals: { value: pendingApprovals },
                knowledgeCoverage: { score: knowledgeCoverage },
                blockedItems: { value: blockedCurrent, previousValue: blockedPrev, trend: trend(blockedCurrent, blockedPrev) },
            },
            agentUtilization,
            projectHealth,
            dailyActivity,
        });
    } catch (err: unknown) {
        console.error('[api/today/analytics] Error:', err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
