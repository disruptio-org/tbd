const { config } = require('dotenv');
config();

const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    console.log('Connected to PostgreSQL');

    try {
        // Step 1: Create SkillSchedule (no FK constraints first)
        await client.query(`
            CREATE TABLE IF NOT EXISTS "SkillSchedule" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "skillId" UUID NOT NULL,
                "companyId" UUID NOT NULL,
                "workspaceId" UUID DEFAULT NULL,
                "name" TEXT NOT NULL,
                "frequency" TEXT NOT NULL DEFAULT 'daily',
                "runAtTime" TEXT NOT NULL DEFAULT '08:00',
                "timezone" TEXT NOT NULL DEFAULT 'UTC',
                "daysOfWeek" INTEGER[] DEFAULT NULL,
                "intervalMinutes" INTEGER DEFAULT NULL,
                "cronExpression" TEXT DEFAULT NULL,
                "isActive" BOOLEAN NOT NULL DEFAULT true,
                "nextRunAt" TIMESTAMPTZ NOT NULL,
                "lastRunAt" TIMESTAMPTZ DEFAULT NULL,
                "outputTarget" TEXT NOT NULL DEFAULT 'database',
                "outputFormat" TEXT NOT NULL DEFAULT 'full',
                "createdBy" UUID NOT NULL,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);
        console.log('✓ SkillSchedule table created');
    } catch (err) {
        console.log('SkillSchedule error:', err.message);
    }

    try {
        // Step 2: Create SkillRun
        await client.query(`
            CREATE TABLE IF NOT EXISTS "SkillRun" (
                "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                "skillId" UUID NOT NULL,
                "scheduleId" UUID DEFAULT NULL,
                "companyId" UUID NOT NULL,
                "triggerType" TEXT NOT NULL DEFAULT 'manual',
                "status" TEXT NOT NULL DEFAULT 'queued',
                "startedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
                "finishedAt" TIMESTAMPTZ DEFAULT NULL,
                "inputPayload" JSONB DEFAULT '{}',
                "runtimeContext" JSONB DEFAULT '{}',
                "outputTitle" TEXT DEFAULT NULL,
                "outputText" TEXT DEFAULT NULL,
                "outputPayload" JSONB DEFAULT NULL,
                "errorMessage" TEXT DEFAULT NULL,
                "modelUsed" TEXT DEFAULT NULL,
                "tokenUsage" JSONB DEFAULT NULL,
                "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);
        console.log('✓ SkillRun table created');
    } catch (err) {
        console.log('SkillRun error:', err.message);
    }

    try {
        // Step 3: Add FK constraints
        await client.query(`
            ALTER TABLE "SkillSchedule" ADD CONSTRAINT fk_schedule_skill FOREIGN KEY ("skillId") REFERENCES "AssistantSkill"("id") ON DELETE CASCADE;
        `).catch(() => {});
        await client.query(`
            ALTER TABLE "SkillSchedule" ADD CONSTRAINT fk_schedule_company FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
        `).catch(() => {});
        await client.query(`
            ALTER TABLE "SkillRun" ADD CONSTRAINT fk_run_skill FOREIGN KEY ("skillId") REFERENCES "AssistantSkill"("id") ON DELETE CASCADE;
        `).catch(() => {});
        await client.query(`
            ALTER TABLE "SkillRun" ADD CONSTRAINT fk_run_company FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE CASCADE;
        `).catch(() => {});
        await client.query(`
            ALTER TABLE "SkillRun" ADD CONSTRAINT fk_run_schedule FOREIGN KEY ("scheduleId") REFERENCES "SkillSchedule"("id") ON DELETE SET NULL;
        `).catch(() => {});
        console.log('✓ Foreign keys added');
    } catch (err) {
        console.log('FK error:', err.message);
    }

    try {
        // Step 4: Indexes
        await client.query(`CREATE INDEX IF NOT EXISTS idx_skill_schedule_next_run ON "SkillSchedule"("nextRunAt") WHERE "isActive" = true`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_skill_run_schedule ON "SkillRun"("scheduleId", "startedAt")`);
        await client.query(`CREATE INDEX IF NOT EXISTS idx_skill_run_status ON "SkillRun"("status")`);
        console.log('✓ Indexes created');
    } catch (err) {
        console.log('Index error:', err.message);
    }

    await client.end();
    console.log('Done!');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
