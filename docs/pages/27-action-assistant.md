# 27 — Action Assistant (Global FAB)

## Component
`ActionAssistantLauncher` — rendered in the global layout on every page

## Purpose
The **Action Assistant** is a floating action button (FAB) that appears on every page. It opens a chat panel where users can issue commands in natural language, and the AI classifies intent, routes to the right module, and executes actions.

## UX Flow
1. FAB button floats at bottom-right of every page
2. Click → opens slide-out chat panel
3. User types or speaks a command
4. **Intent Classification** (GPT-5.4-mini) → determines module + action
5. If params missing → asks clarification question
6. If ready → shows confirmation summary → user approves
7. **Execution** → routes to appropriate adapter (marketing, sales, etc.)
8. Result displayed inline with deep link to the output

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/ai-assistant/orchestrate` | POST | Send message | Full orchestration flow | ~3-20s |
| `/api/ai-assistant/sessions` | GET | Panel open | Load session history | ~200ms |

## Orchestration State Machine
```
USER_INPUT → CLASSIFYING → CLARIFYING (if needed) → CONFIRMING → EXECUTING → RESULT
```

## Intent Types
- `generate_content` → Marketing/Sales/Product adapters
- `create_task` → Tasks adapter
- `search_leads` → Leads adapter
- `query_knowledge` → Knowledge adapter (RAG + Wiki)
- `navigate` → Navigation adapter
- `summarize` → Knowledge adapter
- `use_skill` → Skill executor

## Components & Sections

### FAB Button
- Circular button with sparkles icon
- Pulse animation when idle
- Click opens panel

### Chat Panel
- Slide-out from right side
- Full-height panel with header, messages, input
- Support for text and voice input
- Session history in dropdown

### Message Types
- User message (right-aligned)
- AI classification step (subtle indicator)
- Clarification question (with option buttons)
- Confirmation card (approve/reject)
- Result card (with deep link, inline preview, grounding status)
- Error message (red)

### Voice Input
- Microphone button next to text input
- Whisper STT transcription
- Real-time waveform animation during recording
