# Functional Specification
## Personal In-App AI Action Assistant with Configurable User-Defined Name

## 1. Document Purpose
This specification defines the functional requirements for a personal, in-app AI action assistant for Nousio. The assistant is available from anywhere in the platform, can be invoked by text or voice, supports a user-defined name, interprets natural-language requests, coordinates cross-module actions, asks clarifying questions when needed, confirms uncertain or high-impact actions, and returns the user to the completed result.

This document is intended for product, design, engineering, and implementation stakeholders.

---

## 2. Executive Summary
The proposed feature introduces a persistent personal assistant layer across Nousio that acts as an execution interface rather than only a conversational interface. Instead of requiring users to navigate module-by-module, the assistant allows them to express intent directly, for example:

- “Create a prospecting email for this lead.”
- “Turn this product brief into tasks.”
- “Find three target companies and draft outreach.”
- “Summarize this page and create follow-up actions.”
- “Open my onboarding guide and explain the next step.”

The assistant should:
1. understand user intent in context,
2. determine the right module or workflow,
3. gather required inputs,
4. ask clarifying questions when needed,
5. confirm before uncertain or impactful actions,
6. execute the action,
7. present grounded results,
8. return or route the user to the relevant completed output.

This aligns strongly with Nousio’s product philosophy of structured AI adoption, practical operational use, and controlled access to company knowledge. It also extends the existing specialized assistant model by adding a cross-platform orchestration layer above existing assistants and workspaces.

**Confirmed platform context used in this spec:**
- Nousio is a multi-tenant AI workspace with strict `companyId`-based data isolation and RAG-grounded outputs. Sources: **solution_overview.md**, **nousio_positioning.md**.
- The platform already has specialized assistants: Company Advisor, Onboarding Assistant, Marketing Assistant, Sales Assistant, Product Assistant, and Lead Discovery. Sources: **solution_overview.md**, **nousio_positioning.md**.
- Growth assistants already generate structured outputs and use shared RAG retrieval utilities. Source: **features_documentation.md**.
- Speech-to-text is already available via the reusable `SmartInput` component, currently used in Lead Discovery, Marketing Assistant, and Sales Assistant. Source: **features_documentation.md**.
- AI Brain profiles support company-wide and role-specific behavior, with versioning and runtime prompt resolution. Source: **ai_brain_system.md**.

---

## 3. Scope

### 3.1 In Scope (MVP)
The MVP should include:

1. **Persistent assistant entry point** available globally across authenticated dashboard pages.
2. **User-defined assistant name** configurable per user.
3. **Text and voice input** for action requests.
4. **Context-aware intent interpretation** based on current page/module and user permissions.
5. **Cross-module action routing** to existing modules/workflows where feasible.
6. **Clarification flow** when required inputs are missing or ambiguity is high.
7. **Confirmation flow** before actions with uncertainty or material consequences.
8. **Execution orchestration** for supported actions across:
   - Company knowledge/chat-related actions
   - Marketing Assistant
   - Sales Assistant
   - Product Assistant
   - Lead Discovery
   - Tasks / execution workspace
9. **Result handoff** that either:
   - returns inline results, or
   - deep-links the user to the created/generated item.
10. **Grounding and trust indicators** where outputs depend on company knowledge.
11. **Audit-friendly activity logging** of assistant requests and execution outcomes.
12. **RBAC-aware behavior** respecting role permissions.

### 3.2 Out of Scope (MVP)
The following should be considered later-phase unless already trivial to support:

1. Fully autonomous multi-step background agents operating without user checkpoints.
2. External third-party system actions not already integrated into Nousio.
3. Voice output / text-to-speech.
4. Offline voice support.
5. User-created custom action plugins.
6. Long-running autonomous planning across multiple days.
7. Cross-company shared assistants.

### 3.3 Likely Phase 2+
1. Personalized proactive suggestions.
2. Saved action macros / reusable commands.
3. Multi-language voice recognition.
4. Assistant memory/preferences beyond naming.
5. Delegated actions across teams with approvals.
6. Background execution queue with notifications.
7. More sophisticated planning and dependency handling.

---

## 4. Problem Statement
Today, Nousio already offers specialized AI assistants and execution spaces, but users still need to know where to go and which tool to use. That creates friction between user intent and platform execution.

