/**
 * Knowledge / RAG adapter.
 * Queries the company knowledge base using RAG retrieval.
 * Also searches project-specific documentation when a project name is mentioned.
 */
import OpenAI from 'openai';
import { createAdminClient } from '@/lib/supabase/admin';
import { retrieveWikiAndRAGContext } from '@/lib/rag-retrieval';
import type { ModuleAdapter, AuthContext, AdapterResult } from './types';

const MODEL = 'gpt-5.4-mini';

export const knowledgeAdapter: ModuleAdapter = {
    name: 'knowledge',
    requiredParams: ['query'],
    optionalParams: ['projectName'],

    async execute(params: Record<string, unknown>, auth: AuthContext): Promise<AdapterResult> {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) return { success: false, resultSummary: 'OpenAI API key not configured', error: 'OPENAI_API_KEY missing' };

        const query = String(params.query || '');
        if (!query.trim()) return { success: false, resultSummary: 'No question provided', error: 'Empty query' };

        const openai = new OpenAI({ apiKey });
        const db = createAdminClient();

        try {
            // Wiki-first + RAG retrieval
            const { context: wikiRagContext, groundingLevel: ragGrounding } = await retrieveWikiAndRAGContext(auth.companyId, query, { maxRagChunks: 10, projectId: auth.projectId });
            const ragContext = wikiRagContext;

            // Company context
            const { data: profile } = await db.from('CompanyProfile').select('companyName, description').eq('companyId', auth.companyId).maybeSingle();

            // Project-specific context — try to find a matching project
            let projectContext = '';
            const projectName = params.projectName ? String(params.projectName) : extractProjectName(query);
            if (projectName) {
                const { data: projects } = await db
                    .from('Project')
                    .select('name, description, contextText')
                    .eq('companyId', auth.companyId);

                if (projects && projects.length > 0) {
                    // Fuzzy match by partial name
                    const normalized = projectName.toLowerCase().trim();
                    const match = projects.find(p =>
                        p.name?.toLowerCase().includes(normalized)
                        || normalized.includes(p.name?.toLowerCase() || '')
                    );
                    if (match) {
                        const parts: string[] = ['\n=== PROJECT DOCUMENTATION ==='];
                        parts.push(`Project: ${match.name}`);
                        if (match.description) parts.push(`Description: ${match.description}`);
                        if (match.contextText) parts.push(`\nProject Context:\n${match.contextText}`);
                        projectContext = parts.join('\n');
                    }
                }
            }

            let groundingStatus: string;
            if (ragGrounding === 'VERIFIED' || projectContext) groundingStatus = 'VERIFIED';
            else if (ragGrounding === 'PARTIAL') groundingStatus = 'PARTIAL';
            else groundingStatus = 'NOT_FOUND';

            const systemPrompt = `You are a company knowledge assistant for ${profile?.companyName || 'the company'}.
Answer the user's question based ONLY on the provided company knowledge and project documentation.

${ragContext}
${projectContext}

RULES:
- ALWAYS respond in English, regardless of the language of the source documents or company data.
- If company knowledge or project documentation answers the question, provide a clear answer.
- If only partial information is available, answer what you can and note what's missing.
- If no relevant information is found, say so clearly and suggest uploading relevant documents.
- Never invent company-specific facts.
- Be concise and actionable.`;

            const response = await openai.chat.completions.create({
                model: MODEL,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: query },
                ],
                max_completion_tokens: 800,
                temperature: 0.3,
            });

            const answer = response.choices[0]?.message?.content || 'Unable to generate an answer.';

            // Log the question
            await db.from('AssistantQuestionLog').insert({
                id: crypto.randomUUID(),
                companyId: auth.companyId, userId: auth.userId,
                question: query, assistantType: 'ACTION_ASSISTANT',
                groundingStatus, createdAt: new Date().toISOString(),
            });

            return {
                success: true,
                resultSummary: answer.substring(0, 150) + (answer.length > 150 ? '…' : ''),
                inlinePreview: answer,
                groundingStatus,
            };
        } catch (err) {
            console.error('[adapter/knowledge] Error:', err);
            return { success: false, resultSummary: 'Knowledge query failed', error: String(err) };
        }
    },
};

/**
 * Extract potential project name from user query.
 * Looks for patterns like "project X", "in X project", "X documentation", etc.
 */
function extractProjectName(query: string): string | null {
    const patterns = [
        /(?:project|produto|projeto)\s+["']?([^"',;.!?]+)["']?/i,
        /(?:of|from|on|about|for|in)\s+(?:the\s+)?["']?([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)\s+(?:project|app|product|documentation)/i,
        /look\s+at\s+(?:the\s+)?(?:project\s+)?["']?([^"',;.!?]+?)["']?(?:\s+project|\s+documentation)/i,
    ];
    for (const pattern of patterns) {
        const match = query.match(pattern);
        if (match?.[1]) return match[1].trim();
    }
    return null;
}
