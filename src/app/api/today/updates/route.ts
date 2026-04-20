import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/today/updates — Unified activity feed across all AI & platform activity.
 * Query params: ?range=24h|7d|30d (default 7d), ?type=all|ai_action|initiative|task|content|artifact
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
        const range = url.searchParams.get('range') || '7d';
        const filterType = url.searchParams.get('type') || 'all';

        // Compute date boundary
        const now = new Date();
        const rangeMs = range === '24h' ? 24 * 60 * 60 * 1000
            : range === '30d' ? 30 * 24 * 60 * 60 * 1000
            : 7 * 24 * 60 * 60 * 1000;
        const since = new Date(now.getTime() - rangeMs);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const events: Array<Record<string, any>> = [];
        const byType: Record<string, number> = {};

        // ── 1. AI Action Runs ──
        if (filterType === 'all' || filterType === 'ai_action') {
            try {
                const runs = await prisma.assistantActionRun.findMany({
                    where: { companyId, createdAt: { gte: since }, status: { in: ['SUCCESS', 'PARTIAL_SUCCESS', 'FAILED'] } },
                    take: 30,
                    orderBy: { createdAt: 'desc' },
                    include: { session: { select: { userId: true } } },
                });
                for (const r of runs) {
                    events.push({
                        id: r.id,
                        type: 'ai_action',
                        title: `${r.intentType === 'generate_content' ? 'Generated' : r.intentType === 'create_task' ? 'Created task' : r.intentType === 'search_leads' ? 'Searched leads' : r.intentType === 'query_knowledge' ? 'Answered query' : 'Executed'}: ${r.targetAction || r.targetModule}`,
                        description: `${r.targetModule} action via AI assistant`,
                        agentName: r.targetModule,
                        status: r.status === 'SUCCESS' ? 'success' : r.status === 'PARTIAL_SUCCESS' ? 'partial' : 'failed',
                        timestamp: r.createdAt.toISOString(),
                        actionUrl: r.resultLink || undefined,
                    });
                }
                byType['ai_action'] = runs.length;
            } catch (e) { console.error('[updates] AI actions:', e); }
        }

        // ── 2. Initiative Events ──
        if (filterType === 'all' || filterType === 'initiative') {
            try {
                const companyInits = await prisma.initiative.findMany({
                    where: { companyId },
                    select: { id: true },
                });
                const initIds = companyInits.map(i => i.id);
                if (initIds.length > 0) {
                    const initEvents = await prisma.initiativeEvent.findMany({
                        where: { initiativeId: { in: initIds }, createdAt: { gte: since } },
                        take: 30,
                        orderBy: { createdAt: 'desc' },
                        include: { initiative: { select: { title: true, project: { select: { name: true } } } } },
                    });
                    for (const e of initEvents) {
                        events.push({
                            id: e.id,
                            type: 'initiative_event',
                            title: e.description || `${e.action} on initiative`,
                            description: e.initiative?.title || undefined,
                            agentName: e.actorLabel || 'System',
                            projectName: e.initiative?.project?.name || undefined,
                            status: e.action === 'completed' ? 'success' : e.action === 'blocked' ? 'blocked' : 'info',
                            timestamp: e.createdAt.toISOString(),
                            actionUrl: `/boardroom`,
                        });
                    }
                    byType['initiative_event'] = initEvents.length;
                }
            } catch (e) { console.error('[updates] Initiatives:', e); }
        }

        // ── 3. Task Completions ──
        if (filterType === 'all' || filterType === 'task') {
            try {
                const completedTasks = await prisma.task.findMany({
                    where: { companyId, isCompleted: true, updatedAt: { gte: since } },
                    take: 20,
                    orderBy: { updatedAt: 'desc' },
                    include: { board: { include: { project: true } } },
                });
                for (const t of completedTasks) {
                    events.push({
                        id: t.id,
                        type: 'task_completed',
                        title: `Completed: ${t.title}`,
                        projectName: t.board?.project?.name || undefined,
                        agentName: 'Tasks',
                        status: 'success',
                        timestamp: t.updatedAt.toISOString(),
                        actionUrl: `/tasks`,
                    });
                }
                byType['task_completed'] = completedTasks.length;
            } catch (e) { console.error('[updates] Tasks:', e); }
        }

        // ── 4. Content Generated ──
        if (filterType === 'all' || filterType === 'content') {
            try {
                const [mktRuns, salesRuns] = await Promise.allSettled([
                    prisma.marketingGenerationRun.findMany({
                        where: { companyId, createdAt: { gte: since }, status: 'completed' },
                        take: 15,
                        orderBy: { createdAt: 'desc' },
                        select: { id: true, title: true, contentType: true, createdAt: true },
                    }),
                    prisma.salesGenerationRun.findMany({
                        where: { companyId, createdAt: { gte: since }, status: 'completed' },
                        take: 10,
                        orderBy: { createdAt: 'desc' },
                        select: { id: true, title: true, taskType: true, createdAt: true },
                    }),
                ]);

                const allContent = [
                    ...(mktRuns.status === 'fulfilled' ? mktRuns.value.map(r => ({ ...r, module: 'marketing' })) : []),
                    ...(salesRuns.status === 'fulfilled' ? salesRuns.value.map(r => ({ ...r, module: 'sales' })) : []),
                ];
                for (const c of allContent as any[]) {
                    const cType = c.contentType || c.taskType;
                    events.push({
                        id: c.id,
                        type: 'content_created',
                        title: `${cType?.replace(/_/g, ' ') || 'Content'}: ${c.title || 'Untitled'}`,
                        agentName: c.module,
                        status: 'success',
                        timestamp: c.createdAt.toISOString(),
                        actionUrl: `/${c.module}?runId=${c.id}`,
                    });
                }
                byType['content_created'] = allContent.length;
            } catch (e) { console.error('[updates] Content:', e); }
        }

        // ── 5. Artifacts ──
        if (filterType === 'all' || filterType === 'artifact') {
            try {
                const artifacts = await prisma.initiativeArtifact.findMany({
                    where: { initiative: { companyId }, createdAt: { gte: since } },
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    include: { initiative: { select: { title: true, project: { select: { name: true } } } } },
                });
                for (const a of artifacts) {
                    events.push({
                        id: a.id,
                        type: 'artifact_created',
                        title: `Artifact: ${a.title}`,
                        description: `${a.artifactType} for ${a.initiative?.title || 'initiative'}`,
                        projectName: a.initiative?.project?.name || undefined,
                        agentName: 'Boardroom',
                        status: a.status === 'APPROVED' ? 'success' : 'info',
                        timestamp: a.createdAt.toISOString(),
                        actionUrl: `/boardroom`,
                    });
                }
                byType['artifact_created'] = artifacts.length;
            } catch (e) { console.error('[updates] Artifacts:', e); }
        }

        // Sort all events chronologically (newest first)
        events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

        return NextResponse.json({
            events: events.slice(0, 50),
            summary: {
                total: events.length,
                byType,
                range,
            },
        });
    } catch (err: unknown) {
        console.error('[api/today/updates] Error:', err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
