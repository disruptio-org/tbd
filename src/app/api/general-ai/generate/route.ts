import { handleAssistantGenerate } from '@/lib/assistant-generate';

export async function POST(request: Request) {
    return handleAssistantGenerate(request, 'GENERAL_AI');
}
