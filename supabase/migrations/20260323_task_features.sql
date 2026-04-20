-- Add new columns to Task table for Phase 2 features
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "isHighlighted" BOOLEAN DEFAULT FALSE;
ALTER TABLE "Task" ADD COLUMN IF NOT EXISTS "estimatedEffort" TEXT;

-- Add ocrStatus to Document table (for document OCR processing)
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "ocrStatus" TEXT;

-- Create TaskDocument join table for linking documents to tasks
-- Uses TEXT columns to match existing Task.id and Document.id types
CREATE TABLE IF NOT EXISTS "TaskDocument" (
    "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    "taskId" TEXT NOT NULL REFERENCES "Task"("id") ON DELETE CASCADE,
    "documentId" TEXT NOT NULL REFERENCES "Document"("id") ON DELETE CASCADE,
    "createdAt" TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE("taskId", "documentId")
);

CREATE INDEX IF NOT EXISTS "idx_task_document_task" ON "TaskDocument"("taskId");
CREATE INDEX IF NOT EXISTS "idx_task_document_doc" ON "TaskDocument"("documentId");
