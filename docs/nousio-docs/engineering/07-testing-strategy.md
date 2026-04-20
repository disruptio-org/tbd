# 07 — Testing Strategy

## Testing Stack

| Tool | Version | Purpose |
|------|---------|---------|
| **Playwright** | 1.58.2 | End-to-end browser testing |
| **ESLint** | 9.x | Code quality and style enforcement |

## Current Testing Landscape

### Unit Tests
- **Status**: ❌ Not currently implemented
- **Framework**: None configured
- **Coverage**: 0%

### Integration Tests
- **Status**: ❌ Not currently implemented
- **No API endpoint tests**
- **No service-layer tests**

### End-to-End Tests
- **Status**: ⚠️ Playwright installed, test infrastructure in place
- **Framework**: Playwright
- **Configuration**: Standard Playwright config
- **Test files**: Located in `tests/` or `e2e/` directory

### Contract Tests
- **Status**: ❌ Not implemented
- **No API contract testing**

## AI Output Evaluation

### Grounding Status Tracking
The platform logs AI response quality:
- `AssistantQuestionLog`: Records each question with `groundingStatus` (VERIFIED, PARTIAL, NOT_FOUND, GENERAL)
- `KnowledgeGap`: Aggregates ungrounded questions by topic

### Missing AI Testing
- ❌ No automated prompt regression testing
- ❌ No A/B testing for prompt templates
- ❌ No output quality scoring
- ❌ No hallucination detection tests
- ❌ No latency benchmarks for AI responses

## What Is Intentionally Not Tested

| Area | Reason |
|------|--------|
| Supabase Auth | Managed service, tested by provider |
| OpenAI API | External service, tested by provider |
| Prisma ORM | Well-tested library |
| React components (snapshot/unit) | Not prioritized; E2E covers critical paths |

## Test Data Strategy

### Prisma Seed
- Seed file: `prisma/seed.mjs`
- Purpose: Initial data setup for development
- Contains: Default company, super admin user, sample data

### No Test Fixtures
- ❌ No factory functions for test data
- ❌ No mock data generators
- ❌ No database seeding for tests specifically

## Recommended Testing Improvements

### Priority 1: Integration Tests
- Test critical API routes with test database
- Focus on: auth flow, document upload + embedding, access control resolution

### Priority 2: AI Evaluation
- Create prompt regression test suite
- Compare AI outputs against golden examples
- Track grounding rates over time

### Priority 3: E2E Critical Paths
- Onboarding wizard flow
- Document upload and search
- AI chat conversation
- CRM pipeline management
- Task board operations
