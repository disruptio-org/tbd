/**
 * document-sources/types.ts
 * Pluggable adapter interfaces for external document management platforms.
 */

/* ─── OAuth Tokens ──────────────────────────────────── */

export interface OAuthTokens {
    accessToken: string;
    refreshToken: string;
    expiresAt: number; // Unix timestamp (ms)
}

/* ─── External Structures ───────────────────────────── */

export interface ExternalFolder {
    id: string;
    name: string;
    path: string;
    parentId: string | null;
    children?: ExternalFolder[];
}

export interface ExternalFile {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    path: string;
    webViewLink: string | null;
    modifiedTime: string; // ISO 8601
    parentFolderId: string | null;
}

export interface FileMetadata {
    id: string;
    name: string;
    mimeType: string;
    size: number;
    modifiedTime: string;
    md5Checksum?: string;
}

export interface ChangeEvent {
    fileId: string;
    removed: boolean;
    file?: ExternalFile;
    time: string;
}

/* ─── Sync Configuration ────────────────────────────── */

export interface SyncConfig {
    selectedFolders: string[];   // Array of folder IDs to sync
    syncFrequency: '1h' | '6h' | '12h' | '24h' | 'manual';
    autoCategorize: boolean;
    useAsKnowledgeSource: boolean;
}

/* ─── Provider Adapter Interface ────────────────────── */

export interface DocumentSourceAdapter {
    readonly provider: string;

    // Authentication
    getAuthUrl(state: string): string;
    handleCallback(code: string): Promise<OAuthTokens>;
    refreshToken(tokens: OAuthTokens): Promise<OAuthTokens>;

    // Discovery
    listFolders(tokens: OAuthTokens, parentId?: string): Promise<ExternalFolder[]>;
    listFiles(tokens: OAuthTokens, folderId: string): Promise<ExternalFile[]>;

    // Ingestion
    downloadFile(tokens: OAuthTokens, fileId: string, mimeType: string): Promise<{ buffer: Buffer; exportedMimeType: string }>;
    getFileMetadata(tokens: OAuthTokens, fileId: string): Promise<FileMetadata>;
}
