UPDATE "Document" SET "ocrStatus" = 'PROCESSED' WHERE "ocrProcessed" = true;
UPDATE "Document" SET "ocrStatus" = 'PENDING' WHERE "ocrProcessed" = false;
UPDATE "Document" SET "version" = 1 WHERE "version" IS NULL;
