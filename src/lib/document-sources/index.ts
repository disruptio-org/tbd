/**
 * document-sources/index.ts
 * Factory for document source adapters.
 */

import type { DocumentSourceAdapter } from './types';
import { googleDriveAdapter } from './google-drive';
import { notionAdapter } from './notion';

const adapters: Record<string, DocumentSourceAdapter> = {
    GOOGLE_DRIVE: googleDriveAdapter,
    NOTION: notionAdapter,
};

export function getAdapter(provider: string): DocumentSourceAdapter {
    const adapter = adapters[provider];
    if (!adapter) {
        throw new Error(`Unsupported document source provider: ${provider}`);
    }
    return adapter;
}

export * from './types';
export { googleDriveAdapter } from './google-drive';
export { notionAdapter } from './notion';