This feature addresses the gap by introducing a personal orchestration assistant that:
- serves as the universal front door to platform actions,
- reduces navigation overhead,
- supports natural language and hands-free interaction,
- translates ambiguous user requests into structured platform actions,
- preserves control through clarifications and confirmations.

This is especially relevant for Nousio because the platform is positioned not as a generic chatbot but as a structured AI workspace with specialized assistants and operational workflows. Sources: **solution_overview.md**, **Cross-Application UXUI Principles System.md**, **nousio_positioning.md**.

---

## 5. Goals and Non-Goals

### 5.1 Business Goals
1. Reduce friction between intent and execution.
2. Increase usage of existing modules by making them easier to access.
3. Improve speed of execution for operational, marketing, sales, and project tasks.
4. Increase trust through guided clarification and confirmation.
5. Strengthen Nousio’s positioning as an operational AI workspace rather than a collection of isolated tools.

### 5.2 User Goals
1. Ask for help from anywhere without switching context.
2. Speak or type naturally.
3. Get the right action done without understanding internal module boundaries.
4. Be asked follow-up questions only when necessary.
5. Stay in control before impactful actions happen.
6. Reach the finished result quickly.

### 5.3 Non-Goals
1. Replace all specialized assistants with one generic assistant.
2. Remove explicit module ownership or workflow boundaries.
3. Execute actions beyond the user’s permissions.
4. Provide ungrounded company-specific claims when evidence is missing.

---

## 6. Confirmed Facts vs Assumptions

### 6.1 Confirmed Facts
1. Nousio uses strict multi-tenant isolation with `companyId` on all relevant data. Source: **solution_overview.md**.
2. RAG grounding and status indicators (`VERIFIED`, `PARTIAL`, `NOT FOUND`) exist and are core to trust. Sources: **solution_overview.md**, project context.
3. The platform has existing specialized assistants and generation routes for Product, Marketing, Sales, and Lead Discovery. Sources: **solution_overview.md**, **ai_brain_system.md**.
4. SmartInput already supports browser-native speech-to-text and AI rewrite. Source: **features_documentation.md**.
5. RBAC roles are `MEMBER`, `ADMIN`, `SUPER_ADMIN`. Sources: **solution_overview.md**, project context.
6. There is an AI Tasks / Execution Workspace connected to assistants and outputs. Source: **features_documentation.md**.
7. AI Brain profiles can define behavior by brain type and be resolved dynamically. Source: **ai_brain_system.md**.

### 6.2 Assumptions
1. A new assistant type or orchestration layer can be added without replacing existing assistants.
2. Existing generation endpoints can be orchestrated by a shared action-routing service.
3. Deep linking to generated outputs or created tasks is technically feasible.
4. User profile settings can store a custom assistant name.
5. Current page context can be safely passed into the orchestration layer.

### 6.3 Clarifications Needed
1. Should the assistant be branded as a new assistant type, or as a shell above all assistants?
2. Should the assistant support page-level floating UI, command palette UI, sidebar dock, or all three?
3. What actions are considered “high-impact” and must always require confirmation?
4. Should the assistant be able to modify/delete data in MVP, or only create/generate/navigate?
5. Should conversation history persist as a separate thread type or as action logs only?
6. Is voice invocation passive (button press) only, or should wake-word behavior ever be considered? Recommendation: button press only for MVP.

---

## 7. Users, Actors, and Roles

| Actor | Description | Core Needs | Constraints |
|---|---|---|---|
| MEMBER | Standard authenticated user | Fast action execution, natural-language help, access to permitted modules | Cannot perform admin-only actions |
| ADMIN | Company administrator | Same as member plus configuration and governance actions | Must respect company policy and permissions |
| SUPER_ADMIN | Platform-level administrative role | Support, oversight, advanced configuration | Must preserve tenant isolation |
| Assistant Orchestrator | System layer that interprets requests and routes actions | Intent detection, clarification, execution, handoff | Must obey RBAC, grounding, and audit rules |
| Existing Module Assistants | Marketing, Sales, Product, Onboarding, Company Advisor, Lead Discovery | Fulfill specialized tasks | Must remain specialized, not bypassed |

---

## 8. User Needs to Feature Mapping

