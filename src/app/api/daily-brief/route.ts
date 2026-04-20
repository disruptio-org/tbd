import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

export const dynamic = 'force-dynamic';

/* ─── GET: Retrieve or generate today's brief ────────── */

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
        const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

        // Check for cached brief (use string date comparison for safety)
        try {
            const existing = await prisma.dailyBrief.findFirst({
                where: { companyId, userId: dbUser.id, date: new Date(todayStr) },
            });
            if (existing) {
                return NextResponse.json({ brief: existing });
            }
        } catch (e) {
            console.log('[daily-brief] Cache check failed, generating fresh:', e);
        }

        // ── Aggregate data for the brief ──
        const todayStart = new Date(todayStr);
        const todayEnd = new Date(todayStart);
        todayEnd.setDate(todayEnd.getDate() + 1);
        const yesterdayStart = new Date(todayStart);
        yesterdayStart.setDate(yesterdayStart.getDate() - 1);

        // Gather data in parallel with individual error handling
        const [activeProjects, overdueTasks, todayTasks, weekDone, prevWeekDone, knowledgeCoverage, pendingTasks, pendingPlans] = await Promise.all([
            prisma.project.findMany({
                where: { companyId, status: 'active' },
                include: {
                    customer: { select: { name: true } },
                    taskBoards: { include: { tasks: { select: { isCompleted: true } } } },
                },
            }).catch(() => []),
            prisma.task.findMany({
                where: { companyId, isCompleted: false, dueDate: { lt: todayStart } },
                take: 10,
                orderBy: { dueDate: 'asc' },
                include: { board: { select: { id: true, projectId: true, project: { select: { id: true, name: true } } } } },
            }).catch(() => []),
            prisma.task.findMany({
                where: { companyId, isCompleted: false, dueDate: { gte: todayStart, lt: todayEnd } },
                take: 10,
                include: { board: { select: { id: true, projectId: true, project: { select: { id: true, name: true } } } } },
            }).catch(() => []),
            prisma.task.count({
                where: { companyId, isCompleted: true, updatedAt: { gte: new Date(todayStart.getTime() - 7 * 86400000) } },
            }).catch(() => 0),
            prisma.task.count({
                where: { companyId, isCompleted: true, updatedAt: { gte: new Date(todayStart.getTime() - 14 * 86400000), lt: new Date(todayStart.getTime() - 7 * 86400000) } },
            }).catch(() => 0),
            prisma.companyDNA.findUnique({ where: { companyId }, select: { coverageScore: true } }).catch(() => null),
            // Boardroom: tasks needing human action
            prisma.initiativeTask.findMany({
                where: { initiative: { companyId }, status: { in: ['READY_FOR_REVIEW', 'OUTPUT_READY', 'NEEDS_REVISION'] } },
                take: 10,
                orderBy: { updatedAt: 'desc' },
                include: { initiative: { select: { title: true, project: { select: { name: true } } } } },
            }).catch(() => []),
            // Boardroom: plans needing approval
            prisma.initiative.findMany({
                where: { companyId, status: { in: ['PLAN_IN_REVIEW', 'PLAN_REVISION'] } },
                take: 5,
                orderBy: { updatedAt: 'desc' },
                select: { id: true, title: true, status: true, project: { select: { name: true } } },
            }).catch(() => []),
        ]);

        // Build sections
        const sections = {
            overdueTasks: (overdueTasks as Array<Record<string, unknown>>).map((t: Record<string, unknown>) => ({
                id: t.id, title: t.title,
                boardId: (t.board as Record<string, unknown>)?.id,
                projectId: ((t.board as Record<string, unknown>)?.project as Record<string, unknown>)?.id,
                projectName: ((t.board as Record<string, unknown>)?.project as Record<string, unknown>)?.name,
                dueDate: t.dueDate,
            })),
            todayFocus: (todayTasks as Array<Record<string, unknown>>).map((t: Record<string, unknown>) => ({
                id: t.id, title: t.title, priority: t.priority,
                boardId: (t.board as Record<string, unknown>)?.id,
                projectId: ((t.board as Record<string, unknown>)?.project as Record<string, unknown>)?.id,
                projectName: ((t.board as Record<string, unknown>)?.project as Record<string, unknown>)?.name,
            })),
            velocity: {
                activeProjects: (activeProjects as unknown[]).length,
                tasksCompletedThisWeek: weekDone as number,
                tasksCompletedLastWeek: prevWeekDone as number,
                trend: (weekDone as number) > (prevWeekDone as number) ? 'up' : (weekDone as number) < (prevWeekDone as number) ? 'down' : 'stable',
                knowledgeCoverage: (knowledgeCoverage as Record<string, unknown>)?.coverageScore || 0,
            },
            projectSummaries: (activeProjects as Array<Record<string, unknown>>).map((p: Record<string, unknown>) => {
                const boards = (p.taskBoards as Array<Record<string, unknown>>) || [];
                const allTasks = boards.flatMap((b: Record<string, unknown>) => (b.tasks as Array<Record<string, unknown>>) || []);
                const total = allTasks.length;
                const done = allTasks.filter((t: Record<string, unknown>) => t.isCompleted).length;
                return { id: p.id, name: p.name, customer: (p.customer as Record<string, unknown>)?.name, progress: total > 0 ? Math.round((done / total) * 100) : 0, totalTasks: total, completedTasks: done };
            }),
            pendingReviews: {
                tasks: (pendingTasks as Array<Record<string, unknown>>).map((t: Record<string, unknown>) => ({
                    id: t.id,
                    title: t.title,
                    status: t.status,
                    type: t.status === 'READY_FOR_REVIEW' ? 'Needs Approval' : t.status === 'OUTPUT_READY' ? 'Needs Output Review' : 'Needs Revision Review',
                    initiativeTitle: (t.initiative as Record<string, unknown>)?.title || null,
                    projectName: ((t.initiative as Record<string, unknown>)?.project as Record<string, unknown>)?.name || null,
                })),
                plans: (pendingPlans as Array<Record<string, unknown>>).map((i: Record<string, unknown>) => ({
                    id: i.id,
                    title: i.title,
                    status: i.status,
                    projectName: (i.project as Record<string, unknown>)?.name || null,
                })),
                totalCount: (pendingTasks as unknown[]).length + (pendingPlans as unknown[]).length,
            },
            skillInsights: [] as Array<{ skillName: string; outputTitle: string | null; outputPreview: string; generatedAt: string }>,
        };

        // ── Fetch skill insights for brief inclusion ──
        try {
            const db = createAdminClient();
            const { data: briefSchedules } = await db
                .from('SkillSchedule')
                .select('id, skillId, name')
                .eq('companyId', companyId)
                .eq('isActive', true)
                .eq('includeInBrief', true);

            if (briefSchedules && briefSchedules.length > 0) {
                for (const sch of briefSchedules) {
                    const { data: latestRun } = await db
                        .from('SkillRun')
                        .select('outputTitle, outputText, finishedAt, startedAt')
                        .eq('scheduleId', sch.id)
                        .eq('status', 'success')
                        .order('startedAt', { ascending: false })
                        .limit(1)
                        .maybeSingle();

                    if (latestRun?.outputText) {
                        // Get skill name
                        const { data: skill } = await db
                            .from('AssistantSkill')
                            .select('name')
                            .eq('id', sch.skillId)
                            .maybeSingle();

                        const preview = latestRun.outputText
                            .replace(/\*\*/g, '').replace(/\*/g, '').replace(/#{1,6}\s/g, '')
                            .substring(0, 500).trim();

                        sections.skillInsights.push({
                            skillName: skill?.name || sch.name,
                            outputTitle: latestRun.outputTitle,
                            outputPreview: preview,
                            generatedAt: latestRun.finishedAt || latestRun.startedAt,
                        });
                    }
                }
            }
        } catch (e) {
            console.log('[daily-brief] Skill insights fetch error:', e);
        }

        // ── Generate brief text ──
        const userName = dbUser.name || dbUser.email?.split('@')[0] || 'there';
        const hour = now.getHours();
        const timeOfDay = hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening';

        let briefText = '';
        const hasOpenAI = !!process.env.OPENAI_API_KEY;

        if (hasOpenAI) {
            try {
                const OpenAI = (await import('openai')).default;
                const openai = new OpenAI();
                const lang = dbUser.company?.language === 'pt-PT' ? 'Portuguese' : 'English';
                const completion = await openai.chat.completions.create({
                    model: 'gpt-4o-mini',
                    temperature: 0.7,
                    max_tokens: 1200,
                    messages: [
                        {
                            role: 'system',
                            content: `You are the Nousio AI Operating System's daily brief writer. Write concise, executive-level morning briefings. Write in ${lang}. Be direct, strategic, and actionable. Use markdown. Keep under 600 words. Structure:
1. **Opening** — Good ${timeOfDay} greeting with count of items needing attention
2. **Today's Focus** — 3-5 priority items
3. **Pending Reviews** — If there are pending reviews/approvals from AI initiatives, list them with action required (Approve, Review Output, Validate Plan). This is CRITICAL for the user's workflow.
4. **Projects** — Status summary of active projects
5. **Velocity** — Trend summary
6. **Skill Insights** — If there are scheduled AI skill outputs available (e.g. market analysis, trend reports), include a brief summary of key findings from each. Keep to 2-3 sentences per skill.
7. **Strategic Note** — One strategic observation
Use **bold** labels inline. Be conversational but sharp.`,
                        },
                        { role: 'user', content: `Brief for ${userName}:\n${JSON.stringify(sections, null, 2)}` },
                    ],
                });
                briefText = completion.choices[0]?.message?.content || '';
            } catch (err) {
                console.error('[daily-brief] OpenAI error:', err);
            }
        }

        // Fallback if LLM failed or no API key
        if (!briefText) {
            briefText = generateFallbackBrief(userName, timeOfDay, sections);
        }

        // ── Save to database ──
        let brief;
        try {
            brief = await prisma.dailyBrief.create({
                data: {
                    companyId,
                    userId: dbUser.id,
                    date: new Date(todayStr),
                    briefText,
                    sections: sections as object,
                },
            });
        } catch (dbErr) {
            console.error('[daily-brief] DB save error:', dbErr);
            // Return without saving if DB fails
            brief = {
                id: 'temp',
                companyId,
                userId: dbUser.id,
                date: todayStr,
                briefText,
                sections,
                generatedAt: now.toISOString(),
                audioUrl: null,
                audioDuration: null,
            };
        }

        return NextResponse.json({ brief });
    } catch (err) {
        console.error('[api/daily-brief] Error:', err);
        return NextResponse.json({
            error: 'Failed to generate brief',
            details: err instanceof Error ? err.message : String(err),
        }, { status: 500 });
    }
}

