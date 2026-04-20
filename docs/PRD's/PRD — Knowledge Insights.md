# Product Requirements Document (PRD)
## Feature: Knowledge Insights

## 1. Executive Summary

Knowledge Insights is a proactive intelligence feature within Nousio that continuously identifies and surfaces the **top five highest-priority improvement opportunities** for a company. Rather than behaving like a passive reporting module, it should function more like an AI-powered internal operator: reviewing available company knowledge, AI interaction patterns, knowledge gaps, growth signals, and workspace context to recommend the next best actions.

The feature will support decision-makers such as founders, product teams, and marketers by presenting a ranked set of actionable insights across six contexts:

1. Company
2. Product
3. Project
4. Internal documentation
5. Product documentation
6. Marketing

Each surfaced insight must be:
- actionable,
- inspectable in detail,
- grounded where possible in company knowledge,
- easy to dismiss if not relevant,
- easy to convert into a task for a company-level backlog or a specific project.

This feature aligns strongly with Nousio’s core positioning as the **intelligence layer of the company** and extends existing capabilities around RAG-grounded AI, knowledge gap detection, specialized assistants, and operational intelligence. It also supports the product philosophy of **structured AI adoption**, **practicality**, and **control**. Confirmed product context from *nousio_positioning.md* and *solution_overview.md* indicates that Nousio is intended to centralize company knowledge, generate operational insights, identify knowledge gaps, and support growth activities through specialized assistants.

The MVP should focus on:
- generating a prioritized top-five insight list,
- categorizing insights by context,
- providing inspectable detail views,
- allowing dismissal,
- allowing one-click conversion into tasks.

Later phases can expand toward personalization, automatic cadence tuning, richer cross-workspace signals, confidence scoring, and workflow automation.

---

## 2. Problem Statement

### Current Problem
The existing Knowledge Insights capability is not proactive enough. It does not reliably surface the most important opportunities for improvement and growth across the business. As a result:
- users must manually infer priorities from fragmented signals,
- important business and knowledge issues may remain hidden,
- growth and operational improvements are not consistently translated into action,
- Nousio underdelivers on its promise to act as the organization’s intelligence layer.

### Why This Matters
Nousio is positioned as a structured AI workspace that helps organizations move from experimentation to operational adoption. According to *nousio_positioning.md*, the platform is meant to support:
- knowledge access,
- decision-making,
- learning,
- automation,
- growth.

If insights are passive, sporadic, or low-priority, the platform becomes a repository and assistant layer rather than an operational intelligence system. That weakens differentiation.

### User Problem
Decision-makers need a concise, trusted, and continuously updated view of:
- what matters most right now,
- why it matters,
- what evidence supports it,
- what should happen next.

They do not need another dashboard full of equal-weight observations. This is directly consistent with the UX principles in *Cross-Application UX/UI Principles System.md*, which emphasize:
- one dominant focus per screen,
- action before analysis,
- signal over noise,
- contextual intelligence,
- actionable output.

### Business Problem
Without a strong proactive insight layer:
- task creation remains reactive,
- AI outputs may feel generic rather than operational,
- users may fail to see ongoing strategic value from uploaded knowledge,
- Nousio’s value proposition for growth, operational intelligence, and structured adoption is weakened.

---

## 3. Goals

### Primary Goal
Enable Nousio to continuously surface the **top five highest-priority improvement opportunities** for each company, with enough context and trust signals for users to make fast decisions and convert useful insights into action.

### Secondary Goals
1. Increase perceived proactivity of Nousio.
2. Turn passive knowledge and AI interaction data into operational recommendations.
3. Reduce the effort required for leaders to identify the next best actions.
4. Improve the conversion of insights into trackable tasks.
5. Strengthen trust by grounding insights in company context and clearly indicating certainty.
6. Create a reusable intelligence layer that can support future automation and workflow orchestration.

### Business Goals
1. Reinforce Nousio’s positioning as an AI workspace and operational intelligence layer.
2. Increase usage frequency among decision-makers.
3. Increase cross-workspace value from uploaded documents and assistant interactions.
4. Improve retention by making the platform continuously useful, not only query-driven.

---

## 4. Non-Goals