| User Need | Feature Response | Business Value |
|---|---|---|
| “I want to do something without hunting for the right page.” | Global assistant entry point with routing | Improves platform usability and module adoption |
| “I want to speak naturally.” | Voice-enabled request capture via reusable speech input patterns | Reduces friction and supports hands-free use |
| “I want the system to understand what I mean on this page.” | Context-aware intent parsing using current route/page state | Faster execution, fewer steps |
| “I don’t want the system to guess wrongly.” | Clarifying questions and confirmation checkpoints | Trust, accuracy, lower error rates |
| “I want the result, not just a response.” | Execute action and return/deep-link to outcome | Operational usefulness |
| “I want my assistant to feel personal.” | User-defined assistant name | Personalization and adoption |

---

## 9. Functional Overview
The assistant acts as a cross-platform orchestration layer sitting above the current specialized assistant ecosystem.

### 9.1 Core Functional Capabilities
1. Capture user request from any page.
2. Enrich request with context:
   - current route,
   - current object/page metadata,
   - user role,
   - company context,
   - available modules/actions.
3. Classify intent.
4. Determine whether request is:
   - answer-only,
   - generate-only,
   - create/update action,
   - navigation request,
   - multi-step orchestration.
5. Evaluate confidence and missing parameters.
6. Ask follow-up questions if needed.
7. Require explicit confirmation when confidence is low or action is sensitive.
8. Execute the underlying route/workflow.
9. Return outcome with next-step options.
10. Log execution trail.

---

## 10. Feature List

### 10.1 Global Assistant Access
**Description:** A persistent assistant trigger available across dashboard pages.

**Requirements:**
- Accessible from all authenticated primary workspaces.
- Supports keyboard/mouse/touch invocation.
- Opens a consistent assistant panel/modal/drawer.
- Maintains current page context.

**Recommendation:** Use a fixed global launcher plus keyboard shortcut, consistent with Nousio’s clean focus and action-oriented UX principles from **Cross-Application UXUI Principles System.md**.

### 10.2 Configurable User-Defined Name
**Description:** Each user can assign a personal name to their assistant.

**Requirements:**
- Name stored per user account.
- Name shown in assistant UI and prompts where appropriate.
- Default fallback name exists if user has not configured one.
- Name must not affect permissions or actual assistant identity logic.

### 10.3 Text and Voice Input
**Description:** Users can type or speak requests.

**Requirements:**
- Reuse existing speech-to-text patterns from `SmartInput` where possible. Source: **features_documentation.md**.
- Manual start/stop recording.
- Visible recording state.
- Transcript editable before submission.
- Browser compatibility fallback for unsupported speech APIs.

### 10.4 Context-Aware Intent Parsing
**Description:** The assistant interprets requests using page and object context.

**Examples:**
- On a lead page: “Draft first outreach.”
- On a product output page: “Turn this into tasks.”
- On a company profile page: “Summarize what’s missing.”

**Requirements:**
- Include route-level context.
- Include selected object IDs where available.
- Do not over-assume hidden context if not explicit.

### 10.5 Action Routing and Orchestration
**Description:** Requests are routed to the appropriate module or workflow.

**Supported MVP action classes:**
1. Navigate to relevant workspace.
2. Generate content in Marketing/Sales/Product.
3. Create tasks from outputs.
4. Trigger lead discovery flow.
5. Query company knowledge via existing grounded systems.
6. Summarize current content/page context.

### 10.6 Clarification Flow
**Description:** Assistant asks concise follow-up questions when inputs are incomplete.

**Requirements:**
- Ask only for missing critical inputs.
- Prefer structured prompts/options where possible.
- Keep one decision per step.
- Preserve user trust by stating why clarification is needed.

### 10.7 Confirmation Flow
**Description:** Assistant asks for explicit user confirmation before uncertain or high-impact actions.

**Examples:**
- Creating tasks in a shared board.
- Overwriting an existing draft.
- Running a lead discovery search with broad criteria.
- Any future destructive action.

### 10.8 Execution and Result Handoff
**Description:** Once confirmed, the assistant executes the action and returns the user to the result.

**Requirements:**
- Inline progress states.
- Success/failure outcomes.
- Deep-link to created/generated object where relevant.
- Inline preview for quick review.

### 10.9 Grounding and Trust Indicators
**Description:** When results rely on company knowledge, the assistant should show grounding status consistent with platform conventions.

**Requirements:**
- Reuse `VERIFIED`, `PARTIAL`, `NOT FOUND` model. Sources: project context, **solution_overview.md**.
- Distinguish grounded evidence from assistant inference.
- Avoid presenting unsupported company-specific claims as certain.

