-- ═══════════════════════════════════════════════════════
-- Access Group Management — Database Migration
-- ═══════════════════════════════════════════════════════
-- Run this migration against your Supabase PostgreSQL database.
-- It creates three new tables and adds a status column to User.
-- ═══════════════════════════════════════════════════════

-- 1. Add status column to User table (if not exists)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'User' AND column_name = 'status'
    ) THEN
        ALTER TABLE "User" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE';
    END IF;
END $$;

-- 2. AccessGroup table
CREATE TABLE IF NOT EXISTS "AccessGroup" (
    "id"              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId"       UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "name"            TEXT NOT NULL,
    "description"     TEXT,
    "isSystemManaged" BOOLEAN NOT NULL DEFAULT FALSE,
    "createdById"     UUID REFERENCES "User"("id") ON DELETE SET NULL,
    "updatedById"     UUID REFERENCES "User"("id") ON DELETE SET NULL,
    "createdAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "updatedAt"       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "archivedAt"      TIMESTAMPTZ,

    -- Unique group name within a company
    CONSTRAINT "AccessGroup_companyId_name_key" UNIQUE ("companyId", "name")
);

CREATE INDEX IF NOT EXISTS "AccessGroup_companyId_idx" ON "AccessGroup" ("companyId");

-- 3. AccessGroupMembership table (user ↔ group many-to-many)
CREATE TABLE IF NOT EXISTS "AccessGroupMembership" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId"      UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "accessGroupId"  UUID NOT NULL REFERENCES "AccessGroup"("id") ON DELETE CASCADE,
    "userId"         UUID NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    "createdById"    UUID REFERENCES "User"("id") ON DELETE SET NULL,

    -- A user can only belong to a specific group once
    CONSTRAINT "AccessGroupMembership_group_user_key" UNIQUE ("accessGroupId", "userId")
);

CREATE INDEX IF NOT EXISTS "AccessGroupMembership_companyId_idx" ON "AccessGroupMembership" ("companyId");
CREATE INDEX IF NOT EXISTS "AccessGroupMembership_userId_idx" ON "AccessGroupMembership" ("userId");
CREATE INDEX IF NOT EXISTS "AccessGroupMembership_accessGroupId_idx" ON "AccessGroupMembership" ("accessGroupId");

-- 4. AccessPermissionGrant table (permissions assigned to groups)
CREATE TABLE IF NOT EXISTS "AccessPermissionGrant" (
    "id"             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId"      UUID NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "accessGroupId"  UUID NOT NULL REFERENCES "AccessGroup"("id") ON DELETE CASCADE,
    "resourceType"   TEXT NOT NULL,  -- 'FEATURE', 'SUB_FEATURE', 'PROJECT_SCOPE'
    "resourceKey"    TEXT NOT NULL,  -- e.g. 'marketing', 'documents.upload', 'project:<id>'
    "accessLevel"    TEXT NOT NULL DEFAULT 'USE', -- 'VIEW', 'USE', 'MANAGE'
    "createdAt"      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Each grant should be unique per group + resource
    CONSTRAINT "AccessPermissionGrant_group_resource_key" UNIQUE ("accessGroupId", "resourceType", "resourceKey")
);

CREATE INDEX IF NOT EXISTS "AccessPermissionGrant_companyId_idx" ON "AccessPermissionGrant" ("companyId");
CREATE INDEX IF NOT EXISTS "AccessPermissionGrant_accessGroupId_idx" ON "AccessPermissionGrant" ("accessGroupId");

-- 5. Enable Row Level Security (match Supabase convention)
ALTER TABLE "AccessGroup" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessGroupMembership" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "AccessPermissionGrant" ENABLE ROW LEVEL SECURITY;

-- Allow service_role full access (used by our API via createAdminClient)
CREATE POLICY "service_role_all_AccessGroup" ON "AccessGroup"
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_AccessGroupMembership" ON "AccessGroupMembership"
    FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "service_role_all_AccessPermissionGrant" ON "AccessPermissionGrant"
    FOR ALL TO service_role USING (true) WITH CHECK (true);
