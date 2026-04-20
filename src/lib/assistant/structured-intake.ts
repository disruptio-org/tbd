/**
 * Structured Intake — parses unstructured text (meeting notes, brainstorms)
 * into structured tasks, decisions, owners, and deadlines.
 *
 * Used as a gate before routing when inputType === 'notes' or 'mixed'.
 */
import OpenAI from 'openai';

const MODEL = 'gpt-5.4-mini';

export interface StructuredIntakeResult {
    sourceType: 'meeting_notes' | 'brainstorm' | 'action_list' | 'general';
    extractedTasks: Array<{
        title: string;
        assignee?: string;
        dueDate?: string;
        priority?: string;
    }>;
    extractedDecisions: string[];
    extractedOwners: string[];
    extractedDeadlines: string[];
    inferredProject?: string;
}

const SYSTEM_PROMPT = `You are a structured intake parser. Given unstructured text (meeting notes, brainstorms, general notes), extract:

1. TASKS — actionable items that someone needs to do
2. DECISIONS — conclusions or agreements made
3. OWNERS — people mentioned as responsible
4. DEADLINES — dates or timeframes mentioned

For each task, extract:
- title: Clear, actionable task title (imperative form, e.g. "Design landing page mockup")
- assignee: Person/role if mentioned (optional)
- dueDate: Date if mentioned (optional, ISO format)
- priority: "high", "medium", "low" if inferable (optional)

Also classify the sourceType:
- "meeting_notes": Contains discussion, action items, attendees
- "brainstorm": Ideas, concepts, possibilities
- "action_list": Already structured as a list of todos
- "general": Doesn't fit the above

And try to infer the project name from context.

Respond with ONLY valid JSON matching this schema:
{
  "sourceType": string,
  "extractedTasks": [{ "title": string, "assignee": string|null, "dueDate": string|null, "priority": string|null }],
  "extractedDecisions": string[],
  "extractedOwners": string[],
  "extractedDeadlines": string[],
  "inferredProject": string|null
}`;

export async function parseStructuredIntake(rawText: string): Promise<StructuredIntakeResult | null> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return null;

    // Only process text that's substantial enough (> 50 chars)
    if (rawText.trim().length < 50) return null;

    try {
        const openai = new OpenAI({ apiKey });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response = await (openai as any).responses.create({
            model: MODEL,
            instructions: SYSTEM_PROMPT,
            input: `Parse the following text:\n\n${rawText}`,
            temperature: 0.1,
            text: {
                format: {
                    type: 'json_schema',
                    name: 'structured_intake',
                    strict: true,
                    schema: {
                        type: 'object',
                        properties: {
                            sourceType: { type: 'string' },
                            extractedTasks: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    properties: {
                                        title: { type: 'string' },
                                        assignee: { type: ['string', 'null'] },
                                        dueDate: { type: ['string', 'null'] },
                                        priority: { type: ['string', 'null'] },
                                    },
                                    required: ['title', 'assignee', 'dueDate', 'priority'],
                                    additionalProperties: false,
                                },
                            },
                            extractedDecisions: { type: 'array', items: { type: 'string' } },
                            extractedOwners: { type: 'array', items: { type: 'string' } },
                            extractedDeadlines: { type: 'array', items: { type: 'string' } },
                            inferredProject: { type: ['string', 'null'] },
                        },
                        required: ['sourceType', 'extractedTasks', 'extractedDecisions', 'extractedOwners', 'extractedDeadlines', 'inferredProject'],
                        additionalProperties: false,
                    },
                },
            },
        });

        const raw = response.output_text || '{}';
        const parsed = JSON.parse(raw);
        return parsed as StructuredIntakeResult;
    } catch (err) {
        console.error('[structured-intake] Parse failed:', err);
        return null;
    }
}
