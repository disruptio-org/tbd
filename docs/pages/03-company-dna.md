# 03 — Company DNA

## Route
`/company-dna`

## Purpose
The **knowledge graph explorer**. Visualizes all structured knowledge extracted from documents across 13 entity types. Shows coverage scores, knowledge gaps, and lets users upload documents, manage resources, and inspect individual knowledge nodes.

## UX Flow
1. Page loads → scope selector defaults to "Company" (can switch to customer/project)
2. **5 parallel API calls** per scope change
3. Main view: coverage score + entity type breakdown + gap insights + resource grid
4. Users can upload documents directly, manage resource categories, and click into individual nodes
5. "Process DNA" button triggers LLM extraction on un-processed documents

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/dna?scope=...` | GET | Page load / scope change | Coverage score, node counts | ~400ms |
| `/api/dna/resources?scope=...` | GET | Page load / scope change | Resource categories | ~300ms |
| `/api/dna/nodes?scope=...` | GET | Page load / scope change | Knowledge nodes list | ~400ms |
| `/api/customers` | GET | Page load | Customer list for scope selector | ~300ms |
| `/api/projects` | GET | Page load | Project list for scope selector | ~300ms |
| `/api/documents/upload` | POST | File drop | Upload document | ~1-5s |
| `/api/documents/{id}` | PATCH | After upload | Tag as knowledge source | ~200ms |
| `/api/ocr` | POST | After upload | Trigger OCR | ~3-15s |
| `/api/dna/resources` | POST | Create resource | Add new resource category | ~300ms |
| `/api/dna/resources/{id}` | PUT | Edit resource | Update resource | ~300ms |
| `/api/dna/resources/{id}` | DELETE | Delete resource | Remove resource | ~300ms |
| `/api/dna/process` | POST | "Process DNA" button | Run LLM extraction | ~5-30s |
| `/api/dna/nodes/{id}` | GET | Click node | Fetch node details | ~200ms |
| `/api/dna/nodes/{id}` | DELETE | Delete node | Remove knowledge node | ~200ms |

## Components & Sections

### Scope Selector
- Dropdown: Company / Customer / Project
- Customer and Project options loaded from API
- Changing scope reloads all data

### Coverage Overview
- **Circular progress indicator** — overall coverage percentage
- **Entity type breakdown grid** — 13 colored cards (product, persona, process, competitor, messaging, policy, case_study, market, pricing, content_strategy, metric, methodology, integration)
- Each card: type label, node count, color-coded border

### Gap Insights Panel
- Lists entity types with 0 nodes
- Per gap: description + helpful suggestion text + "Upload" CTA button
- Opens upload modal pre-tagged for the specific category

### Resource Grid
- Cards per resource category (e.g. "Products & Features")
- Each card: icon, name, document count, edit/delete actions
- "Add Resource" button opens create modal

### Knowledge Nodes List
- Filterable table of all nodes
- Columns: title, type badge, source document, last updated
- Click → opens detail modal with full content, relationships, metadata
- Delete button per node

### Upload Modal
- Pre-categorized upload zone
- Supports multiple files
- Auto-triggers OCR after upload
- Progress indicator during upload + processing
