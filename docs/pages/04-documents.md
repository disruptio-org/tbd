# 04 — Documents

## Route
`/documents`

## Purpose
Central document management hub. Upload, organize, process, and manage all company documents. Supports direct upload, Google Drive sync, and Notion sync. Documents are OCR'd, embedded, and compiled into the wiki.

## UX Flow
1. Page loads → fetches documents list, integration status, customers, projects
2. User can upload via drag-and-drop or file picker
3. After upload → auto-OCR → auto-embed → auto-wiki compile
4. Table with filters, bulk actions, document detail sidebar
5. Connected integrations show external documents in a separate tab

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/documents/upload` | GET | Page load | List all documents | ~400ms |
| `/api/integrations` | GET | Page load | Check connected integrations | ~300ms |
| `/api/integrations/{id}/documents` | GET | Integration tab | List external docs | ~500ms |
| `/api/customers` | GET | Page load | Customer filter options | ~200ms |
| `/api/projects` | GET | Page load | Project filter options | ~200ms |
| `/api/documents/upload` | POST | File upload | Upload file | ~1-10s |
| `/api/ocr` | POST | After upload | Trigger OCR | ~3-15s |
| `/api/documents/{id}/reprocess` | POST | Reprocess button | Re-run OCR + embed | ~3-15s |
| `/api/documents/{id}` | PATCH | Toggle/rename | Update document metadata | ~200ms |
| `/api/documents/{id}` | DELETE | Delete button | Remove document | ~200ms |

## Components & Sections

### Upload Zone
- Drag-and-drop overlay with animated border
- File type validation (PDF, DOCX, images, etc.)
- Progress bar during upload

### Document Table
- Sortable columns: Name, Type, OCR Status, Size, Date, Knowledge Source
- Status badges: PENDING, PROCESSING, DONE, ERROR
- Bulk select + bulk delete
- Search/filter bar

### Document Actions
- View extracted text modal
- Reprocess OCR
- Toggle knowledge source
- Delete (with confirmation)

### Integration Sections
- Google Drive / Notion sections (if connected)
- Sync button per integration
- External document list with sync status
