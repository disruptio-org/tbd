-- Create CompanyApiKey table for external API authentication
CREATE TABLE IF NOT EXISTS "CompanyApiKey" (
    "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
    "companyId"  TEXT NOT NULL REFERENCES "Company"("id") ON DELETE CASCADE,
    "label"      TEXT NOT NULL,
    "keyHash"    TEXT NOT NULL UNIQUE,
    "keyPrefix"  TEXT NOT NULL,
    "scopes"     TEXT[] NOT NULL DEFAULT '{}',
    "isActive"   BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMPTZ,
    "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "CompanyApiKey_companyId_idx" ON "CompanyApiKey"("companyId");
CREATE INDEX IF NOT EXISTS "CompanyApiKey_keyHash_idx" ON "CompanyApiKey"("keyHash");
