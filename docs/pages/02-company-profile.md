# 02 — Company Profile

## Route
`/company/profile`

## Purpose
Manage company information (name, description, brand voice, etc.) and company-level documents. This data feeds into all AI assistants as foundational context.

## UX Flow
1. Page loads → 2 parallel calls: profile data + completion score
2. **Two tabs**: Profile (form) and Documents (upload/manage)
3. Profile tab: user edits fields → "Save" → PATCH call → toast notification
4. Documents tab: drag-and-drop or click to upload → auto-OCR → table with actions

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/company/profile` | GET | Page load | Load profile fields | ~300ms |
| `/api/company/profile/completion` | GET | Page load | Profile completion % | ~200ms |
| `/api/company/profile` | PATCH | Save button | Update profile fields | ~400ms |
| `/api/documents/upload` | GET | Tab switch | List company documents | ~300ms |
| `/api/documents/upload` | POST | File drop/select | Upload document | ~1-5s (file size) |
| `/api/ocr` | POST | After upload | Trigger OCR processing | ~3-15s |
| `/api/documents/{id}/reprocess` | POST | "Reprocess" button | Re-run OCR | ~3-15s |
| `/api/documents/{id}` | PATCH | Toggle knowledge | Enable/disable as knowledge source | ~300ms |
| `/api/documents/{id}` | DELETE | Delete button | Remove document | ~300ms |

## Components & Sections

### Profile Tab
- **Completion indicator** — progress bar with percentage
- **Form fields**: Company Name, Description, Website, Industry, Products/Services, Target Customers, Brand Voice, Mission/Vision
- **Save button** — bottom-right, enabled when form is dirty

### Documents Tab
- **Upload zone** — drag-and-drop area with file input fallback
- **Documents table** — columns: filename, type, OCR status, knowledge source toggle, actions
- **OCR status badges**: PENDING, PROCESSING, DONE, ERROR
- **Bulk actions**: select all, delete selected
- **Knowledge source toggle** — switch to include/exclude from AI knowledge
- **Document viewer modal** — view extracted text for a document
