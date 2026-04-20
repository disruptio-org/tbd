# 20 — Virtual Office

## Route
`/virtual-office`

## Purpose
Visual AI team workspace. A spatial interface where AI team members are shown as avatars in a virtual office layout with rooms. Users can "enter" rooms, see AI presence, and interact with team members via chat.

## UX Flow
1. Page loads → fetches office layout + room presence
2. Office rendered as spatial grid with rooms
3. AI members shown as avatars in their assigned rooms
4. Click room → join room → see room messages
5. Send messages to interact with AI members in the room
6. Room presence updates periodically

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/virtual-office` | GET | Page load | Office layout + rooms | ~400ms |
| `/api/virtual-office/presence` | GET | Poll (periodic) | AI member presence | ~200ms |
| `/api/virtual-office/rooms/{id}/join` | POST | Click room | Enter room | ~200ms |
| `/api/virtual-office/rooms/{id}/leave` | POST | Leave room | Exit room | ~200ms |
| `/api/virtual-office/rooms/{id}/messages` | GET | Enter room | Load room messages | ~300ms |
| `/api/virtual-office/rooms/{id}/messages` | POST | Send message | Post to room | ~3-10s (AI reply) |
| `/api/virtual-office/rooms` | POST | Create room | New room | ~300ms |
| `/api/virtual-office/presence` | POST | Periodic | Update user presence | ~200ms |

## Components & Sections

### Office Floor Plan
- Grid layout with labeled rooms
- AI avatars positioned in rooms
- Presence indicators (online/away)
- Click room to enter

### Room View
- Chat-style message thread
- AI member avatars with status
- Message input with send button
- Leave room button

### Room Management
- Create new room
- Assign AI members to rooms
- Room type labels

---

# 21 — Data Extraction (Classifications)

## Route
`/classifications`

## Purpose
Structured data extraction from documents. Define extraction schemas (e.g., invoice fields), upload documents, and AI extracts structured data. Supports batch processing, result review, and export.

## UX Flow
1. Page loads → fetches classification types + history
2. User creates/manages extraction schemas (fields, types, descriptions)
3. Uploads documents → select schema → batch classify
4. Results table with extracted fields, confidence scores
5. Review and correct results → export

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/classifications` | GET | Page load | List schemas | ~300ms |
| `/api/classifications` | POST | Create schema | New extraction schema | ~300ms |
| `/api/classifications/{id}` | PUT | Edit schema | Update schema | ~300ms |
| `/api/classifications/{id}` | DELETE | Delete schema | Remove schema | ~200ms |
| `/api/classifications/history` | GET | History tab | Past extraction runs | ~300ms |
| `/api/classifications/classify-batch` | POST | Run extraction | Batch process documents | ~5-60s |
| `/api/classifications/refine-prompt` | POST | Refine button | AI improves extraction prompt | ~5-15s |
| `/api/classifications/export-images` | GET | Export button | Export results as images | ~2-5s |
| `/api/classifications/results/{id}` | PATCH | Edit result | Correct extracted field | ~200ms |
| `/api/documents/upload` | GET | Document selector | List available docs | ~300ms |
| `/api/documents/folders` | GET | Folder filter | List folders | ~200ms |

## Components & Sections

### Schema Manager
- Create/edit extraction schemas
- Fields: name, data type, description, required flag
- AI prompt refiner for improving extraction accuracy

### Document Selector
- Upload new documents or select existing
- Folder filtering
- Multi-select for batch processing

### Results Table
- Extracted fields per document
- Confidence scores per field
- Inline editing for corrections
- Batch export
- Result detail modal

---

# 22 — Knowledge Insights

## Route
`/knowledge-gaps`

## Purpose
AI-powered analysis of knowledge coverage gaps. Identifies missing topics, under-documented areas, and suggestions for improvement.

## UX Flow
1. Page loads → fetches current gap analysis
2. "Analyze" button triggers new AI analysis
3. Results show gap categories with severity and suggestions
4. User can dismiss/acknowledge gaps

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/knowledge-gaps` | GET | Page load | Current gaps | ~300ms |
| `/api/knowledge-gaps/analyze` | POST | Analyze button | Run AI gap analysis | ~5-20s |
| `/api/knowledge-gaps/{id}` | PATCH | Dismiss button | Update gap status | ~200ms |

## Components & Sections

### Gap Analysis Results
- Cards per gap category
- Severity badges: critical, warning, info
- Suggestion text with "Upload" CTA
- Dismiss/acknowledge action
