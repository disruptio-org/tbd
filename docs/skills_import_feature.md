# Skills Import Feature Documentation

## Overview
The **Skills Import** feature allows administrators to upload a packaged skill (a `.zip` file) that contains a `SKILL.md` definition, optional agent YAML files, and reference markdown documents. The endpoint parses the package, validates its contents, and either returns a preview of the parsed skill or creates the skill in the database.

---

## API Endpoint
```
POST /api/ai/skills/import
```
- **Authentication**: Requires an authenticated user with the `ADMIN` role.
- **Content‑Type**: `multipart/form-data`

---

## Request Payload
| Field | Type | Description |
|-------|------|-------------|
| `file` | `File` (required) | The `.zip` archive containing the skill package. |
| `assistantType` | `string` (optional) | A single assistant type to attach the skill to (comma‑separated list is also accepted). |
| `assistantTypes` | `string` (optional) | JSON array of assistant types – preferred over `assistantType`. |
| `mode` | `string` (optional) | `'preview'` (default) returns parsed data without persisting; `'import'` creates the skill. |

---

## Processing Steps
1. **Auth Check** – `getCurrentUser()` ensures the request is made by an admin.
2. **File Validation**
   - Must be present and end with `.zip`.
   - Size limited to **2 MiB**.
3. **Unzip Archive** – Uses `JSZip` to read the archive into memory.
4. **Locate `SKILL.md`** – Searches all entries for a file named `SKILL.md`. This file is mandatory.
5. **Parse `SKILL.md`**
   - Front‑matter (`---` block) is extracted via `parseFrontmatter`.
   - Required keys: `name` (used for the skill key) and the body (instruction prompt).
6. **Parse Agent YAML (optional)** – First `agents/*.yaml` file is read with `parseSimpleYaml` to obtain:
   - `display_name`
   - `short_description`
   - `category`
7. **Collect Reference Documents** – All `references/*.md` files are read and stored as training material objects (truncated to 50 k characters).
8. **Build Skill Key** – Normalises the `name` to a snake‑case identifier.
9. **Preview Mode** (`mode !== 'import'`)
   - Returns a JSON payload `{ preview: parsed }` containing the derived skill data.
10. **Import Mode** (`mode === 'import'`)
    - Resolves assistant types from `assistantTypes` or `assistantType`.
    - Inserts a new row into `AssistantSkill` with status `DRAFT`.
    - Creates `SkillAssignment` rows for each assistant type.
    - Writes an initial entry to `SkillVersionLog`.
    - Returns `{ skill: { … }, imported: true }` with HTTP 201.

---

## Response Formats
### Preview
```json
{
  "preview": {
    "key": "my_skill",
    "name": "My Skill",
    "description": "…",
    "category": "…",
    "instructionPrompt": "…",
    "trainingMaterials": [
      { "id": "…", "filename": "example.md", "textContent": "…", "uploadedAt": "…" }
    ],
    "trainingMaterialCount": 2,
    "promptLength": 1234
  }
}
```
### Import Success
```json
{
  "skill": {
    "id": "…",
    "companyId": "…",
    "assistantType": "MARKETING",
    "key": "my_skill",
    "name": "My Skill",
    "description": "…",
    "category": "…",
    "instructionPrompt": "…",
    "assistantTypes": ["MARKETING"]
  },
  "imported": true
}
```
### Errors
| Status | Condition |
|--------|-----------|
| 400 | Missing file, wrong extension, oversized file, or missing `SKILL.md`. |
| 401 | Unauthenticated request. |
| 403 | Authenticated user is not an admin. |
| 409 | Skill key already exists. |
| 500 | Unexpected server error. |

---

## Security Considerations
- Only **ADMIN** users can invoke the endpoint.
- File size is capped to prevent memory exhaustion.
- The zip is processed **in‑memory**; no files are written to disk.
- All database operations use parameterised Supabase queries, mitigating SQL injection.
- Duplicate skill keys are rejected with a clear 409 response.

---

## Related Code
- **Route**: `src/app/api/ai/skills/import/route.ts`
- **Front‑matter parser**: `parseFrontmatter` (inline in the route).
- **YAML parser**: `parseSimpleYaml` (inline).
- **Skill fetching hook**: `src/lib/useAssistantSkills.ts` – consumes the skill data after import.

---

## Future Enhancements (optional)
- Support for larger zip files with streaming extraction.
- Validation of agent YAML schema against a JSON schema.
- Automatic icon extraction from the package.
- Background processing for very large reference documents.

---

*Generated on 2026‑04‑01.*
