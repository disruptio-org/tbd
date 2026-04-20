/**
 * document-sources/notion.ts
 * Notion adapter implementing DocumentSourceAdapter.
 * Uses @notionhq/client for API access and notion-to-md for Markdown export.
 *
 * Architecture: Each company creates their own Internal Integration in Notion,
 * copies the token, and pastes it into our UI. No platform-level OAuth needed.
 * The token is stored in CompanyIntegration.oauthTokens.accessToken.
 *
 * Key differences from Google Drive:
 * - No OAuth flow — company admin pastes their Notion Internal Integration Token
 * - Tokens do not expire (no refresh logic needed)
 * - "Folders" map to top-level pages the integration was granted access to
 * - "Files" map to child pages within those top-level pages
 * - Download = recursive block-to-markdown conversion
 */

import { Client } from '@notionhq/client';
import { NotionToMarkdown } from 'notion-to-md';
import type {
    DocumentSourceAdapter,
    OAuthTokens,
    ExternalFolder,
    ExternalFile,
    FileMetadata,
} from './types';

/* ─── Helpers ──────────────────────────────────────────── */

function getNotionClient(accessToken: string): Client {
    return new Client({ auth: accessToken });
}

/* ─── Notion Adapter ──────────────────────────────────── */

export const notionAdapter: DocumentSourceAdapter = {
    provider: 'NOTION',

    getAuthUrl(): string {
        // No OAuth redirect needed — company admin pastes the internal token via UI
        // This method is not used for Notion, but exists to satisfy the interface
        return '';
    },

    async handleCallback(code: string): Promise<OAuthTokens> {
        // For Notion, `code` is actually the Internal Integration Token pasted by the user
        // We just wrap it into our OAuthTokens shape
        return {
            accessToken: code,
            refreshToken: '',
            expiresAt: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000, // ~10 years (never expires)
        };
    },

    async refreshToken(tokens: OAuthTokens): Promise<OAuthTokens> {
        // Notion internal tokens do not expire — just return as-is
        return tokens;
    },

    async listFolders(tokens: OAuthTokens): Promise<ExternalFolder[]> {
        const notion = getNotionClient(tokens.accessToken);

        // Search for ALL accessible items — pages and databases
        // Note: We do NOT filter by parent type because in teamspaces,
        // pages grant access via parent types like 'page_id', 'block_id', etc.
        const folders: ExternalFolder[] = [];
        const seenIds = new Set<string>();
        let cursor: string | undefined;

        do {
            const response = await notion.search({
                page_size: 100,
                start_cursor: cursor,
            });

            for (const result of response.results) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const item = result as any;
                if (seenIds.has(item.id)) continue;
                seenIds.add(item.id);

                if (item.object === 'page') {
                    const title = extractPageTitle(item);
                    folders.push({
                        id: item.id,
                        name: title || 'Untitled',
                        path: `/${title || 'Untitled'}`,
                        parentId: null,
                    });
                } else if (item.object === 'database') {
                    const title = item.title?.[0]?.plain_text || 'Untitled Database';
                    folders.push({
                        id: item.id,
                        name: `📊 ${title}`,
                        path: `/${title}`,
                        parentId: null,
                    });
                }
            }

            cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
        } while (cursor);

        console.log(`[notion] Listed ${folders.length} top-level folders/pages`);
        return folders;
    },

    async listFiles(tokens: OAuthTokens, folderId: string): Promise<ExternalFile[]> {
        const notion = getNotionClient(tokens.accessToken);
        const files: ExternalFile[] = [];

        // Try as a database first (query for pages in the database)
        try {
            let cursor: string | undefined;
            do {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const response = await (notion.databases as any).query({
                    database_id: folderId,
                    page_size: 100,
                    start_cursor: cursor,
                });

                for (const page of response.results) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const p = page as any;
                    const title = extractPageTitle(p);
                    files.push({
                        id: p.id,
                        name: title || 'Untitled',
                        mimeType: 'text/markdown',
                        size: 0,
                        path: `/${title || 'Untitled'}`,
                        webViewLink: p.url || null,
                        modifiedTime: p.last_edited_time || new Date().toISOString(),
                        parentFolderId: folderId,
                    });
                }

                cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
            } while (cursor);

            if (files.length > 0) {
                console.log(`[notion] Found ${files.length} pages in database ${folderId}`);
                return files;
            }
        } catch {
            // Not a database — treat as a page
        }

        // For pages: ALWAYS include the page itself as a file (it has content)
        try {
            const page = await notion.pages.retrieve({ page_id: folderId });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = page as any;
            const title = extractPageTitle(p);
            files.push({
                id: p.id,
                name: title || 'Untitled',
                mimeType: 'text/markdown',
                size: 0,
                path: `/${title || 'Untitled'}`,
                webViewLink: p.url || null,
                modifiedTime: p.last_edited_time || new Date().toISOString(),
                parentFolderId: null,
            });
        } catch (err) {
            console.error(`[notion] Failed to retrieve page ${folderId}:`, err);
        }

        // Also include any child pages
        try {
            let cursor: string | undefined;
            do {
                const response = await notion.blocks.children.list({
                    block_id: folderId,
                    page_size: 100,
                    start_cursor: cursor,
                });

                for (const block of response.results) {
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const b = block as any;
                    if (b.type === 'child_page') {
                        files.push({
                            id: b.id,
                            name: b.child_page?.title || 'Untitled',
                            mimeType: 'text/markdown',
                            size: 0,
                            path: `/${b.child_page?.title || 'Untitled'}`,
                            webViewLink: null,
                            modifiedTime: b.last_edited_time || new Date().toISOString(),
                            parentFolderId: folderId,
                        });
                    }
                }

                cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
            } while (cursor);
        } catch (err) {
            console.error(`[notion] Failed to list children for ${folderId}:`, err);
        }

        console.log(`[notion] Found ${files.length} files for folder ${folderId}`);
        return files;
    },

    async downloadFile(
        tokens: OAuthTokens,
        fileId: string,
    ): Promise<{ buffer: Buffer; exportedMimeType: string }> {
        const notion = getNotionClient(tokens.accessToken);
        const n2m = new NotionToMarkdown({ notionClient: notion });

        // Try notion-to-md first
        try {
            const mdBlocks = await n2m.pageToMarkdown(fileId);
            const mdString = n2m.toMarkdownString(mdBlocks);
            const markdown = typeof mdString === 'string' ? mdString : mdString.parent || '';

            if (markdown.trim().length > 10) {
                return {
                    buffer: Buffer.from(markdown, 'utf-8'),
                    exportedMimeType: 'text/markdown',
                };
            }
        } catch (err) {
            console.warn(`[notion] notion-to-md failed for ${fileId}, using block fallback:`, err);
        }

        // Fallback: Extract text directly from page properties + blocks
        const parts: string[] = [];

        // Extract page title and properties
        try {
            const page = await notion.pages.retrieve({ page_id: fileId });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const p = page as any;
            const title = extractPageTitle(p);
            if (title && title !== 'Untitled') {
                parts.push(`# ${title}\n`);
            }

            // Extract text from page properties (useful for database entries)
            if (p.properties) {
                for (const key of Object.keys(p.properties)) {
                    const prop = p.properties[key];
                    const propText = extractPropertyText(prop);
                    if (propText) {
                        parts.push(`**${key}:** ${propText}`);
                    }
                }
            }
        } catch { /* page not accessible */ }

        // Extract text from all blocks recursively
        try {
            const blockTexts = await extractBlocksText(notion, fileId);
            if (blockTexts.length > 0) {
                parts.push('', ...blockTexts);
            }
        } catch (err) {
            console.error(`[notion] Block extraction failed for ${fileId}:`, err);
        }

        const finalText = parts.join('\n').trim();
        return {
            buffer: Buffer.from(finalText || '', 'utf-8'),
            exportedMimeType: 'text/markdown',
        };
    },

    async getFileMetadata(tokens: OAuthTokens, fileId: string): Promise<FileMetadata> {
        const notion = getNotionClient(tokens.accessToken);
        const page = await notion.pages.retrieve({ page_id: fileId });
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = page as any;
        const title = extractPageTitle(p);

        return {
            id: p.id,
            name: title || 'Untitled',
            mimeType: 'text/markdown',
            size: 0,
            modifiedTime: p.last_edited_time || new Date().toISOString(),
        };
    },
};

