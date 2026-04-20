# 07 — Product Assistant

## Route
`/product`

## Purpose
AI-powered product management assistant. Generates PRDs, feature specs, product briefs, release notes, user stories, and more. Grounded in company knowledge via wiki-first retrieval.

## UX Flow
Same pattern as Marketing/Sales assistants:
1. Load history → select content type → fill form → generate → review → save

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/product/history` | GET | Page load | Load generation history | ~300ms |
| `/api/product/generate` | POST | Generate button | AI content generation | ~5-20s |
| `/api/product/history/{id}` | GET | Click history item | Load past generation | ~200ms |
| `/api/product/history` | DELETE | Delete button | Delete history item | ~200ms |
| `/api/tasks/{id}/links` | POST | "Create Task" | Link output to task | ~300ms |

## Components & Sections
Same UX pattern as Marketing/Sales with product-specific types:
- PRD, Feature Spec, Product Brief, Release Notes, User Story, Competitive Analysis
- Output panel, history sidebar, task creation, grounding status

---

# 08 — Company Advisor

## Route
`/company-advisor`

## Purpose
Strategic AI advisor grounded in company knowledge. Answers strategic questions, provides business recommendations, analyzes opportunities. Deeper reasoning than general chat.

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/company-advisor/history` | GET | Page load | Load history | ~300ms |
| `/api/company-advisor/generate` | POST | Send button | Generate advisory response | ~8-25s |
| `/api/company-advisor/history/{id}` | GET | Click history | Load past response | ~200ms |
| `/api/company-advisor/history` | DELETE | Delete button | Remove history | ~200ms |

## Components & Sections
Same conversational pattern as other assistants with advisory-focused UX

---

# 09 — Onboarding Assistant

## Route
`/onboarding-assistant`

## Purpose
Guided onboarding experience for new users. Helps users understand the platform, set up their company profile, and start using AI features.

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/onboarding-assistant/history` | GET | Page load | Load history | ~300ms |
| `/api/onboarding-assistant/generate` | POST | Send button | Generate guidance | ~5-15s |
| `/api/onboarding-assistant/history/{id}` | GET | Click history | Load past response | ~200ms |
| `/api/onboarding-assistant/history` | DELETE | Delete button | Remove history | ~200ms |