The following are explicitly out of scope for MVP:

1. Fully autonomous task execution by AI.
2. Automatic project planning or roadmap generation without user confirmation.
3. Guaranteed correctness of strategic recommendations without human review.
4. Replacing specialized assistants such as Marketing Assistant, Sales Assistant, or Product Assistant.
5. Full analytics dashboarding across every signal source.
6. External web crawling or competitor intelligence unless separately validated.
7. Complex workflow automation chains after task creation.
8. Financial forecasting, legal recommendations, or compliance conclusions.

---

## 5. Confirmed Facts vs Assumptions

## 5.1 Confirmed Facts
Based on the provided company knowledge base:

1. Nousio is a multi-tenant platform with strict `companyId`-level isolation. Confirmed in *solution_overview.md*.
2. AI outputs are grounded using RAG and include grounding statuses: `VERIFIED`, `PARTIAL`, `NOT_FOUND`. Confirmed in *solution_overview.md* and *features_documentation.md*.
3. Nousio already detects knowledge gaps from failed queries and clusters them for admin review. Confirmed in *solution_overview.md* and *features_documentation.md*.
4. The platform includes specialized assistants for Company Advisor, Onboarding, Marketing, Sales, Product, and Lead Discovery. Confirmed in *solution_overview.md* and *nousio_positioning.md*.
5. The UX philosophy prioritizes clarity, one dominant action, signal over noise, and actionable AI output. Confirmed in *Cross-Application UX/UI Principles System.md*.
6. Role-based access control exists with `MEMBER`, `ADMIN`, and `SUPER_ADMIN`. Confirmed in *solution_overview.md*.

## 5.2 Assumptions
These should be validated with the product owner and engineering lead:

1. A task system already exists or is planned, with entities for company-level tasks and project-level tasks.
2. Projects are a first-class concept in the product data model or can be introduced without major architecture changes.
3. Knowledge Insights currently exists in some form but lacks proactive ranking and actionability.
4. Insight generation can use existing signals such as document metadata, chat logs, grounding outcomes, and knowledge gaps.
5. Users will accept a mixed-trust model where some insights are strongly grounded and others are heuristic or inferred, provided this is clearly labeled.
6. Continuous identification does not necessarily mean real-time streaming; it may mean periodic recomputation plus event-triggered refresh.

---

## 6. Target Users / Personas

## 6.1 Primary Personas

### A. Founder / Executive Decision-Maker
**Needs:**
- a concise list of the most important improvement opportunities,
- visibility into company-level risks and growth opportunities,
- the ability to quickly convert an insight into action.

**Pain points:**
- fragmented information,
- too many low-value observations,
- lack of confidence in what should be prioritized next.

### B. Product Lead / Product Team Member
**Needs:**
- product and documentation-related insights,
- clear rationale tied to user behavior, product information, or missing knowledge,
- a fast path to convert insights into project tasks.

**Pain points:**
- product issues buried inside support, docs, or scattered internal notes,
- difficulty distinguishing urgent improvements from nice-to-haves.

### C. Marketer / Growth Lead
**Needs:**
- actionable insights about messaging, content gaps, campaign opportunities, and product-to-market alignment,
- recommendations that are grounded in internal product and company context.

**Pain points:**
- generic AI outputs,
- lack of prioritization,
- missed opportunities due to disconnected knowledge.

## 6.2 Secondary Personas
- Operations leaders
- Sales leads
- Knowledge managers
- Project managers

## 6.3 User Jobs To Be Done
1. “Show me the most important improvements we should make next.”
2. “Explain why this insight matters and what evidence supports it.”
3. “Let me decide whether to ignore this, revisit it later, or turn it into action now.”
4. “Help me route the insight to the correct execution context.”

---

## 7. Business Requirements

1. The system must continuously maintain a ranked list of the top five company-specific improvement opportunities.
2. Insights must span multiple operational contexts: company, product, project, internal documentation, product documentation, and marketing.
3. Insights must support decision-making, not just observation.
4. Each insight must be inspectable in a dedicated detail view.
5. Users must be able to dismiss an insight.
6. Users must be able to convert an insight into a task with one click.
7. Converted tasks must be assignable either to:
   - company-level scope, or
   - a selected project.
