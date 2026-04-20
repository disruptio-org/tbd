/**
 * Intent Classifier V2 for the Nousio Assistant.
 * Classifies user input into: direct action, handoff, or workspace launch.
 * Uses GPT to map natural language → structured routing decisions.
 */
import OpenAI from 'openai';

const MODEL = 'gpt-5.4-mini';

// ─── Types ────────────────────────────────────────────

export interface ClassifiedIntent {
    inputType: 'command' | 'notes' | 'question' | 'mixed';
    executionMode: 'direct' | 'handoff' | 'workspace';
    intentType: string;
    targetAction: string;
    confidence: number;
    extractedParams: Record<string, unknown>;
    missingParams: string[];
    requiresConfirmation: boolean;
    interpretation: string;
    /** For handoff — target brainType (MARKETING, SALES, PRODUCT_ASSISTANT, COMPANY) */
    handoffTarget?: string;
    /** For handoff — prefilled prompt to seed the team member chat */
    prefilledPrompt?: string;
    /** For workspace — target workspace */
    workspaceTarget?: string;
    /** For workspace — prefilled state */
    workspaceState?: Record<string, unknown>;
}

export interface ClassificationContext {
    userMessage: string;
    currentRoute: string;
    pageContext?: Record<string, unknown>;
    userRole: string;
    companyName?: string;
    conversationHistory?: Array<{ role: string; content: string }>;
    /** Available boards for task-creation matching */
    availableBoards?: Array<{ id: string; boardName: string; projectName?: string; columns: string[] }>;
    /** Selected project scope from the UI */
    projectId?: string;
    projectName?: string;
}

// ─── V2 System Prompt ─────────────────────────────────

const SYSTEM_PROMPT = `You are Nousio's command router. You classify user requests into structured actions with ONE of three execution modes:

1. DIRECT — Commands you execute immediately (create tasks, navigate, create initiative, summarize)
2. HANDOFF — Requests requiring domain expertise → route to the correct AI team member
3. WORKSPACE — Requests that need a workspace interaction → launch with prefilled context

═══ EXECUTION MODE: DIRECT ═══
Intent types:
- create_task: Create tasks on a task board. REQUIRED: boardName, title or tasks[]. OPTIONAL: columnName, priority.
  For MULTIPLE tasks use extractedParams.tasks = [{"title":"Task 1"},{"title":"Task 2"}].
- create_tasks_from_notes: Parse unstructured text (meeting notes, brainstorm) into tasks. Always set requiresConfirmation=true.
- navigate: Navigate user to a specific page
- open_initiative: Create a Boardroom initiative shell. extractedParams: name, description, projectId
- summarize_to_actions: Summarize current context into actionable items

═══ EXECUTION MODE: HANDOFF ═══
Route to the AI team member with domain expertise. ALWAYS set handoffTarget and prefilledPrompt.
Intent types:
- route_to_marketing: Content creation, campaigns, brand, social media, newsletters, blog, LinkedIn
  → handoffTarget: "MARKETING"
- route_to_product: PRDs, feature specs, product strategy, roadmap, release notes
  → handoffTarget: "PRODUCT_ASSISTANT"
- route_to_sales: Sales emails, proposals, outreach, lead search, pipeline, follow-ups, prospecting
  → handoffTarget: "SALES"
- route_to_knowledge: Company questions, knowledge queries, "what is our...", "explain our..."
  → handoffTarget: "COMPANY"

═══ EXECUTION MODE: WORKSPACE ═══
Open a workspace with prefilled context. ALWAYS set workspaceTarget and workspaceState.
Intent types:
- open_boardroom: Open Boardroom with a prefilled initiative → workspaceTarget: "boardroom"
  workspaceState: { name: string, description: string, projectId?: string }
- open_tasks_board: Open Tasks with draft items → workspaceTarget: "tasks"
  workspaceState: { boardId?: string, draftTasks?: string[] }
- open_knowledge_view: Open Knowledge with a query → workspaceTarget: "knowledge"
  workspaceState: { query: string }

═══ INPUT TYPE DETECTION ═══
- "command": Direct instruction ("create a task", "go to settings", "open boardroom")
- "notes": Large unstructured text (meeting notes, brainstorm dumps, multi-paragraph input)
- "question": Asking something ("what is our value proposition?", "explain our pricing")
- "mixed": Contains both commands and unstructured content

═══ RULES ═══
1. ALWAYS prefer routing over direct answers for domain questions.
2. Questions → HANDOFF to appropriate team member (never answer in-line).
3. Content generation requests → HANDOFF (never generate content directly).
4. For create_task: if user does NOT specify a board, add "boardName" to missingParams.
5. For notes input: set inputType="notes", intentType="create_tasks_from_notes", requiresConfirmation=true.
6. If request is ambiguous, set confidence < 0.6.
7. IMPORTANT: set prefilledPrompt to a reformulated version of the user's request that the team member can act on directly.
8. If the user mentions a project/product name, extract it as "projectName" in extractedParams.

Respond with ONLY valid JSON matching this schema:
{
  "inputType": "command" | "notes" | "question" | "mixed",
  "executionMode": "direct" | "handoff" | "workspace",
  "intentType": string,
  "targetAction": string,
  "confidence": number (0.0-1.0),
  "extractedParams": object,
  "missingParams": string[],
  "requiresConfirmation": boolean,
  "interpretation": string,
  "handoffTarget": string | null,
  "prefilledPrompt": string | null,
  "workspaceTarget": string | null,
  "workspaceState": string | null
}`;