### 10.10 Activity Logging
**Description:** Log assistant requests, clarifications, confirmations, routed actions, and outcomes.

**Purpose:**
- troubleshooting,
- governance,
- future analytics,
- trust and support.

---

## 11. User Flows

### 11.1 Flow A — Quick Content Generation from Anywhere
1. User opens assistant from any page.
2. User says: “Create a LinkedIn post about our new onboarding workflow.”
3. Assistant detects marketing generation intent.
4. Assistant checks if enough context exists.
5. If not, asks for target audience or tone.
6. User responds.
7. Assistant routes request to Marketing Assistant generation flow.
8. RAG retrieves relevant company knowledge.
9. Output generated and grounding status shown.
10. User is shown result inline and can open full marketing workspace.

### 11.2 Flow B — Convert Existing Output into Tasks
1. User is viewing a Product Assistant result.
2. User invokes assistant and says: “Turn this into execution tasks.”
3. Assistant reads current page context and result ID.
4. Assistant asks which board/project to use if ambiguous.
5. User selects board.
6. Assistant confirms task creation count/summary.
7. User confirms.
8. Assistant creates tasks in execution workspace.
9. Assistant returns user to the created Kanban board or task list.

### 11.3 Flow C — Lead Discovery Request
1. User opens assistant on any page.
2. User requests: “Find B2B leads for our HR onboarding solution.”
3. Assistant routes to Lead Discovery logic.
4. Assistant checks if ICP or filters are missing.
5. Assistant asks for region/industry if required.
6. User provides details.
7. Assistant executes lead discovery.
8. Results shown with next actions such as “draft outreach.”

### 11.4 Flow D — Knowledge Question with Insufficient Evidence
1. User asks: “What is our formal refund policy?”
2. Assistant queries company knowledge.
3. RAG finds insufficient evidence.
4. Assistant returns `NOT FOUND` or `PARTIAL` status.
5. Assistant states that documentation is insufficient.
6. Assistant suggests next actions, such as uploading policy docs or asking an admin.

### 11.5 Flow E — Voice-First Request
1. User taps microphone.
2. Voice recording begins with clear visual state.
3. Transcript is captured.
4. User edits transcript if needed.
5. Assistant processes request as normal.

---

## 12. Business Rules

1. **Tenant Isolation:** All assistant interactions, logs, retrieval, and resulting actions must be scoped to the current `companyId`. Confirmed by **solution_overview.md**.
2. **RBAC Enforcement:** The assistant must never execute actions beyond the user’s assigned role permissions.
3. **No Permission Escalation by Prompt:** Natural language cannot bypass module restrictions.
4. **Grounding Transparency:** Company-specific factual outputs must display grounding status where applicable.
5. **Clarification Before Execution:** If required parameters are missing, the assistant must ask before executing.
6. **Confirmation on Uncertainty/Impact:** If confidence is low or action has meaningful consequence, explicit confirmation is required.
7. **Context Is Assistive, Not Absolute:** Current page context may inform interpretation but must not override explicit user intent.
8. **User Naming Is Cosmetic:** Assistant name personalization does not create a separate agent identity or memory boundary.
9. **Auditability:** Executed actions and outcomes should be traceable.
10. **Specialized Assistant Reuse:** The orchestration assistant should call existing module capabilities rather than duplicating them where possible.

---

## 13. Acceptance Criteria

### 13.1 Global Access
- Given an authenticated user on any supported dashboard page, when they invoke the assistant, then the assistant opens without losing page context.

### 13.2 User-Defined Name
- Given a user has configured a custom assistant name, when they open the assistant, then the configured name is displayed consistently in the UI.

### 13.3 Voice Input
- Given a supported browser, when the user starts voice capture, then recording state is shown and transcript text is inserted for review.
- Given an unsupported browser, when the user attempts voice capture, then the system shows a clear fallback/error state.

### 13.4 Intent Routing
- Given a request matching a supported action class, when the user submits it, then the assistant routes it to the appropriate module/workflow.

### 13.5 Clarification
- Given a request missing required inputs, when the assistant cannot safely execute, then it asks a concise clarification question before proceeding.

### 13.6 Confirmation
- Given a request with low confidence or meaningful side effects, when the assistant is ready to execute, then it requests explicit confirmation.

### 13.7 Result Handoff
- Given a successfully executed action, when execution completes, then the user receives either inline output or a deep-link to the resulting object/workspace.