8. The system must preserve trust by indicating evidence, confidence, and grounding status where applicable.
9. The feature must respect RBAC and company-level isolation.
10. The feature must align with Nousio’s product positioning as a structured AI workspace and intelligence layer.

### Mapping to Business Value
| Requirement | User Need | Business Need |
|---|---|---|
| Top five ranked insights | Focus on what matters most | Increases perceived strategic value |
| Multi-context coverage | Broad operational usefulness | Expands platform relevance across teams |
| Detail inspection | Trust and understanding | Reduces AI skepticism |
| Dismiss insight | Control and relevance | Prevents noise accumulation |
| Convert to task | Actionability | Drives workflow adoption |
| Grounding and evidence | Trust | Reinforces differentiated RAG value |

---

## 8. Functional Requirements

## 8.1 Insight Generation
1. The system shall generate candidate insights from company-specific signals.
2. The system shall prioritize candidate insights and retain the top five active insights.
3. The system shall classify each insight into one primary context:
   - Company
   - Product
   - Project
   - Internal Documentation
   - Product Documentation
   - Marketing
4. The system shall support periodic refresh and event-triggered refresh.
5. The system shall avoid repeatedly surfacing near-duplicate insights.

## 8.2 Insight Content Model
Each insight shall include:
1. Title
2. Short summary
3. Primary context/category
4. Why this matters
5. Recommended action
6. Supporting evidence
7. Source references where available
8. Grounding status (`VERIFIED`, `PARTIAL`, `NOT_FOUND` or equivalent mapped trust label)
9. Priority rank
10. Confidence/explanation note
11. Created timestamp
12. Last refreshed timestamp
13. Status:
   - Active
   - Dismissed
   - Converted to task

## 8.3 Insight Detail View
1. Users shall be able to open an insight detail panel or page.
2. The detail view shall show:
   - the full rationale,
   - supporting signals,
   - relevant documents or interactions,
   - recommended next steps,
   - trust/grounding indicators.
3. The detail view shall clearly separate:
   - observed evidence,
   - AI interpretation,
   - recommended action.

This separation is required by the UX guidance in *Cross-Application UX/UI Principles System.md*.

## 8.4 Dismissal Workflow
1. Users shall be able to dismiss an insight.
2. Dismissed insights shall be removed from the active top-five list.
3. The system should optionally capture a dismissal reason in MVP only if low-friction; otherwise defer to Phase 2.
4. Dismissal shall prevent immediate resurfacing of the same insight unless materially changed.

## 8.5 Convert to Task Workflow
1. Users shall be able to convert an insight into a task in one primary flow.
2. On conversion, the user shall choose either:
   - Company task
   - Project task
3. If Project task is selected, the user shall select the target project.
4. The created task should be prefilled with:
   - task title,
   - description,
   - rationale,
   - linked insight reference,
   - source evidence links if available.
5. Converted insights shall be marked as “Converted to task.”

## 8.6 Ranking and Prioritization Logic
The system shall rank insights using a composite prioritization model. MVP should consider available signals such as:
1. frequency of repeated issues or questions,
2. knowledge gaps (`NOT_FOUND` / `PARTIAL` patterns),
3. importance of affected context,
4. evidence quality and grounding level,
5. recency,
6. cross-source corroboration,
7. expected actionability.

## 8.7 Administrative / Configuration Controls
For MVP, configuration may be minimal. However, the system should support future controls for:
- refresh cadence,
- context weighting,
- project mapping,
- suppression rules,
- confidence thresholds.

---

## 9. Proposed Insight Signal Sources

This section includes inferred design recommendations based on existing platform capabilities and should be validated.

### 9.1 Confirmed Available Signals
From company documents and product knowledge:
1. Uploaded documents and metadata
2. Curated knowledge source flags
3. Knowledge priority metadata
4. Chat interactions
5. Grounding outcomes (`VERIFIED`, `PARTIAL`, `NOT_FOUND`)
6. Knowledge gap clusters
7. Assistant-specific usage contexts

### 9.2 Recommended Candidate Signal Types
1. **Knowledge gap patterns**
   - repeated unanswered questions,
   - repeated partial answers,
   - clustered missing topics.
