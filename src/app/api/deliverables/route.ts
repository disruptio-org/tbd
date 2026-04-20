import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
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

        // Parse query params
        const url = new URL(request.url);
        const projectId = url.searchParams.get('projectId') || undefined;
        const artifactType = url.searchParams.get('type') || undefined;
        const search = url.searchParams.get('search') || undefined;
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = Math.min(parseInt(url.searchParams.get('limit') || '20'), 50);

        // Build where clause
        const where: Record<string, unknown> = {
            initiative: { companyId },
        };
        if (projectId) {
            where.initiative = { ...where.initiative as object, projectId };
        }
        if (artifactType) {
            where.artifactType = artifactType;
        }
        if (search) {
            where.title = { contains: search, mode: 'insensitive' };
        }

        // Fetch artifacts
        const [artifacts, total] = await Promise.all([
            prisma.initiativeArtifact.findMany({
                where,
                take: limit,
                skip: (page - 1) * limit,
                orderBy: { createdAt: 'desc' },
                include: {
                    initiative: {
                        select: {
                            title: true,
                            project: {
                                select: {
                                    id: true,
                                    name: true,
                                    customer: { select: { name: true } },
                                },
                            },
                        },
                    },
                },
            }),
            prisma.initiativeArtifact.count({ where }),
        ]);

        // Aggregate type counts
        const typeCounts = await prisma.initiativeArtifact.groupBy({
            by: ['artifactType'],
            where: { initiative: { companyId } },
            _count: { artifactType: true },
        });

        // Get project list for filter
        const projects = await prisma.project.findMany({
            where: { companyId },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
        });

        const items = artifacts.map((a: any) => ({
            id: a.id,
            title: a.title,
            artifactType: a.artifactType,
            status: a.status,
            content: a.content ? (a.content as string).substring(0, 200) : undefined,
            projectId: a.initiative?.project?.id || undefined,
            projectName: a.initiative?.project?.name || undefined,
            customerName: a.initiative?.project?.customer?.name || undefined,
            initiativeTitle: a.initiative?.title || undefined,
            createdAt: a.createdAt.toISOString(),
            updatedAt: a.updatedAt.toISOString(),
        }));

        return NextResponse.json({
            items,
            total,
            page,
            totalPages: Math.ceil(total / limit),
            typeCounts: typeCounts.map((tc) => ({
                type: tc.artifactType,
                count: tc._count.artifactType,
            })),
            projects,
        });
    } catch (err: unknown) {
        console.error('[api/deliverables] Error:', err);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
