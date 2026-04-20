/**
 * ═══════════════════════════════════════════════════════
 * Artifact Manager — First-class artifact lifecycle
 * ═══════════════════════════════════════════════════════
 *
 * Handles creation, storage, retrieval, and deletion of
 * runtime artifacts produced by skill execution.
 * Uses Supabase Storage for file persistence.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import type { ArtifactRef, ArtifactType } from './types';

const BUCKET_NAME = 'skill-artifacts';

// MIME type mapping for common artifact types
const ARTIFACT_MIME_MAP: Record<ArtifactType, string> = {
    presentation: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    document: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    spreadsheet: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pdf: 'application/pdf',
    image: 'image/png',
    zip: 'application/zip',
    chart: 'image/svg+xml',
    structured_ui: 'application/json',
};

// File extension mapping
const ARTIFACT_EXT_MAP: Record<ArtifactType, string> = {
    presentation: '.pptx',
    document: '.docx',
    spreadsheet: '.xlsx',
    pdf: '.pdf',
    image: '.png',
    zip: '.zip',
    chart: '.svg',
    structured_ui: '.json',
};

/**
 * Ensure the storage bucket exists. Called once on first use.
 */
async function ensureBucket(): Promise<void> {
    const db = createAdminClient();
    const { data: buckets } = await db.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET_NAME);
    if (!exists) {
        await db.storage.createBucket(BUCKET_NAME, {
            public: false,
            fileSizeLimit: 52428800, // 50MB
            allowedMimeTypes: Object.values(ARTIFACT_MIME_MAP),
        });
    }
}

let bucketReady = false;

/**
 * Create and store an artifact from a generated buffer.
 */
export async function createArtifact(options: {
    companyId: string;
    skillId?: string;
    skillRunId: string;
    chainStepIndex?: number;
    type: ArtifactType;
    filename?: string;
    buffer: Buffer | Uint8Array;
    mimeType?: string;
    metadata?: Record<string, unknown>;
}): Promise<ArtifactRef> {
    if (!bucketReady) {
        await ensureBucket();
        bucketReady = true;
    }

    const db = createAdminClient();
    const {
        companyId,
        skillId,
        skillRunId,
        chainStepIndex,
        type,
        buffer,
        metadata,
    } = options;

    const mimeType = options.mimeType || ARTIFACT_MIME_MAP[type] || 'application/octet-stream';
    const ext = ARTIFACT_EXT_MAP[type] || '';
    const id = crypto.randomUUID();
    const filename = options.filename || `artifact_${id.substring(0, 8)}${ext}`;
    const storagePath = `${companyId}/${skillRunId}/${filename}`;

    // Upload to Supabase Storage
    const { error: uploadError } = await db.storage
        .from(BUCKET_NAME)
        .upload(storagePath, buffer, {
            contentType: mimeType,
            upsert: false,
        });

    if (uploadError) {
        throw new Error(`Artifact upload failed: ${uploadError.message}`);
    }

    // Create database record
    const { error: dbError } = await db.from('SkillArtifact').insert({
        id,
        companyId,
        skillId: skillId || null,
        skillRunId,
        chainStepIndex: chainStepIndex ?? null,
        type,
        mimeType,
        filename,
        storagePath,
        sizeBytes: buffer.length,
        previewUrl: null,
        metadata: metadata || null,
    });

    if (dbError) {
        // Cleanup uploaded file on DB error
        await db.storage.from(BUCKET_NAME).remove([storagePath]);
        throw new Error(`Artifact record creation failed: ${dbError.message}`);
    }

    return {
        id,
        type,
        mimeType,
        filename,
        storagePath,
        sizeBytes: buffer.length,
        metadata,
    };
}

/**
 * Get artifact metadata and a signed download URL.
 */
export async function getArtifact(artifactId: string, companyId: string): Promise<(ArtifactRef & { downloadUrl: string }) | null> {
    const db = createAdminClient();

    const { data, error } = await db
        .from('SkillArtifact')
        .select('*')
        .eq('id', artifactId)
        .eq('companyId', companyId)
        .maybeSingle();

    if (error || !data) return null;

    // Generate signed URL (valid for 1 hour)
    const { data: urlData } = await db.storage
        .from(BUCKET_NAME)
        .createSignedUrl(data.storagePath, 3600);

    return {
        id: data.id,
        type: data.type as ArtifactType,
        mimeType: data.mimeType,
        filename: data.filename,
        storagePath: data.storagePath,
        downloadUrl: urlData?.signedUrl || '',
        previewUrl: data.previewUrl || undefined,
        sizeBytes: data.sizeBytes,
        metadata: data.metadata as Record<string, unknown> | undefined,
    };
}

/**
 * List all artifacts for a given skill run.
 */
export async function listRunArtifacts(skillRunId: string, companyId: string): Promise<ArtifactRef[]> {
    const db = createAdminClient();

    const { data, error } = await db
        .from('SkillArtifact')
        .select('*')
        .eq('skillRunId', skillRunId)
        .eq('companyId', companyId)
        .order('createdAt', { ascending: true });

    if (error || !data) return [];

    // Generate signed URLs for all artifacts
    const artifacts: ArtifactRef[] = [];
    for (const row of data) {
        const { data: urlData } = await db.storage
            .from(BUCKET_NAME)
            .createSignedUrl(row.storagePath, 3600);

        artifacts.push({
            id: row.id,
            type: row.type as ArtifactType,
            mimeType: row.mimeType,
            filename: row.filename,
            storagePath: row.storagePath,
            downloadUrl: urlData?.signedUrl || undefined,
            previewUrl: row.previewUrl || undefined,
            sizeBytes: row.sizeBytes,
            metadata: row.metadata as Record<string, unknown> | undefined,
        });
    }

    return artifacts;
}

/**
 * Delete an artifact (file + record).
 */
export async function deleteArtifact(artifactId: string, companyId: string): Promise<boolean> {
    const db = createAdminClient();

    const { data } = await db
        .from('SkillArtifact')
        .select('storagePath')
        .eq('id', artifactId)
        .eq('companyId', companyId)
        .maybeSingle();

    if (!data) return false;

    // Delete from storage
    await db.storage.from(BUCKET_NAME).remove([data.storagePath]);

    // Delete record
    const { error } = await db
        .from('SkillArtifact')
        .delete()
        .eq('id', artifactId);

    return !error;
}