2. **Documentation quality signals**
   - critical documents missing curation,
   - product docs with frequent retrieval but low grounding confidence,
   - stale documents relevant to common questions.
3. **Product clarity signals**
   - repeated confusion around product features, onboarding, pricing structures, or workflows.
4. **Marketing opportunity signals**
   - recurring questions that could become marketing content,
   - product features with strong internal documentation but low external messaging coverage.
5. **Project execution signals**
   - recurring issues linked to a project or repeated project-related queries.
6. **Company operations signals**
   - repeated company/process questions indicating missing internal process clarity.

---

## 10. Non-Functional Requirements

## 10.1 Security and Data Isolation
1. All insight generation, storage, retrieval, and actions must remain isolated by `companyId`.
2. No cross-tenant signal contamination is permitted.
3. Access must respect RBAC.
4. Evidence shown to users must only include content they are authorized to access.

These are strongly grounded in *solution_overview.md*.

## 10.2 Performance
1. The top-five insight view should load quickly enough for routine dashboard use.
2. Insight generation should not block the main user workflow.
3. Refresh jobs should run asynchronously.
4. Detail views should progressively load supporting evidence when needed.

## 10.3 Reliability
1. The system should continue functioning even if some signal sources are temporarily unavailable.
2. Partial signal degradation should reduce confidence, not break the feature.
3. Insight generation should be idempotent enough to avoid duplicate spam.

## 10.4 Explainability and Trust
1. Every surfaced insight must provide a rationale.
2. Grounding status must be visible where applicable.
3. The UI must not present speculative outputs as verified facts.
4. Evidence and recommendation must be clearly distinguished.

## 10.5 Usability
1. The feature must present one dominant action: review and act on the top insight list.
2. The UI should avoid equal-weight dashboards.
3. The path from insight to task should be frictionless.

These align directly with *Cross-Application UX/UI Principles System.md*.

---

## 11. Technical Considerations

## 11.1 Architectural Fit
Knowledge Insights should be implemented as an intelligence layer on top of existing Nousio primitives:
- multi-tenant company data model,
- RAG retrieval pipeline,
- grounding evaluation,
- knowledge gap detection,
- assistant interaction logs,
- specialized workspaces.

### Recommended High-Level Flow
1. Collect candidate signals from documents, chats, knowledge gaps, and metadata.
2. Normalize them into candidate opportunity records.
3. Cluster or deduplicate related opportunities.
4. Score opportunities using prioritization logic.
5. Persist ranked insights for each company.
6. Expose active top-five insights through API.
7. Allow state transitions: active → dismissed / converted.

## 11.2 Suggested Data Model Additions
The following entities are inferred and should be validated:

### `KnowledgeInsight`
- `id`
- `companyId`
- `title`
- `summary`
- `contextType`
- `priorityScore`
- `rank`
- `groundingStatus`
- `confidenceLabel`
- `whyItMatters`
- `recommendedAction`
- `evidenceJson`
- `sourceRefsJson`
- `status`
- `dedupeKey`
- `createdAt`
- `updatedAt`
- `lastEvaluatedAt`

### `KnowledgeInsightAction`
- `id`
- `insightId`
- `companyId`
- `userId`
- `actionType` (`DISMISS`, `CONVERT_TO_TASK`)
- `targetType` (`COMPANY`, `PROJECT`)
- `targetId`
- `createdAt`

## 11.3 Generation Strategy
### MVP Recommendation
Use batch generation with optional event-triggered refresh.

**Why:**
- more predictable operational cost,
- easier ranking consistency,
- simpler to debug,
- sufficient for a “continuously updated” experience if run on schedule and after major signal events.

### Candidate Triggers
- new document uploaded,
- document metadata changed,
- new knowledge gap cluster formed,
- repeated `NOT_FOUND` increase in a topic,
- significant assistant interaction volume,
- manual refresh by admin/user.

## 11.4 Grounding Strategy
Not every insight will be purely document-grounded. Therefore the feature should support:
1. `VERIFIED` — strong evidence from company documents or repeated corroborated internal signals.
2. `PARTIAL` — some evidence exists but recommendation includes interpretation.
3. `NOT_FOUND` or `INFERRED` equivalent — weak documentary grounding, but signal-based opportunity detected.

