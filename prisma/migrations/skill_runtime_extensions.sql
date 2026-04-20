-- ═══════════════════════════════════════════════════════
-- ChatGPT-Compatible Skill Runtime — SkillRun Extensions
-- ═══════════════════════════════════════════════════════
-- Adds runtime metadata columns to the Supabase-native SkillRun table.

ALTER TABLE "SkillRun" ADD COLUMN IF NOT EXISTS "executionTrace" JSONB;
ALTER TABLE "SkillRun" ADD COLUMN IF NOT EXISTS "compatibilityCheckResult" TEXT DEFAULT 'UNKNOWN';
ALTER TABLE "SkillRun" ADD COLUMN IF NOT EXISTS "degradationFlags" JSONB;
ALTER TABLE "SkillRun" ADD COLUMN IF NOT EXISTS "toolInvocations" JSONB;
ALTER TABLE "SkillRun" ADD COLUMN IF NOT EXISTS "connectorInvocations" JSONB;
ALTER TABLE "SkillRun" ADD COLUMN IF NOT EXISTS "artifactIds" TEXT[];
ALTER TABLE "SkillRun" ADD COLUMN IF NOT EXISTS "uiIntents" JSONB;
ALTER TABLE "SkillRun" ADD COLUMN IF NOT EXISTS "resultEnvelope" JSONB;
ALTER TABLE "SkillRun" ADD COLUMN IF NOT EXISTS "responseMode" TEXT DEFAULT 'chat';

-- Extend SkillVersionLog with runtime info
ALTER TABLE "SkillVersionLog" ADD COLUMN IF NOT EXISTS "runtimeCategory" TEXT;
ALTER TABLE "SkillVersionLog" ADD COLUMN IF NOT EXISTS "compatibilityState" TEXT;
