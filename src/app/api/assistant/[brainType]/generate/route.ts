import { handleAssistantGenerate } from '@/lib/assistant-generate';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ brainType: string }> }
) {
    const { brainType } = await params;
    return handleAssistantGenerate(request, brainType.toUpperCase());
}
