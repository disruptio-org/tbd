import { NextResponse, NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';

const EMBEDDING_MODEL = 'text-embedding-3-small';

export async function GET(request: NextRequest) {
    try {
        // 1. Auth
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const db = createAdminClient();

        // Look up user's company
        const { data: dbUser } = await db.from('User').select('companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser) {
            return NextResponse.json({ results: [], query: '' });
        }

        // 2. Parse query params
        const { searchParams } = request.nextUrl;
        const query = searchParams.get('q');
        const fileType = searchParams.get('type') || '';
        const dateFrom = searchParams.get('from') || '';
        const dateTo = searchParams.get('to') || '';

        if (!query || !query.trim()) {
            return NextResponse.json({ results: [] });
        }

        // 3. Try embedding-based search first, fall back to text search
        let results: SearchResult[] = [];
        const apiKey = process.env.OPENAI_API_KEY;

        if (apiKey) {
            try {
                results = await vectorSearch(db, query, dbUser.companyId, fileType, dateFrom, dateTo, apiKey);
            } catch (err) {
                console.warn('[search] Vector search failed, falling back to text:', err);
                results = await textSearch(db, query, dbUser.companyId, fileType, dateFrom, dateTo);
            }
        } else {
            results = await textSearch(db, query, dbUser.companyId, fileType, dateFrom, dateTo);
        }

        // 4. Generate AI summaries for each result (using full document text)
        if (apiKey && results.length > 0) {
            results = await generateSummaries(db, results, query, apiKey);
        }

        return NextResponse.json({ results, query });
    } catch (error) {
        console.error('Search error:', error);
        return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
}

interface SearchResult {
    id: string;
    documentId: string;
    filename: string;
    snippet: string;
    summary?: string;
    score: number;
}

/**
 * Embedding-based cosine similarity search using DocumentEmbedding table.
 * Computes similarity in-app since pgvector might not be enabled.
 */
async function vectorSearch(
    db: ReturnType<typeof createAdminClient>,
    query: string,
    companyId: string,
    fileType: string,
    dateFrom: string,
    dateTo: string,
    apiKey: string
): Promise<SearchResult[]> {
    const openai = new OpenAI({ apiKey });

    // Generate query embedding
    const embResponse = await openai.embeddings.create({
        model: EMBEDDING_MODEL,
        input: query,
    });
    const queryEmbedding = embResponse.data[0].embedding;

    // Fetch all embeddings for this company (with document info)
    let embQuery = db
        .from('DocumentEmbedding')
        .select('id, documentId, chunkIndex, chunkText, embedding')
        .eq('companyId', companyId);

    const { data: embeddings, error } = await embQuery;

    if (error || !embeddings || embeddings.length === 0) {
        console.log('[search] No embeddings found, falling back to text search');
        throw new Error('No embeddings');
    }

    // Get documents for filtering
    let docQuery = db
        .from('Document')
        .select('id, filename, mimeType, createdAt')
        .eq('companyId', companyId);

    if (fileType) {
        if (fileType === 'pdf') docQuery = docQuery.eq('mimeType', 'application/pdf');
        else if (fileType === 'docx') docQuery = docQuery.ilike('mimeType', '%word%');
        else if (fileType === 'image') docQuery = docQuery.ilike('mimeType', 'image/%');
    }
    if (dateFrom) docQuery = docQuery.gte('createdAt', dateFrom);
    if (dateTo) docQuery = docQuery.lte('createdAt', `${dateTo}T23:59:59`);

    const { data: documents } = await docQuery;
    if (!documents || documents.length === 0) return [];

    const docMap = new Map(documents.map(d => [d.id, d]));

    // Compute cosine similarity in JS
    const allScored = embeddings
        .filter(emb => docMap.has(emb.documentId))
        .map(emb => {
            const embVector: number[] = JSON.parse(emb.embedding);
            const score = cosineSimilarity(queryEmbedding, embVector);
            const doc = docMap.get(emb.documentId)!;
            return {
                documentId: emb.documentId,
                filename: doc.filename,
                chunkText: emb.chunkText,
                score,
            };
        })
        .sort((a, b) => b.score - a.score);

    // Group by document — keep best score, combine top snippets
    const docResults = new Map<string, SearchResult>();
    for (const item of allScored) {
        if (!docResults.has(item.documentId)) {
            docResults.set(item.documentId, {
                id: item.documentId,
                documentId: item.documentId,
                filename: item.filename,
                snippet: item.chunkText.substring(0, 400),
                score: item.score,
            });
        }
    }

    return Array.from(docResults.values())
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
}

/**
 * Fallback text search using ILIKE on extractedText.
 */
async function textSearch(
    db: ReturnType<typeof createAdminClient>,
    query: string,
    companyId: string,
    fileType: string,
    dateFrom: string,
    dateTo: string
): Promise<SearchResult[]> {
    let docQuery = db
        .from('Document')
        .select('id, filename, mimeType, extractedText, createdAt')
        .eq('companyId', companyId)
        .eq('ocrProcessed', true)
        .not('extractedText', 'is', null);

    if (fileType) {
        if (fileType === 'pdf') docQuery = docQuery.eq('mimeType', 'application/pdf');
        else if (fileType === 'docx') docQuery = docQuery.ilike('mimeType', '%word%');
        else if (fileType === 'image') docQuery = docQuery.ilike('mimeType', 'image/%');
    }
    if (dateFrom) docQuery = docQuery.gte('createdAt', dateFrom);
    if (dateTo) docQuery = docQuery.lte('createdAt', `${dateTo}T23:59:59`);

    const { data: documents, error } = await docQuery;
    if (error || !documents) return [];

    // Simple keyword scoring
    const queryWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 2);

    return documents
        .map(doc => {
            const text = (doc.extractedText || '').toLowerCase();
            const matchCount = queryWords.filter(w => text.includes(w)).length;
            const score = queryWords.length > 0 ? matchCount / queryWords.length : 0;

            // Find best snippet
            let snippet = '';
            for (const word of queryWords) {
                const idx = text.indexOf(word);
                if (idx >= 0) {
                    const start = Math.max(0, idx - 100);
                    const end = Math.min(text.length, idx + 200);
                    snippet = (doc.extractedText || '').substring(start, end);
                    break;
                }
            }
            if (!snippet && doc.extractedText) {
                snippet = doc.extractedText.substring(0, 300);
            }

            return {
                id: doc.id,
                documentId: doc.id,
                filename: doc.filename,
                snippet,
                score,
            };
        })
        .filter(r => r.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
}

/**
 * Cosine similarity between two vectors.
 */
function cosineSimilarity(a: number[], b: number[]): number {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denom = Math.sqrt(normA) * Math.sqrt(normB);
    return denom === 0 ? 0 : dotProduct / denom;
}

/**
 * Use gpt-5.4-mini to generate a contextual summary for each search result
 * that answers the user's query based on the document content.
 */
async function generateSummaries(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: any,
    results: SearchResult[],
    query: string,
    apiKey: string
): Promise<SearchResult[]> {
    const openai = new OpenAI({ apiKey });

    const summaryPromises = results.map(async (result) => {
        try {
            // Fetch full document text from the Document record
            const { data: doc } = await db
                .from('Document')
                .select('extractedText')
                .eq('id', result.documentId)
                .single();

            // Use full document text (up to 6000 chars to stay within token limits)
            const fullText = doc?.extractedText
                ? doc.extractedText.substring(0, 6000)
                : result.snippet;

            const response = await openai.chat.completions.create({
                model: 'gpt-5.4-mini',
                messages: [
                    {
                        role: 'system',
                        content: 'Você é um assistente que resume documentos. Dado o conteúdo COMPLETO de um documento e uma pergunta do utilizador, gere um resumo conciso (3-5 frases) que responda à pergunta com base no conteúdo total do documento. Responda sempre na mesma língua da pergunta. Se o conteúdo não responder diretamente à pergunta, descreva brevemente o que o documento contém como um todo.',
                    },
                    {
                        role: 'user',
                        content: `Pergunta: "${query}"\n\nConteúdo completo do documento "${result.filename}":\n${fullText}`,
                    },
                ],
                max_completion_tokens: 300,
                temperature: 0.3,
            });

            return {
                ...result,
                summary: response.choices[0]?.message?.content || undefined,
            };
        } catch (err) {
            console.error('[search] Summary generation failed for', result.filename, err);
            return result;
        }
    });

    return Promise.all(summaryPromises);
}