/* ─── POST: Force regenerate ─────────────────────────── */

export async function POST() {
    try {
        const { prisma } = await import('@/lib/prisma');
        const supabase = await createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

        const dbUser = await prisma.user.findUnique({ where: { email: user.email! } });
        if (!dbUser?.companyId) return NextResponse.json({ error: 'No company' }, { status: 404 });

        const todayStr = new Date().toISOString().split('T')[0];

        // Delete existing brief
        await prisma.dailyBrief.deleteMany({
            where: { companyId: dbUser.companyId, userId: dbUser.id, date: new Date(todayStr) },
        }).catch(() => {});

        // Return signal to refetch
        return NextResponse.json({ deleted: true, message: 'Brief deleted, refetch GET to regenerate' });
    } catch (err) {
        console.error('[api/daily-brief] POST error:', err);
        return NextResponse.json({ error: 'Failed to regenerate' }, { status: 500 });
    }
}

/* ─── Fallback ───────────────────────────────────────── */

function generateFallbackBrief(userName: string, timeOfDay: string, sections: Record<string, unknown>): string {
    const overdue = (sections.overdueTasks as unknown[]) || [];
    const focus = (sections.todayFocus as Array<Record<string, unknown>>) || [];
    const projects = (sections.projectSummaries as Array<Record<string, unknown>>) || [];
    const velocity = sections.velocity as Record<string, unknown>;

    let text = `**Good ${timeOfDay}, ${userName}.**\n\n`;

    if (overdue.length > 0) {
        text += `You have **${overdue.length} overdue items** requiring attention.\n\n`;
    } else {
        text += `All clear — no overdue items.\n\n`;
    }

    if (projects.length > 0) {
        text += `**Active Projects (${projects.length}):**\n`;
        projects.forEach((p) => {
            text += `- **${p.name}**${p.customer ? ` (${p.customer})` : ''} — ${p.progress}% complete (${p.completedTasks}/${p.totalTasks} tasks)\n`;
        });
        text += '\n';
    }

    if (focus.length > 0) {
        text += `**Today's Focus:**\n`;
        focus.slice(0, 5).forEach((t, i) => {
            text += `${i + 1}. ${t.title}${t.projectName ? ` — ${t.projectName}` : ''}\n`;
        });
        text += '\n';
    }

    const trend = velocity?.trend as string;
    const thisWeek = velocity?.tasksCompletedThisWeek as number || 0;
    const lastWeek = velocity?.tasksCompletedLastWeek as number || 0;
    text += `**Velocity:** ${thisWeek} tasks this week vs ${lastWeek} last week`;
    if (trend === 'up') text += ' — trending up ↑\n';
    else if (trend === 'down') text += ' — trending down ↓\n';
    else text += ' — stable →\n';

    text += `\n**Strategic Note:** You're managing ${projects.length} active projects. Focus on maintaining delivery velocity and clearing any blockers before they compound.`;

    // Pending reviews from boardroom
    const pendingReviews = sections.pendingReviews as Record<string, unknown>;
    if (pendingReviews) {
        const totalPending = pendingReviews.totalCount as number || 0;
        if (totalPending > 0) {
            text += '\n\n**Pending Reviews:**\n';
            const tasks = (pendingReviews.tasks as Array<Record<string, unknown>>) || [];
            const plans = (pendingReviews.plans as Array<Record<string, unknown>>) || [];
            tasks.forEach((t) => {
                text += `- **${t.type}**: ${t.title}${t.initiativeTitle ? ` — ${t.initiativeTitle}` : ''}${t.projectName ? ` (${t.projectName})` : ''}\n`;
            });
            plans.forEach((p) => {
                text += `- **Validate Plan**: ${p.title}${p.projectName ? ` (${p.projectName})` : ''}\n`;
            });
        }
    }

    return text;
}
