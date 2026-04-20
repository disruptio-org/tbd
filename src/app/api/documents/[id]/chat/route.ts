import { NextResponse, NextRequest } from 'next/server';
import { createClient as createServerClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import OpenAI from 'openai';

const CHAT_MODEL = 'gpt-5.4-mini';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        // 1. Auth
        const supabase = await createServerClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
        }

        const db = createAdminClient();
        const { id: documentId } = await params;

        // 2. Fetch the document (handle ext- prefix for external docs)
        let docFilename: string;
        let docText: string;
        let docCompanyId: string;

        if (documentId.startsWith('ext-')) {
            const externalId = documentId.replace('ext-', '');
            const { data: extDoc, error: extErr } = await db
                .from('ExternalDocument')
                .select('filename, extractedText, integrationId')
                .eq('id', externalId)
                .single();

            if (extErr || !extDoc) {
                return NextResponse.json({ error: 'Document not found' }, { status: 404 });
            }

            const { data: integration } = await db
                .from('CompanyIntegration')
                .select('companyId')
                .eq('id', extDoc.integrationId)
                .single();

            if (!integration) {
                return NextResponse.json({ error: 'Document not found' }, { status: 404 });
            }

            docFilename = extDoc.filename;
            docText = extDoc.extractedText || '';
            docCompanyId = integration.companyId;
        } else {
            const { data: doc, error: docErr } = await db
                .from('Document')
                .select('id, filename, extractedText, companyId')
                .eq('id', documentId)
                .single();

            if (docErr || !doc) {
                return NextResponse.json({ error: 'Document not found' }, { status: 404 });
            }

            docFilename = doc.filename;
            docText = doc.extractedText || '';
            docCompanyId = doc.companyId;
        }

        // 3. Verify user belongs to same company
        const { data: dbUser } = await db.from('User').select('companyId').eq('email', user.email ?? '').maybeSingle();
        if (!dbUser || dbUser.companyId !== docCompanyId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
        }

        // 4. Parse request
        const { message, history: clientHistory } = await request.json();
        if (!message || !message.trim()) {
            return NextResponse.json({ error: 'Message is required' }, { status: 400 });
        }

        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'OPENAI_API_KEY not configured' }, { status: 500 });
        }

        const openai = new OpenAI({ apiKey });

        // 5. Build conversation with full document context
        const documentText = docText || '[Sem conteúdo extraído]';

        const systemPrompt = `Você é um assistente especializado em analisar documentos. O utilizador está a ver o documento "${docFilename}" e faz perguntas sobre o seu conteúdo.

Responda SEMPRE com base no conteúdo do documento abaixo. Se a informação solicitada não constar do documento, diga-o claramente.
Responda na mesma língua da pergunta do utilizador.
Formate a resposta com markdown quando apropriado (listas, negrito, etc.).

CONTEÚDO COMPLETO DO DOCUMENTO:
${documentText}`;

        // Build history from client-provided messages
        const history: { role: 'user' | 'assistant'; content: string }[] = (clientHistory || []).map(
            (m: { role: string; content: string }) => ({
                role: m.role === 'user' ? 'user' as const : 'assistant' as const,
                content: m.content,
            })
        );

        const completion = await openai.chat.completions.create({
            model: CHAT_MODEL,
            messages: [
                { role: 'system', content: systemPrompt },
                ...history,
                { role: 'user', content: message },
            ],
            max_completion_tokens: 2048,
            temperature: 0.3,
        });

        const answer = completion.choices[0]?.message?.content || 'Não foi possível gerar uma resposta.';

        return NextResponse.json({ answer });
    } catch (error) {
        console.error('[doc-chat] Error:', error);
        return NextResponse.json({ error: 'Chat failed', detail: String(error) }, { status: 500 });
    }
}