Important clarification: the existing platform uses `VERIFIED`, `PARTIAL`, and `NOT_FOUND` for answer grounding. Reusing these labels for insights may be useful, but product/design should validate whether an insight-specific trust vocabulary is clearer.

## 11.5 API Considerations
Suggested endpoints:
- `GET /api/knowledge-insights`
- `GET /api/knowledge-insights/[id]`
- `POST /api/knowledge-insights/refresh`
- `POST /api/knowledge-insights/[id]/dismiss`
- `POST /api/knowledge-insights/[id]/convert-to-task`

These are proposed APIs, not confirmed existing ones.

---

## 12. UX / Workflow

## 12.1 UX Principles
The feature should follow confirmed UX doctrine from *Cross-Application UX/UI Principles System.md*:
- one dominant focus,
- action before analysis,
- progressive disclosure,
- signal over noise,
- direct and professional language,
- clear next steps.

## 12.2 Primary Screen
### Knowledge Insights Home
Primary structure:
1. Header: “Top 5 opportunities to improve now”
2. Ranked list of five active insights
3. Each card shows:
   - rank,
   - title,
   - context badge,
   - one-line summary,
   - trust/grounding badge,
   - primary action: View details,
   - secondary actions: Dismiss / Convert to task

### Rationale
This avoids a noisy dashboard and preserves a single dominant user action: review and act.

## 12.3 Insight Detail Experience
Each detail view should include sections in this order:
1. Recommended action
2. Why this matters
3. Evidence
4. Related sources/interactions
5. Suggested task destination

This ordering follows the “action before analysis” principle.

## 12.4 Convert to Task Flow
1. User clicks “Convert to task”
2. Lightweight modal opens
3. User selects:
   - Company
   - Project
4. If project selected, choose project
5. User confirms
6. Task is created and insight state updates

## 12.5 Dismiss Flow
1. User clicks “Dismiss”
2. Optional confirmation if needed
3. Insight disappears from active list
4. Next-ranked insight fills the top-five list

## 12.6 Empty / Low-Signal States
If the system lacks enough evidence:
- show fewer than five insights rather than inventing weak ones,
- explain that more knowledge or interactions are needed,
- suggest useful actions such as uploading documentation or using assistants.

This is critical to avoid hallucinated prioritization.

---

## 13. Dependencies

## 13.1 Product Dependencies
1. Existing document ingestion and retrieval pipeline
2. Knowledge gap detection system
3. Assistant interaction logs
4. Task management capability or task creation integration
5. Project entity/model if project-level task routing is required

## 13.2 Technical Dependencies
1. Background job infrastructure for scheduled insight refresh
2. Storage for persisted insight records and actions
3. Retrieval/evidence linking from documents and chat logs
4. RBAC enforcement layer

## 13.3 Design Dependencies
1. Final trust/grounding badge design for insight cards
2. Final information hierarchy for detail views
3. Modal or drawer pattern for task conversion

---

## 14. Risks, Assumptions, and Unknowns

## 14.1 Key Risks
1. **Insight quality risk**: low-quality prioritization may reduce trust.
2. **Overproduction risk**: too many similar insights may create noise.
3. **Grounding ambiguity risk**: users may misinterpret inferred recommendations as verified facts.
4. **Task integration risk**: if task creation is weak or inconsistent, actionability suffers.
5. **Signal sparsity risk**: smaller companies may not generate enough signals for reliable top-five ranking.

## 14.2 Assumptions
1. There is enough company-specific signal to generate meaningful opportunities.
2. Users prefer concise top recommendations over broad analytics views.
3. Task conversion is a core value path.
4. Product/project scoping can be represented consistently in the data model.

## 14.3 Unknowns / Clarifications Needed
1. What exact data sources should be in scope for MVP insight generation?
2. Does a project object already exist in the platform?
3. Does the system already include a task model, or must one be introduced?
4. How often should “continuous” refresh occur in practice?
5. Should dismissed insights reappear after a cooldown if supporting evidence materially changes?
6. Should users see only company-wide insights or also role/persona-specific insights later?
7. Should insight generation be available to all members or only admins/decision-makers?

