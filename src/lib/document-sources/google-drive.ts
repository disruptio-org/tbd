/**
 * document-sources/google-drive.ts
 * Google Drive adapter implementing DocumentSourceAdapter.
 * Uses googleapis (Drive API v3) with OAuth 2.0.
 */

import { google } from 'googleapis';
import type {
    DocumentSourceAdapter,
    OAuthTokens,
    ExternalFolder,
    ExternalFile,
    FileMetadata,
} from './types';

const SCOPES = ['https://www.googleapis.com/auth/drive.readonly'];
const REDIRECT_PATH = '/api/integrations/callback';

// Google Docs/Sheets/Slides export MIME types
const GOOGLE_EXPORT_MAP: Record<string, { exportMime: string; ext: string }> = {
    'application/vnd.google-apps.document': { exportMime: 'text/plain', ext: '.txt' },
    'application/vnd.google-apps.spreadsheet': { exportMime: 'text/csv', ext: '.csv' },
    'application/vnd.google-apps.presentation': { exportMime: 'text/plain', ext: '.txt' },
};

// File types we can ingest
const SUPPORTED_MIME_PREFIXES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument',
    'text/',
    'image/',
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
    'application/vnd.google-apps.presentation',
];

function isSupportedMime(mimeType: string): boolean {
    return SUPPORTED_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix));
}

function getOAuth2Client() {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:5000';
    const redirectUri = `${appUrl}${REDIRECT_PATH}`;

    if (!clientId || !clientSecret) {
        throw new Error('GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET must be set');
    }

    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function getAuthenticatedClient(tokens: OAuthTokens) {
    const client = getOAuth2Client();
    client.setCredentials({
        access_token: tokens.accessToken,
        refresh_token: tokens.refreshToken,
        expiry_date: tokens.expiresAt,
    });
    return client;
}

/* ─── Google Drive Adapter ──────────────────────────── */

export const googleDriveAdapter: DocumentSourceAdapter = {
    provider: 'GOOGLE_DRIVE',

    getAuthUrl(state: string): string {
        const client = getOAuth2Client();
        return client.generateAuthUrl({
            access_type: 'offline',
            scope: SCOPES,
            state,
            prompt: 'consent', // Force refresh token
        });
    },

    async handleCallback(code: string): Promise<OAuthTokens> {
        const client = getOAuth2Client();
        const { tokens } = await client.getToken(code);
        return {
            accessToken: tokens.access_token || '',
            refreshToken: tokens.refresh_token || '',
            expiresAt: tokens.expiry_date || Date.now() + 3600 * 1000,
        };
    },

    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        const client = getAuthenticatedClient(tokens);
        const { credentials } = await client.refreshAccessToken();
        return {
            accessToken: credentials.access_token || tokens.accessToken,
            refreshToken: credentials.refresh_token || tokens.refreshToken,
            expiresAt: credentials.expiry_date || Date.now() + 3600 * 1000,
        };
    },

    async listFolders(tokens: OAuthTokens, parentId?: string): Promise<ExternalFolder[]> {
        const client = getAuthenticatedClient(tokens);
        const drive = google.drive({ version: 'v3', auth: client });

        const query = parentId
            ? `'${parentId}' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
            : `'root' in parents and mimeType = 'application/vnd.google-apps.folder' and trashed = false`;

        const res = await drive.files.list({
            q: query,
            fields: 'files(id, name, parents)',
            orderBy: 'name',
            pageSize: 200,
        });

        return (res.data.files || []).map((f) => ({
            id: f.id!,
            name: f.name!,
            path: `/${f.name}`,
            parentId: f.parents?.[0] || null,
        }));
    },

    async listFiles(tokens: OAuthTokens, folderId: string): Promise<ExternalFile[]> {
        const client = getAuthenticatedClient(tokens);
        const drive = google.drive({ version: 'v3', auth: client });

        const allFiles: ExternalFile[] = [];
        let pageToken: string | undefined;

        do {
            const res = await drive.files.list({
                q: `'${folderId}' in parents and trashed = false and mimeType != 'application/vnd.google-apps.folder'`,
                fields: 'nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink, parents)',
                orderBy: 'modifiedTime desc',
                pageSize: 100,
                pageToken,
            });

            for (const f of res.data.files || []) {
                if (!isSupportedMime(f.mimeType || '')) continue;
                allFiles.push({
                    id: f.id!,
                    name: f.name!,
                    mimeType: f.mimeType!,
                    size: parseInt(f.size || '0', 10),
                    path: `/${f.name}`,
                    webViewLink: f.webViewLink || null,
                    modifiedTime: f.modifiedTime!,
                    parentFolderId: f.parents?.[0] || null,
                });
            }

            pageToken = res.data.nextPageToken || undefined;
        } while (pageToken);

        return allFiles;
    },

    async downloadFile(
        tokens: OAuthTokens,
        fileId: string,
        mimeType: string
    ): Promise<{ buffer: Buffer; exportedMimeType: string }> {
        const client = getAuthenticatedClient(tokens);
        const drive = google.drive({ version: 'v3', auth: client });

        // Google Workspace files need export
        const exportConfig = GOOGLE_EXPORT_MAP[mimeType];
        if (exportConfig) {
            const res = await drive.files.export(
                { fileId, mimeType: exportConfig.exportMime },
                { responseType: 'arraybuffer' }
            );
            return {
                buffer: Buffer.from(res.data as ArrayBuffer),
                exportedMimeType: exportConfig.exportMime,
            };
        }

        // Regular files: direct download
        const res = await drive.files.get(
            { fileId, alt: 'media' },
            { responseType: 'arraybuffer' }
        );
        return {
            buffer: Buffer.from(res.data as ArrayBuffer),
            exportedMimeType: mimeType,
        };
    },

    async getFileMetadata(tokens: OAuthTokens, fileId: string): Promise<FileMetadata> {
        const client = getAuthenticatedClient(tokens);
        const drive = google.drive({ version: 'v3', auth: client });

        const res = await drive.files.get({
            fileId,
            fields: 'id, name, mimeType, size, modifiedTime, md5Checksum',
        });

        return {
            id: res.data.id!,
            name: res.data.name!,
            mimeType: res.data.mimeType!,
            size: parseInt(res.data.size || '0', 10),
            modifiedTime: res.data.modifiedTime!,
            md5Checksum: res.data.md5Checksum || undefined,
        };
    },
};