// ─── Classification ───────────────────────────────────

export async function classifyIntent(ctx: ClassificationContext): Promise<ClassifiedIntent> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not configured');

    const openai = new OpenAI({ apiKey });

    const userPrompt = buildUserPrompt(ctx);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const response = await (openai as any).responses.create({
        model: MODEL,
        instructions: SYSTEM_PROMPT,
        input: userPrompt,
        temperature: 0.1,
        text: {
            format: {
                type: 'json_schema',
                name: 'intent_classification_v2',
                strict: true,
                schema: {
                    type: 'object',
                    properties: {
                        inputType: { type: 'string' },
                        executionMode: { type: 'string' },
                        intentType: { type: 'string' },
                        targetAction: { type: 'string' },
                        confidence: { type: 'number' },
                        extractedParams: { type: 'string' },
                        missingParams: { type: 'array', items: { type: 'string' } },
                        requiresConfirmation: { type: 'boolean' },
                        interpretation: { type: 'string' },
                        handoffTarget: { type: ['string', 'null'] },
                        prefilledPrompt: { type: ['string', 'null'] },
                        workspaceTarget: { type: ['string', 'null'] },
                        workspaceState: { type: ['string', 'null'] },
                    },
                    required: [
                        'inputType', 'executionMode', 'intentType', 'targetAction',
                        'confidence', 'extractedParams', 'missingParams',
                        'requiresConfirmation', 'interpretation',
                        'handoffTarget', 'prefilledPrompt',
                        'workspaceTarget', 'workspaceState',
                    ],
                    additionalProperties: false,
                },
            },
        },
    });

    const raw = response.output_text || '{}';
    try {
        const parsed = JSON.parse(raw);

        // extractedParams comes as a JSON string from strict schema — parse it
        if (typeof parsed.extractedParams === 'string') {
            try { parsed.extractedParams = JSON.parse(parsed.extractedParams); }
            catch { parsed.extractedParams = { query: parsed.extractedParams }; }
        }

        // workspaceState comes as a JSON string — parse it
        if (typeof parsed.workspaceState === 'string' && parsed.workspaceState) {
            try { parsed.workspaceState = JSON.parse(parsed.workspaceState); }
            catch { parsed.workspaceState = null; }
        }

        return parsed as ClassifiedIntent;
    } catch {
        console.error('[intent-classifier] Failed to parse response:', raw);
        // Fallback: route to knowledge member
        return {
            inputType: 'question',
            executionMode: 'handoff',
            intentType: 'route_to_knowledge',
            targetAction: 'general_query',
            confidence: 0.3,
            extractedParams: { query: ctx.userMessage },
            missingParams: [],
            requiresConfirmation: false,
            interpretation: 'Could not classify intent. Routing to Knowledge.',
            handoffTarget: 'COMPANY',
            prefilledPrompt: ctx.userMessage,
        };
    }
}

function buildUserPrompt(ctx: ClassificationContext): string {
    const parts: string[] = [
        `User request: "${ctx.userMessage}"`,
        `Current page: ${ctx.currentRoute}`,
        `User role: ${ctx.userRole}`,
    ];

    if (ctx.companyName) parts.push(`Company: ${ctx.companyName}`);
    if (ctx.projectId) {
        parts.push(`ACTIVE PROJECT: ${ctx.projectName || 'Unknown'} (projectId: ${ctx.projectId}). The user is working within this project scope — always include projectId in extractedParams.`);
    }
    if (ctx.pageContext) parts.push(`Page context: ${JSON.stringify(ctx.pageContext)}`);
    if (ctx.conversationHistory?.length) {
        const recent = ctx.conversationHistory.slice(-4);
        parts.push(`Recent conversation:\n${recent.map(m => `${m.role}: ${m.content}`).join('\n')}`);
    }

    // Inject available boards for task-creation matching
    if (ctx.availableBoards?.length) {
        const boardLines = ctx.availableBoards.map(b => {
            const label = b.projectName ? `${b.projectName} / ${b.boardName}` : b.boardName;
            const cols = b.columns.length > 0 ? ` — columns: ${b.columns.join(', ')}` : '';
            return `  - "${label}" (boardId: ${b.id})${cols}`;
        });
        parts.push(`\nAVAILABLE TASK BOARDS (use boardId in extractedParams if the user mentions one):\n${boardLines.join('\n')}`);
    }

    return parts.join('\n');
}