These require product owner validation.

---

## 15. MVP Scope

## 15.1 In Scope
1. Generate and persist top five company insights
2. Support six insight contexts:
   - company
   - product
   - project
   - internal documentation
   - product documentation
   - marketing
3. Ranked insight list UI
4. Insight detail view
5. Dismiss action
6. Convert-to-task action
7. Company/project task routing
8. Evidence and trust indicators
9. Scheduled refresh plus manual refresh
10. Deduplication and suppression of recently dismissed identical insights

## 15.2 Out of Scope for MVP
1. Personalized insight feeds by user role
2. Automated task assignment
3. Insight feedback loops beyond dismiss/convert
4. Advanced analytics and trend charts
5. External data enrichment
6. Multi-step workflow automation
7. Fully configurable scoring rules in UI

---

## 16. Phase 2 / Later

1. **Personalized insight streams** by role, team, or workspace
2. **Feedback learning** from dismissals and conversions
3. **Insight trend history** to show recurring or worsening issues
4. **Auto-linking to assistants** for deeper exploration
5. **Suggested owners and deadlines** during task conversion
6. **Admin configuration** for weighting, thresholds, and suppression rules
7. **Cross-workspace orchestration** where an insight can trigger a marketing draft, product brief, or documentation request
8. **Project-aware clustering** with stronger project routing logic
9. **Confidence calibration** using historical action outcomes
10. **Notifications / digests** for newly emerged top-priority insights

---

## 17. Success Metrics

Because no validated baseline metrics were provided, the following are recommended measurement categories rather than committed targets.

## 17.1 Adoption Metrics
1. Number of companies viewing Knowledge Insights
2. Frequency of insight review sessions
3. Percentage of active users opening insight details

## 17.2 Action Metrics
1. Insight-to-task conversion rate
2. Insight dismissal rate
3. Time from insight surfacing to action

## 17.3 Quality Metrics
1. Percentage of surfaced insights with supporting evidence
2. Distribution of grounding statuses
3. Duplicate/near-duplicate insight rate
4. User feedback on relevance or usefulness if feedback is later introduced

## 17.4 Business Outcome Proxies
1. Increased usage of related workspaces after insight review
2. Increased documentation uploads or curation after documentation-related insights
3. Increased task creation linked to AI-generated opportunities

---

## 18. Recommended Delivery Approach

## Phase A — Product/Architecture Validation
1. Confirm task and project model availability
2. Validate signal sources for MVP
3. Define ranking heuristics and trust vocabulary
4. Align UX on top-five list and detail hierarchy

## Phase B — MVP Build
1. Implement insight data model
2. Build batch generation pipeline
3. Implement ranking, deduplication, and persistence
4. Build list and detail UI
5. Implement dismiss and convert-to-task flows
6. Add manual refresh and scheduled jobs

## Phase C — Quality Hardening
1. Evaluate low-signal edge cases
2. Tune prioritization heuristics
3. Add suppression rules for repeated low-value insights
4. Review trust language and evidence rendering

---

## 19. Final Recommendation

Knowledge Insights should be treated not as a reporting widget but as a **core operational intelligence surface** for Nousio. The strongest MVP is not the broadest one; it is the one that reliably answers a single high-value question:

**What are the five most important things this company should improve next, and what should we do about them?**

If the product delivers that clearly, with grounded evidence and frictionless task conversion, it will materially strengthen Nousio’s positioning as the company’s intelligence layer.

---

## 20. Open Questions for Product Owner Sign-Off

1. What exact sources are approved for MVP insight generation?
2. Is there an existing task model and project model to integrate with?
3. Who can see and act on insights by role?
4. What is the expected refresh cadence for “continuous” updates?
5. Should trust labels reuse `VERIFIED / PARTIAL / NOT_FOUND`, or should insights use a separate vocabulary?
6. Are company-level and project-level tasks the only valid destinations, or should product/marketing workspaces also be direct targets later?
7. Should the top five be global per company, or can each context retain a fallback queue behind the visible top five?

These decisions should be validated before implementation begins.