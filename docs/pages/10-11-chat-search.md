# 10 — Ask AI (Chat)

## Route
`/chat`

## Purpose
General-purpose AI chat interface. Conversational assistant that can answer questions, generate content, and access company knowledge. Supports multiple conversation threads with history.

## UX Flow
1. Page loads → fetches conversation history
2. User types or speaks a message
3. AI responds with grounded answer (wiki-first + RAG)
4. Conversation saved automatically
5. History sidebar: click to resume, delete old conversations

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/general-ai/history` | GET | Page load | List all conversations | ~300ms |
| `/api/general-ai/generate` | POST | Send message | Generate AI response | ~3-15s |
| `/api/general-ai/history/{id}` | GET | Click conversation | Load full conversation | ~200ms |
| `/api/general-ai/history` | DELETE | Delete button | Delete conversation | ~200ms |

## Components & Sections

### Chat Input
- Text input with send button
- Voice input support (Whisper STT)
- Shift+Enter for new lines, Enter to send

### Message Thread
- Alternating user/AI messages
- AI messages rendered as rich markdown
- Source citations when grounded in company knowledge
- Loading indicator during generation

### History Sidebar
- Chronological list of past conversations
- Title, date, assistant type badge
- Click to reload, swipe/click to delete
- "New Conversation" button at top

---

# 11 — Search

## Route
`/search`

## Purpose
Semantic search across all company knowledge — documents, knowledge nodes, and embeddings. Returns ranked results with relevance scores.

## UX Flow
1. User types query in search bar
2. Debounced search triggers API call
3. Results display with relevance scoring, source tags, and snippets
4. Click result to navigate to source

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/search?q={query}` | GET | Type + debounce | Semantic search | ~500-1500ms |

## Components & Sections

### Search Bar
- Full-width input with search icon
- Debounced (300ms) query submission
- Clear button

### Results List
- Ranked by relevance score
- Each result: title, snippet, source type badge, relevance %
- Source types: Document, Knowledge Node, External Doc
- Click → navigates to source location
- Empty state: "No results found"