### 13.8 Grounding
- Given a knowledge-based answer or generation using company context, when the result is displayed, then grounding status is shown according to platform conventions.

### 13.9 RBAC
- Given a user lacks permission for an action, when they request it, then the assistant refuses execution and explains the limitation clearly.

### 13.10 Logging
- Given any assistant execution attempt, when it completes or fails, then an execution record is stored with status and route details.

---

## 14. Edge Cases and Failure Scenarios

1. **Ambiguous intent across modules**
   - Example: “Create a plan for launch.”
   - Expected behavior: ask whether user wants product plan, marketing plan, or execution tasks.

2. **Current page context conflicts with explicit request**
   - Example: user on Sales page says “Create a PRD.”
   - Expected behavior: explicit request wins; route to Product Assistant.

3. **Voice transcript errors**
   - Expected behavior: allow transcript review/edit before execution.

4. **Unsupported browser voice API**
   - Expected behavior: disable voice capture gracefully and preserve text input.

5. **Low-confidence routing**
   - Expected behavior: present best-guess interpretation with confirmation.

6. **Insufficient knowledge grounding**
   - Expected behavior: show `PARTIAL` or `NOT FOUND`, avoid unsupported assertions.

7. **User requests forbidden/admin action**
   - Expected behavior: deny and optionally suggest who can perform it.

8. **Execution route returns partial failure**
   - Example: tasks created but one item rejected.
   - Expected behavior: show partial completion summary.

9. **Long-running generation**
   - Expected behavior: display progress state and preserve conversation/action state.

10. **Page object deleted or stale context**
   - Expected behavior: detect invalid reference, ask user to reselect target.

---

## 15. Data Model Hints

This section is indicative, not a final schema commitment.

### 15.1 Suggested Entities

#### `UserAssistantPreference`
- `id`
- `userId`
- `companyId`
- `displayName`
- `voiceEnabled` (optional preference)
- `createdAt`
- `updatedAt`

#### `AssistantSession`
- `id`
- `userId`
- `companyId`
- `currentRoute`
- `currentContextJson`
- `status` (`ACTIVE`, `COMPLETED`, `ABANDONED`)
- `startedAt`
- `endedAt`

#### `AssistantMessage`
- `id`
- `sessionId`
- `role` (`USER`, `ASSISTANT`, `SYSTEM`)
- `content`
- `inputMode` (`TEXT`, `VOICE`)
- `createdAt`

#### `AssistantActionRun`
- `id`
- `sessionId`
- `companyId`
- `userId`
- `intentType`
- `targetModule`
- `targetAction`
- `confidenceScore` (optional/internal)
- `requiresConfirmation`
- `status` (`PENDING`, `WAITING_CLARIFICATION`, `WAITING_CONFIRMATION`, `RUNNING`, `SUCCESS`, `PARTIAL_SUCCESS`, `FAILED`, `BLOCKED`)
- `requestPayloadJson`
- `resultPayloadJson`
- `groundingStatus` (`VERIFIED`, `PARTIAL`, `NOT_FOUND`, nullable)
- `createdAt`
- `updatedAt`

#### `AssistantActionLog`
- `id`
- `actionRunId`
- `eventType`
- `eventDataJson`
- `createdAt`

### 15.2 Data Principles
- All records must include `companyId` where relevant for isolation.
- Logs should avoid storing unnecessary sensitive content.
- Context payloads should be structured and minimal.

---

## 16. Integration Points

### 16.1 Existing Nousio Modules
1. **Marketing Assistant**
   - Generate structured marketing outputs.
   - Reuse existing generation route and RAG context.
   - Sources: **solution_overview.md**, **ai_brain_system.md**, **features_documentation.md**.

2. **Sales Assistant**
   - Generate sales outputs such as outreach drafts.
   - Likely route through existing sales generation service.

3. **Product Assistant**
   - Generate PRDs, product outputs, execution-ready artifacts.

4. **Lead Discovery**
   - Execute lead discovery workflows and propose outreach next steps.

5. **Company Advisor / Chat / Knowledge Retrieval**
   - Answer grounded company questions using RAG.

6. **Tasks / Execution Workspace**
   - Create tasks/checklists from outputs.
   - Source: **features_documentation.md**.

### 16.2 Shared Platform Services
1. **AI Brain resolution**
   - Use company-wide and role-specific brain behavior where relevant. Source: **ai_brain_system.md**.
