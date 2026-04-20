import OpenAI from 'openai';
import { createAdminClient } from './supabase/admin';

const CHUNK_SIZE = 500;      // ~500 tokens per chunk
const CHUNK_OVERLAP = 50;    // 50-token overlap between chunks
const EMBEDDING_MODEL = 'text-embedding-3-small';

/**
 * Split text into overlapping chunks for embedding generation.
 */
export function chunkText(text: string, maxChunkSize = CHUNK_SIZE, overlap = CHUNK_OVERLAP): string[] {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    if (!cleaned) return [];

    const words = cleaned.split(' ');
    if (words.length <= maxChunkSize) return [cleaned];

    const chunks: string[] = [];
    let start = 0;

    while (start < words.length) {
        const end = Math.min(start + maxChunkSize, words.length);
        chunks.push(words.slice(start, end).join(' '));
        start += maxChunkSize - overlap;
    }

    return chunks;
}

/**
 * Generate embeddings for an array of text chunks using OpenAI.
 * Returns array of 1536-dimension vectors.
 */
export async function generateEmbeddings(chunks: string[]): Promise<number[][]> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
        throw new Error('OPENAI_API_KEY not configured');
    }

    const openai = new OpenAI({ apiKey });

    const response = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: chunks,
    });

    return response.data.map((item) => item.embedding);
}

/**
 * Full pipeline: chunk text, generate embeddings, store in DocumentEmbedding table.
 * Deletes any existing embeddings for the document first (for re-processing).
 *
 * @param documentId        The Document ID (use 'external' sentinel for external docs)
 * @param companyId         The company scope
 * @param text              The extracted text to embed
 * @param externalDocumentId  Optional — if provided, links embeddings to an ExternalDocument
 */
export async function embedDocument(
    documentId: string,
    companyId: string,
    text: string,
    externalDocumentId?: string
): Promise<{ chunksStored: number }> {
    const chunks = chunkText(text);
    const sourceLabel = externalDocumentId || documentId;
    if (chunks.length === 0) {
        console.log('[embed] No text to embed for document:', sourceLabel);
        return { chunksStored: 0 };
    }

    console.log(`[embed] Generating embeddings for ${chunks.length} chunks (doc: ${sourceLabel})`);
    const embeddings = await generateEmbeddings(chunks);

    const db = createAdminClient();

    // Delete existing embeddings for this document (allows re-processing)
    if (externalDocumentId) {
        await db
            .from('DocumentEmbedding')
            .delete()
            .eq('externalDocumentId', externalDocumentId);
    } else {
        await db
            .from('DocumentEmbedding')
            .delete()
            .eq('documentId', documentId);
    }

    // Insert new embeddings
    const rows = chunks.map((chunk, i) => ({
        id: crypto.randomUUID(),
        companyId,
        documentId,
        externalDocumentId: externalDocumentId || null,
        chunkIndex: i,
        chunkText: chunk,
        embedding: JSON.stringify(embeddings[i]),
    }));

    const { error } = await db.from('DocumentEmbedding').insert(rows);

    if (error) {
        console.error('[embed] Insert error:', error);
        throw new Error(`Failed to store embeddings: ${error.message}`);
    }

    console.log(`[embed] Stored ${rows.length} embeddings for document: ${sourceLabel}`);
    return { chunksStored: rows.length };
}