/* ─── Utility: Extract title from a Notion page ──────── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPageTitle(page: any): string {
    // Option 1: page.properties.title or page.properties.Name (common in databases)
    if (page.properties) {
        for (const key of Object.keys(page.properties)) {
            const prop = page.properties[key];
            if (prop.type === 'title' && prop.title?.length > 0) {
                return prop.title.map((t: { plain_text: string }) => t.plain_text).join('');
            }
        }
    }

    // Option 2: child_page block
    if (page.child_page?.title) {
        return page.child_page.title;
    }

    return 'Untitled';
}

/* ─── Utility: Extract text from a Notion property ──── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractPropertyText(prop: any): string {
    if (!prop) return '';

    switch (prop.type) {
        case 'title':
        case 'rich_text':
            return (prop[prop.type] || []).map((t: { plain_text: string }) => t.plain_text).join('');
        case 'number':
            return prop.number != null ? String(prop.number) : '';
        case 'select':
            return prop.select?.name || '';
        case 'multi_select':
            return (prop.multi_select || []).map((s: { name: string }) => s.name).join(', ');
        case 'date':
            return prop.date?.start || '';
        case 'checkbox':
            return prop.checkbox ? 'Yes' : 'No';
        case 'url':
            return prop.url || '';
        case 'email':
            return prop.email || '';
        case 'phone_number':
            return prop.phone_number || '';
        case 'status':
            return prop.status?.name || '';
        default:
            return '';
    }
}

/* ─── Utility: Recursively extract text from Notion blocks ── */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractRichText(richTexts: any[]): string {
    if (!richTexts || !Array.isArray(richTexts)) return '';
    return richTexts.map((t: { plain_text: string }) => t.plain_text).join('');
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function extractBlocksText(notion: any, blockId: string, depth = 0): Promise<string[]> {
    if (depth > 3) return []; // Limit recursion depth

    const lines: string[] = [];
    let cursor: string | undefined;

    do {
        const response = await notion.blocks.children.list({
            block_id: blockId,
            page_size: 100,
            start_cursor: cursor,
        });

        for (const block of response.results) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const b = block as any;
            const indent = '  '.repeat(depth);
            let text = '';

            switch (b.type) {
                case 'paragraph':
                    text = extractRichText(b.paragraph?.rich_text);
                    break;
                case 'heading_1':
                    text = `# ${extractRichText(b.heading_1?.rich_text)}`;
                    break;
                case 'heading_2':
                    text = `## ${extractRichText(b.heading_2?.rich_text)}`;
                    break;
                case 'heading_3':
                    text = `### ${extractRichText(b.heading_3?.rich_text)}`;
                    break;
                case 'bulleted_list_item':
                    text = `- ${extractRichText(b.bulleted_list_item?.rich_text)}`;
                    break;
                case 'numbered_list_item':
                    text = `1. ${extractRichText(b.numbered_list_item?.rich_text)}`;
                    break;
                case 'to_do':
                    text = `${b.to_do?.checked ? '[x]' : '[ ]'} ${extractRichText(b.to_do?.rich_text)}`;
                    break;
                case 'toggle':
                    text = `▸ ${extractRichText(b.toggle?.rich_text)}`;
                    break;
                case 'callout':
                    text = `> ${extractRichText(b.callout?.rich_text)}`;
                    break;
                case 'quote':
                    text = `> ${extractRichText(b.quote?.rich_text)}`;
                    break;
                case 'code':
                    text = `\`\`\`\n${extractRichText(b.code?.rich_text)}\n\`\`\``;
                    break;
                case 'divider':
                    text = '---';
                    break;
                case 'child_page':
                    text = `📄 ${b.child_page?.title || 'Untitled'}`;
                    break;
                case 'child_database':
                    text = `📊 ${b.child_database?.title || 'Untitled Database'}`;
                    break;
                default:
                    break;
            }

            if (text) {
                lines.push(indent + text);
            }

            // Recurse into blocks with children
            if (b.has_children && b.type !== 'child_page' && b.type !== 'child_database') {
                const childLines = await extractBlocksText(notion, b.id, depth + 1);
                lines.push(...childLines);
            }
        }

        cursor = response.has_more ? response.next_cursor ?? undefined : undefined;
    } while (cursor);

    return lines;
}
