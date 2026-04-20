import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
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
        const now = new Date();
        const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);

        // ── Greeting ──
        const hour = now.getHours();
        const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

        // ── Summary counts (fault-tolerant) ──
        let pendingApprovals = 0, tasksToday = 0, activeInitiatives = 0, overdueItems = 0;
        try {
            const results = await Promise.allSettled([
                prisma.approvalRequest.count({ where: { status: 'PENDING', initiative: { companyId } } }),
                prisma.task.count({ where: { companyId, isCompleted: false, dueDate: { gte: todayStart, lt: todayEnd } } }),
                prisma.initiative.count({ where: { companyId, status: { in: ['IN_PROGRESS', 'PLANNING'] } } }),
                prisma.task.count({ where: { companyId, isCompleted: false, dueDate: { lt: todayStart } } }),
            ]);
            pendingApprovals = results[0].status === 'fulfilled' ? results[0].value : 0;
            tasksToday = results[1].status === 'fulfilled' ? results[1].value : 0;
            activeInitiatives = results[2].status === 'fulfilled' ? results[2].value : 0;
            overdueItems = results[3].status === 'fulfilled' ? results[3].value : 0;
        } catch (e) { console.error('[api/today] summary counts:', e); }

        // ── Schedule ──
        const weekDays: Array<{ date: string; dayName: string; isToday: boolean; hasEvents: boolean; eventCount: number }> = [];
        try {
            const weekStart = new Date(todayStart);
            weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1);
            const dayNames = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];
            for (let i = 0; i < 7; i++) {
                const date = new Date(weekStart);
                date.setDate(weekStart.getDate() + i);
                const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
                const dayEnd2 = new Date(dayStart);
                dayEnd2.setDate(dayEnd2.getDate() + 1);
                const eventCount = await prisma.task.count({
                    where: { companyId, isCompleted: false, dueDate: { gte: dayStart, lt: dayEnd2 } },
                }).catch(() => 0);
                weekDays.push({
                    date: dayStart.toISOString().split('T')[0],
                    dayName: dayNames[i],
                    isToday: dayStart.getTime() === todayStart.getTime(),
                    hasEvents: eventCount > 0,
                    eventCount,
                });
            }
        } catch (e) { console.error('[api/today] schedule:', e); }

        // ── Today agenda ──
        let todayAgenda: Array<{ id: string; time?: string; title: string; type: string; projectName?: string }> = [];
        try {
            const todayTasks = await prisma.task.findMany({
                where: { companyId, isCompleted: false, dueDate: { gte: todayStart, lt: todayEnd } },
                take: 10,
                orderBy: { dueDate: 'asc' },
                include: { board: { include: { project: true } } },
            });
            todayAgenda = todayTasks.map((t) => ({
                id: t.id,
                time: t.dueDate ? new Date(t.dueDate).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }) : undefined,
                title: t.title,
                type: 'deadline' as const,
                projectName: t.board?.project?.name || undefined,
            }));
        } catch (e) { console.error('[api/today] agenda:', e); }

        // ── Needs Attention ──
        let needsAttention: Array<Record<string, unknown>> = [];
        try {
            const [pendingApprovalsList, urgentTasks] = await Promise.all([
                prisma.approvalRequest.findMany({
                    where: { status: 'PENDING', initiative: { companyId } },
                    take: 5,
                    orderBy: { createdAt: 'desc' },
                    include: { initiative: { select: { title: true, project: { select: { name: true } } } } },
                }),
                prisma.task.findMany({
                    where: { companyId, isCompleted: false, OR: [{ priority: 'urgent' }, { dueDate: { lt: todayStart } }] },
                    take: 5,
                    orderBy: { dueDate: 'asc' },
                    include: { board: { include: { project: true } } },
                }),
            ]);
            needsAttention = [
                ...pendingApprovalsList.map((a) => ({
                    id: a.id, entityId: a.id, type: 'approval', title: a.title,
                    projectName: a.initiative?.project?.name || undefined,
                    priority: 'high', actionUrl: `/projects`,
                })),
                ...urgentTasks.map((t) => ({
                    id: t.id, entityId: t.id, type: 'task', title: t.title,
                    projectName: t.board?.project?.name || undefined,
                    boardId: t.boardId,
                    dueTime: t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-PT') : undefined,
                    priority: t.priority, actionUrl: `/tasks`,
                })),
            ].slice(0, 8);
        } catch (e) { console.error('[api/today] needsAttention:', e); }

        // ── Team Updates ──
        let teamUpdates: Array<Record<string, unknown>> = [];
        try {
            const companyInits = await prisma.initiative.findMany({
                where: { companyId },
                select: { id: true },
            });
            const initIds = companyInits.map((i) => i.id);
            if (initIds.length > 0) {
                const events = await prisma.initiativeEvent.findMany({
                    where: { initiativeId: { in: initIds } },
                    take: 8,
                    orderBy: { createdAt: 'desc' },
                    include: { initiative: { select: { title: true, project: { select: { name: true } } } } },
                });
                teamUpdates = events.map((e) => ({
                    id: e.id,
                    type: e.action === 'completed' ? 'completed' : e.action === 'blocked' ? 'blocked' : e.action === 'comment' ? 'clarification' : 'handoff',
                    agentName: e.actorLabel || 'System',
                    title: e.description || e.action,
                    projectName: e.initiative?.project?.name || undefined,
                    timestamp: e.createdAt.toISOString(),
                }));
            }
        } catch (e) { console.error('[api/today] teamUpdates:', e); }

        // ── Active Work (Projects) ──
        let activeWork: Array<Record<string, unknown>> = [];
        try {
            const projects = await prisma.project.findMany({
                where: { companyId, status: { in: ['active', 'in_progress', 'planning'] } },
                take: 6,
                orderBy: { updatedAt: 'desc' },
                include: {
                    customer: { select: { name: true } },
                    taskBoards: {
                        include: {
                            tasks: { select: { isCompleted: true } },
                        },
                    },
                    initiatives: {
                        select: { status: true },
                        take: 1,
                        orderBy: { updatedAt: 'desc' },
                    },
                },
            });
            activeWork = projects.map((proj) => {
                // Aggregate task completion across all boards
                const allTasks = proj.taskBoards.flatMap((b) => b.tasks);
                const total = allTasks.length;
                const completed = allTasks.filter((t) => t.isCompleted).length;
                // Check if any initiative is blocked
                const latestInit = proj.initiatives[0];
                const execState = (latestInit as Record<string, unknown>)?.executionState as string
                    || latestInit?.status
                    || proj.status;
                const isBlocked = execState === 'BLOCKED' || execState === 'WAITING_ON_HUMAN';
                return {
                    id: proj.id,
                    projectName: proj.name,
                    customerName: proj.customer?.name || undefined,
                    executionState: isBlocked ? execState : (proj.status === 'active' ? 'IN_PROGRESS' : proj.status.toUpperCase()),
                    progress: { completed, total },
                    lastActivity: proj.updatedAt.toISOString(),
                };
            });
        } catch (e) { console.error('[api/today] activeWork:', e); }

        // ── Pending Actions from Boardroom ──
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let pendingActions: Array<Record<string, any>> = [];
        try {
            // Tasks needing approval or output review
            const actionTasks = await prisma.initiativeTask.findMany({
                where: {
                    initiative: { companyId },
                    status: { in: ['READY_FOR_REVIEW', 'OUTPUT_READY', 'NEEDS_REVISION'] },
                },
                take: 8,
                orderBy: { updatedAt: 'desc' },
                include: {
                    initiative: {
                        select: {
                            id: true, title: true,
                            project: { select: { name: true } },
                        },
                    },
                },
            });

            // Initiatives needing plan approval
            const planReviews = await prisma.initiative.findMany({
                where: {
                    companyId,
                    status: { in: ['PLAN_IN_REVIEW', 'PLAN_REVISION'] },
                },
                take: 4,
                orderBy: { updatedAt: 'desc' },
                select: { id: true, title: true, status: true, project: { select: { name: true } } },
            });

            pendingActions = [
                ...actionTasks.map((t) => ({
                    id: t.id,
                    type: t.status === 'READY_FOR_REVIEW' ? 'approve_task'
                        : t.status === 'OUTPUT_READY' ? 'review_output'
                        : 'review_revision',
                    title: t.title,
                    initiativeTitle: t.initiative?.title || null,
                    projectName: t.initiative?.project?.name || null,
                    initiativeId: t.initiative?.id || null,
                    assignedBrainName: (t as Record<string, unknown>).assignedBrainName || null,
                    updatedAt: t.updatedAt?.toISOString() || null,
                })),
                ...planReviews.map((i) => ({
                    id: i.id,
                    type: 'validate_plan',
                    title: i.title,
                    initiativeTitle: null,
                    projectName: i.project?.name || null,
                    initiativeId: i.id,
                    assignedBrainName: null,
                    updatedAt: null,
                })),
            ];
        } catch (e) { console.error('[api/today] pendingActions:', e); }

        return NextResponse.json({
            greeting: {
                userName: dbUser.name || dbUser.email?.split('@')[0] || 'User',
                timeOfDay,
            },
            summary: { pendingApprovals, tasksToday, activeInitiatives, overdueItems },
            schedule: { weekDays, todayAgenda },
            needsAttention,
            teamUpdates,
            activeWork,
            pendingActions,
        });
    } catch (err: unknown) {
        const errMsg = err instanceof Error ? err.message : String(err);
        const errStack = err instanceof Error ? err.stack : undefined;
        console.error('[api/today] Fatal Error:', errMsg);
        return NextResponse.json({ error: errMsg, stack: errStack }, { status: 500 });
    }
}