2. **RAG retrieval utility**
   - Reuse shared retrieval pipeline for grounded outputs. Source: **features_documentation.md**.
3. **Auth/RBAC layer**
   - Permission checks before action execution.
4. **Speech-to-text UI patterns**
   - Reuse `SmartInput` behavior where practical. Source: **features_documentation.md**.

### 16.3 Technical Architecture Recommendation
Introduce an orchestration service layer between UI and existing module endpoints:
- Assistant UI
- Intent parser / router
- Clarification + confirmation state manager
- Module adapters
- Audit logger

This is preferable to embedding orchestration logic separately inside each assistant.

---

## 17. UX / Interaction Requirements

Aligned with **Cross-Application UXUI Principles System.md**:

1. **One primary action per step** during clarification and confirmation.
2. **Direct and professional tone**; no gimmicky assistant personality.
3. **Action-oriented outputs** with clear next steps.
4. **Progressive reveal** during generation/execution.
5. **Stable layout** while results stream or update.
6. **Multi-signal communication** for trust states, especially grounding and errors.
7. **No generic chatbot drift**; assistant should stay task-oriented.

---

## 18. MVP vs Later Phases

### MVP
- Global launcher
- User-defined assistant name
- Text + voice input
- Route/page context awareness
- Supported action routing to existing modules
- Clarification flow
- Confirmation flow
- Result deep-link/handoff
- Grounding indicators
- Logging and RBAC enforcement

### Phase 2
- Saved commands/macros
- Personalized defaults/preferences
- Proactive suggestions
- Richer action history
- Background jobs + notifications
- More advanced planning across multiple objects/workflows

### Phase 3
- Extensible action plugin framework
- Cross-system integrations
- Team delegation/approval chains
- Voice output and richer multimodal interaction

---

## 19. Risks and Product Considerations

1. **Over-promising autonomy**
   - Risk: users assume the assistant can do more than integrated modules support.
   - Recommendation: clearly present supported actions.

2. **Routing complexity**
   - Risk: ambiguous requests reduce trust.
   - Recommendation: explicit clarification and confidence-aware confirmation.

3. **Permission confusion**
   - Risk: users ask for actions they cannot perform.
   - Recommendation: explain permission boundary and suggest alternatives.

4. **Context misuse**
   - Risk: assistant over-relies on current page and performs wrong action.
   - Recommendation: explicit intent overrides context; confirm when uncertain.

5. **Fragmented implementation**
   - Risk: each module implements orchestration differently.
   - Recommendation: central orchestration layer with module adapters.

---

## 20. Open Questions Requiring Product Validation

1. Which exact cross-module actions are committed for MVP?
2. Are update/edit/delete actions in scope, or create/generate/navigate only?
3. Should assistant sessions be visible as saved history to users?
4. What is the preferred UI container: modal, side panel, bottom sheet, or command palette hybrid?
5. Should the assistant use a dedicated brain type (e.g. `ACTION_ASSISTANT`) or dynamically delegate to role brains only?
6. What confirmation policy should be standardized by action category?
7. Should the assistant always show its chosen interpretation before execution, or only when confidence is below threshold?

---

## 21. Recommended Implementation Approach

### Product Recommendation
Build this as a **cross-platform orchestration assistant**, not as a replacement for existing assistants. The assistant should be the universal action entry layer, while specialized assistants remain the execution engines for their domains.

### Technical Recommendation
Create a central orchestration service with:
1. intent classification,
2. context packaging,
3. clarification state handling,
4. confirmation state handling,
5. module adapters,
6. audit logging,
7. RBAC checks.

This approach is consistent with Nousio’s architecture, preserves reuse of existing routes and brain profiles, and minimizes duplication.

---

## 22. Summary
This feature is a strong strategic fit for Nousio. It extends the platform from a set of specialized AI workspaces into a more cohesive operational AI environment where users can express intent directly and let the system coordinate execution.

The MVP should focus on reliable orchestration, strong clarification/confirmation behavior, strict RBAC and tenant isolation, and clean handoff into existing modules. The success of the feature will depend less on novelty and more on disciplined scope, transparent trust signals, and robust routing into the capabilities Nousio already has.

If useful, I can next turn this into one of the following:
1. a PRD,
2. user stories with acceptance tests,
3. a UX flow/spec,
4. an API and system design spec,
5. a phased implementation backlog.