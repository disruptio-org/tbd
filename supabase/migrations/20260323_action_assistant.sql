-- ══════════════════════════════════════════════════════
-- Action Assistant — Tables
-- ══════════════════════════════════════════════════════
-- Note: User.id and Company.id are TEXT type in this schema

-- 1. User assistant preferences (name, settings)
CREATE TABLE IF NOT EXISTS "UserAssistantPreference" (
    "id"            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId"        TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "companyId"     TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "displayName"   TEXT NOT NULL DEFAULT 'Nousio',
    "voiceEnabled"  BOOLEAN NOT NULL DEFAULT true,
    "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE ("userId")
);
CREATE INDEX IF NOT EXISTS "idx_user_assistant_pref_company" ON "UserAssistantPreference"("companyId");

-- 2. Assistant sessions
CREATE TABLE IF NOT EXISTS "AssistantSession" (
    "id"                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "userId"             TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "companyId"          TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "currentRoute"       TEXT,
    "currentContextJson" JSONB,
    "status"             TEXT NOT NULL DEFAULT 'ACTIVE',
    "startedAt"          TIMESTAMPTZ NOT NULL DEFAULT now(),
    "endedAt"            TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS "idx_assistant_session_user_status" ON "AssistantSession"("userId", "status");
CREATE INDEX IF NOT EXISTS "idx_assistant_session_company"     ON "AssistantSession"("companyId");

-- 3. Assistant messages
CREATE TABLE IF NOT EXISTS "AssistantMessage" (
    "id"        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "sessionId" UUID NOT NULL REFERENCES "AssistantSession"("id") ON DELETE CASCADE,
    "role"      TEXT NOT NULL,
    "content"   TEXT NOT NULL,
    "inputMode" TEXT NOT NULL DEFAULT 'TEXT',
    "metadata"  JSONB,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_assistant_msg_session" ON "AssistantMessage"("sessionId", "createdAt");

-- 4. Assistant action runs (execution log)
CREATE TABLE IF NOT EXISTS "AssistantActionRun" (
    "id"                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "sessionId"             UUID NOT NULL REFERENCES "AssistantSession"("id") ON DELETE CASCADE,
    "companyId"             TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "userId"                TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "intentType"            TEXT NOT NULL,
    "targetModule"          TEXT NOT NULL,
    "targetAction"          TEXT,
    "confidenceScore"       DOUBLE PRECISION,
    "requiresConfirmation"  BOOLEAN NOT NULL DEFAULT false,
    "status"                TEXT NOT NULL DEFAULT 'PENDING',
    "requestPayloadJson"    JSONB,
    "resultPayloadJson"     JSONB,
    "resultLink"            TEXT,
    "groundingStatus"       TEXT,
    "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
    "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "idx_action_run_session"  ON "AssistantActionRun"("sessionId");
CREATE INDEX IF NOT EXISTS "idx_action_run_company"  ON "AssistantActionRun"("companyId");
CREATE INDEX IF NOT EXISTS "idx_action_run_user"     ON "AssistantActionRun"("userId");
