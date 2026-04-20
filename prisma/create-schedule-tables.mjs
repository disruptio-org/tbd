import 'dotenv/config';
import pg from 'pg';

const { Client } = pg;

async function main() {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    await client.connect();
    console.log('Connected to PostgreSQL');

    // Create SkillSchedule
    await client.query(`
CREATE TABLE IF NOT EXISTS "SkillSchedule" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "skillId" UUID NOT NULL REFERENCES "AssistantSkill"("id") ON DELETE CASCADE,
    "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "workspaceId" UUID REFERENCES "Project"("id") ON DELETE SET NULL,
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
    "createdBy" UUID NOT NULL REFERENCES "User"("id"),
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
    `);
    console.log('✓ SkillSchedule table created');

    // Create SkillRun
    await client.query(`
CREATE TABLE IF NOT EXISTS "SkillRun" (
    "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "skillId" UUID NOT NULL REFERENCES "AssistantSkill"("id") ON DELETE CASCADE,
    "scheduleId" UUID REFERENCES "SkillSchedule"("id") ON DELETE SET NULL,
    "companyId" UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
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
);
    `);
    console.log('✓ SkillRun table created');

    // Indexes
    await client.query(`
CREATE INDEX IF NOT EXISTS idx_skill_schedule_next_run ON "SkillSchedule"("nextRunAt") WHERE "isActive" = true;
CREATE INDEX IF NOT EXISTS idx_skill_run_schedule ON "SkillRun"("scheduleId", "startedAt");
CREATE INDEX IF NOT EXISTS idx_skill_run_status ON "SkillRun"("status");
    `);
    console.log('✓ Indexes created');

    await client.end();
    console.log('Done!');
}

main().catch(err => { console.error('Error:', err.message); process.exit(1); });
