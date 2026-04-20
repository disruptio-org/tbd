import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

// Prisma 7: datasource URL must be passed explicitly (defined in prisma.config.ts, not schema)
const prisma = new PrismaClient({
    datasourceUrl: process.env.DATABASE_URL,
});

async function main() {
    console.log('Checking for users...');
    const users = await prisma.user.findMany({
        select: { id: true, email: true, role: true },
        orderBy: { createdAt: 'asc' },
    });

    if (users.length === 0) {
        console.log('No users found.');
        console.log('Please log in at http://localhost:3000/login first.');
        console.log('Then re-run: npx tsx scripts/set_super_admin.ts');
        return;
    }

    console.log(`Found ${users.length} user(s):`);
    for (const u of users) {
        console.log(`  - ${u.email} (${u.role})`);
    }

    const target = users[0];
    if (target.role === 'SUPER_ADMIN') {
        console.log(`\n${target.email} is already SUPER_ADMIN.`);
        return;
    }

    await prisma.user.update({
        where: { id: target.id },
        data: { role: 'SUPER_ADMIN' },
    });
    console.log(`\nDone! ${target.email} is now SUPER_ADMIN!`);
    console.log('Go to: http://localhost:3000/backoffice');
}

main()
    .catch((e) => console.error('Error:', e.message || e))
    .finally(() => prisma.$disconnect());
