# 06 — Sales Assistant

## Route
`/sales`

## Purpose
AI-powered sales content and lead management. Generates proposals, outreach emails, follow-ups, objection handling. Also includes a **Leads** tab with B2B lead search via API enrichment.

## UX Flow
1. Page loads → fetches generation history
2. **Two main tabs** implied by lead redirect: Sales Content + Leads (via `?tab=leads`)
3. Content generation: select type → fill form → generate → review output
4. Leads: search criteria → AI-enriched lead discovery → save/export

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/sales/history` | GET | Page load | Load generation history | ~300ms |
| `/api/sales/generate` | POST | Generate button | AI content generation | ~5-20s |
| `/api/sales/history/{id}` | GET | Click history item | Load past generation | ~200ms |
| `/api/sales/history` | DELETE | Delete button | Delete history item | ~200ms |
| `/api/tasks/{id}/links` | POST | "Create Task" | Link output to task | ~300ms |

## Components & Sections
Same UX pattern as Marketing Assistant with sales-specific content types:
- Proposal, Outreach Email, Follow-up, Objection Handling, Discovery Questions, Call Script

### Leads Tab
- Redirected from `/leads` → `/sales?tab=leads`
- Search form: industry, region, company size, ICP criteria
- Results table with company info, contact details, enrichment data
