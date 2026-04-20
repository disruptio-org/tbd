# PRD — Integrated CRM System for Nousio

> **Type:** PRD  
> **Generated:** March 24, 2026  
> **Workspace:** Nousio  
> **Powered by:** Nousio Product Assistant

---

# Product Requirements Document (PRD)

## 1. Executive Summary

Nousio should introduce an **Integrated CRM System** that allows companies to capture leads from external systems, manage them inside a configurable pipeline, and track lifecycle progression from initial lead through proposal and customer stages.

This feature extends Nousio’s existing growth-support capabilities—particularly **Lead Discovery**, **Sales Assistant**, and **Marketing Assistant**—into a more operational system of record for commercial activity. Today, Nousio can help discover leads and generate sales/marketing outputs grounded in company knowledge, but the available product information does not confirm a native CRM workflow for managing lead status, ownership, activity progression, and integration with external lead sources. This creates a gap between AI-assisted lead generation and day-to-day sales execution.

The proposed CRM system should provide:

1. **Lead ingestion from external systems** via API and connectors.
2. **A table-based CRM workspace** for viewing, filtering, editing, and organizing leads.
3. **A configurable lifecycle pipeline** spanning lead, qualified opportunity, proposal, and customer stages.
4. **Lead detail records** with company/contact information, source metadata, notes, status, and ownership.
5. **Workflow alignment with Nousio AI assistants** so sales and marketing users can act on CRM records directly.
6. **External API support** so third-party systems can create, update, and synchronize leads.

From a strategic perspective, this feature is highly aligned with Nousio’s positioning as **“the intelligence layer of the company”** and its growth-support mission. It transforms Nousio from an AI-assisted lead and content platform into a more complete revenue workflow environment, while remaining consistent with the product philosophy of **simplicity, practicality, structured adoption, and control**. This direction is grounded in the product positioning and solution architecture described in **`nousio_positioning.md`** and **`solution_overview.md`**.

---

## 2. Problem Statement

### Confirmed Current State
Based on the available company knowledge:

- Nousio already supports **AI Lead Discovery** with lead search, relevance scoring, lead lists, and stored lead results, as documented in **`features_documentation.md`**.
- Nousio also supports **AI Sales Assistant** workflows that can optionally generate content from a `LeadResult`, also documented in **`features_documentation.md`**.
- Nousio is built as a **multi-tenant, RAG-grounded AI workspace** with strict `companyId` isolation, as confirmed in **`solution_overview.md`**.

### Product Gap
What is not confirmed in the current product documentation is a native CRM capability for:

- ingesting leads from outside Nousio,
- maintaining a persistent commercial record beyond AI search results,
- managing stage progression in a configurable sales pipeline,
- assigning ownership,
- tracking conversion status over time,
- exposing lead/contact data through an integration-ready API.

### User Problem
Sales and marketing teams need more than lead generation. They need a structured operational workspace to:

- centralize leads from multiple sources,
- avoid losing leads between discovery and execution,
- track where each lead sits in the funnel,
- coordinate outreach and follow-up,
- maintain a clean customer/prospect record,
- give leadership visibility into pipeline progression.

Without a native CRM layer, users must likely rely on external spreadsheets or third-party CRMs, which creates:

- fragmented workflows,
- duplicated data entry,
- weaker alignment between AI outputs and sales execution,
- reduced visibility into conversion performance,
- lower product stickiness for growth teams.

### Business Problem
For Nousio, the absence of CRM functionality limits the platform’s ability to become the operational environment for growth workflows. It weakens continuity between:

1. discovering leads,
2. generating outreach,
3. managing pipeline,
4. progressing opportunities,
5. converting customers.

A CRM module would strengthen Nousio’s position at the intersection of **AI workspaces, operational intelligence systems, and growth support tools** as described in **`nousio_positioning.md`**.

---

## 3. Goals

### 3.1 Product Goals

1. Enable companies to manage leads natively inside Nousio.
2. Provide a configurable but simple lead lifecycle workflow.
3. Centralize lead data from both internal and external sources.
4. Connect lead records to Nousio’s AI-driven sales and marketing workflows.
5. Create a reliable system of record for early-stage commercial pipeline management.

### 3.2 Business Goals

1. Increase the operational usefulness of Nousio for sales and marketing teams.
2. Improve retention and platform stickiness by embedding execution workflows.
3. Strengthen Nousio’s growth-support positioning with a more complete revenue workflow.
4. Create a foundation for future sales intelligence, automation, and reporting features.

### 3.3 User Goals

1. View all leads in one place.
2. Import or sync leads from external systems.
3. Update status quickly in a structured CRM workflow.
4. Track ownership, source, stage, and next steps.
5. Use AI to generate actions directly from CRM records.
6. Identify which leads are progressing, stalled, or converted.

---

## 4. Non-Goals

The following items should be considered out of scope for MVP unless explicitly prioritized later:

1. Full enterprise CRM parity with platforms such as Salesforce or HubSpot.
2. Advanced deal forecasting or revenue prediction.
3. Complex quote generation, invoicing, or contract lifecycle management.
4. Full customer support or account management suite.
5. Deep marketing automation orchestration.
6. Telephony, call recording, or native meeting scheduling.
7. Highly complex workflow engines with conditional branching across dozens of states.
8. Legal/compliance decisioning beyond standard access control, auditability, and data isolation.

---

## 5. Target Users / Personas

## 5.1 Primary Personas

### A. Sales Representative / Account Executive
**Needs**
- A clear list of active leads and opportunities.
- Fast status updates and ownership tracking.
- Access to contact and company details.
- Ability to generate outreach from the lead record.

**Pain Points**
- Leads scattered across tools.
- Manual copy-paste between lead sources and sales content tools.
- No clear progression tracking.

### B. Marketing Manager / Growth Marketer
**Needs**
- Visibility into lead sources and quality.
- Ability to pass marketing-generated leads into a sales workflow.
- Segmentation and filtering of leads.
- Alignment between campaigns and pipeline outcomes.

**Pain Points**
- Weak handoff from campaign lead capture to sales follow-up.
- Inconsistent lead data quality.

## 5.2 Secondary Personas

### C. Sales Director / Head of Sales
**Needs**
- Pipeline visibility.
- Team ownership views.
- Stage distribution insight.
- Confidence that leads are being worked systematically.

### D. Operations Leader / Revenue Operations / Admin
**Needs**
- Configurable pipeline stages.
- Data governance and integration reliability.
- Administrative controls for fields, statuses, and sync rules.

### E. Founder / CEO / Executive
**Needs**
- Fast access to lead and customer pipeline information.
- Simple views of commercial progression.
- Confidence that the company is not losing opportunities.

---

## 6. Assumptions

Because the feature request is directionally clear but not fully specified, the following assumptions are being made.

### 6.1 Confirmed Facts

1. Nousio supports multi-tenant data isolation using `companyId` across all data domains, per **`solution_overview.md`**.
2. Nousio already has lead-related entities such as `LeadSearchRun` and `LeadResult`, per **`features_documentation.md`**.
3. Nousio supports RBAC roles `MEMBER`, `ADMIN`, `SUPER_ADMIN`, per **`solution_overview.md`** and **`features_documentation.md`**.
4. Nousio has specialized Growth workspaces for Sales and Marketing, per **`solution_overview.md`**.

### 6.2 Inferred Assumptions Requiring Validation

1. The CRM module should initially focus on **lead and early opportunity management**, not a full account/opportunity suite.
2. A **table-first interface** is preferred over a kanban-first interface because the request explicitly calls for a table-based CRM interface.
3. External integrations should begin with a **generic API-first architecture**, with native connectors added later.
4. Contacts may initially be modeled as a lightweight sub-object or related entity rather than a full standalone contact management suite.
5. Proposal/customer stages should be represented within the pipeline, even if downstream billing/customer success workflows remain out of scope.
6. Reporting should be basic in MVP and expanded later.

### 6.3 Clarifications Needed

1. Should the first release support only **lead records**, or also **accounts/companies**, **contacts**, and **opportunities** as separate entities?
2. Is the pipeline expected to be **globally configurable per company** or configurable by team/workspace?
3. Which external systems are highest priority for integration: forms, ad platforms, email tools, existing CRMs, or custom back-office systems?
4. Should activity logging include only manual notes in MVP, or also email/outreach events?
5. Is deduplication required in MVP, and if yes, what matching rules are acceptable?

---

## 7. Business Requirements

| ID | Requirement | User Need | Business Need | Priority |
|---|---|---|---|---|
| BR-01 | Capture leads from external systems | Centralized intake | Reduce fragmented workflows | Must |
| BR-02 | Store leads as persistent CRM records | Track lifecycle over time | Build system of record | Must |
| BR-03 | Support configurable pipeline stages | Adapt to company sales process | Fit SME variability | Must |
| BR-04 | Provide table-based lead management UI | Fast operational management | Usable daily workflow | Must |
| BR-05 | Support assignment and ownership | Accountability | Team coordination | Must |
| BR-06 | Track progression from lead to customer | Funnel visibility | Commercial insight | Must |
| BR-07 | Integrate with Sales/Marketing AI tools | Faster execution | Differentiate from basic CRM | Must |
| BR-08 | Expose secure external API | System interoperability | Platform extensibility | Must |
| BR-09 | Preserve company-level isolation and RBAC | Secure access | Trust/governance | Must |
| BR-10 | Maintain source attribution for leads | Understand origin and quality | Attribution and auditability | Should |
| BR-11 | Support basic filtering and search | Faster navigation | Operational efficiency | Must |
| BR-12 | Support conversion from Lead Discovery results into CRM | Continuity with existing product | Leverage current capabilities | Must |

---

## 8. Functional Requirements

## 8.1 Core Domain Model

### Proposed MVP Entities

1. **CRM Lead**
   - Core commercial record.
   - Represents a prospect from initial capture through conversion.

2. **Lead Contact**
   - Optional associated person record for a lead.
   - May be lightweight in MVP.

3. **Pipeline Stage**
   - Configurable stage definitions per company.

4. **Lead Activity**
   - Notes and lifecycle events.

5. **Integration Event / Sync Log**
   - Tracks inbound/outbound API operations and errors.

### Suggested MVP Lead Fields

- `id`
- `companyId`
- `ownerUserId`
- `createdByUserId`
- `sourceType` (manual, lead_discovery, api, import, form, other)
- `sourceReference`
- `leadName`
- `companyName`
- `website`
- `industry`
- `location`
- `status`
- `pipelineStageId`
- `lifecycleType` (lead, qualified, proposal, customer, lost)
- `email`
- `phone`
- `jobTitle`
- `notes`
- `tags`
- `lastActivityAt`
- `convertedAt`
- `archivedAt`
- `createdAt`
- `updatedAt`

This schema is inferred and should be validated by product and engineering.

## 8.2 Lead Capture and Ingestion

### FR-01 External API Lead Creation
The system must allow third-party systems to create lead records via authenticated API.

### FR-02 External API Lead Update
The system must allow authorized external systems to update existing leads.

### FR-03 Source Attribution
Each lead must store source metadata so users can understand where it came from.

### FR-04 Manual Creation
Users must be able to create a lead manually from the CRM UI.

### FR-05 Convert Lead Discovery Result to CRM Lead
Users must be able to create a CRM lead directly from an existing `LeadResult` in the Lead Discovery module.

### FR-06 Optional Bulk Import
If included in MVP, users should be able to import leads through CSV. If not, move to Phase 2.

## 8.3 Pipeline and Lifecycle Management

### FR-07 Configurable Pipeline
Admins must be able to define and reorder pipeline stages for their company.

### FR-08 Default Lifecycle Template
The system should provide a default stage template such as:
- New Lead
- Contacted
- Qualified
- Proposal
- Customer
- Lost

This is a suggested default, not a confirmed final taxonomy.

### FR-09 Stage Transition
Users must be able to move leads between stages from the table and detail views.

### FR-10 Conversion Tracking
The system must track when a lead reaches customer status.

### FR-11 Loss Tracking
The system should allow users to mark a lead as lost and optionally record a reason.

## 8.4 CRM Workspace UI

### FR-12 Table-Based Lead List
The CRM workspace must provide a table view showing leads with sortable columns.

### FR-13 Filtering and Search
Users must be able to filter by owner, stage, source, status, tags, and date ranges, subject to MVP prioritization.

### FR-14 Inline Editing
Users should be able to update selected fields directly in the table for fast workflow management.

### FR-15 Saved Views
Saved views are desirable but may be Phase 2 if MVP scope is constrained.

### FR-16 Lead Detail Panel/Page
Users must be able to open a lead detail view to inspect and edit full record details.

### FR-17 Activity Timeline
The lead detail view should display a timeline of major lifecycle events and notes.

## 8.5 Ownership and Collaboration

### FR-18 Lead Assignment
Users with appropriate permission must be able to assign a lead owner.

### FR-19 Notes
Users must be able to add manual notes to a lead.

### FR-20 Audit Visibility
The system should record key changes such as stage changes, owner changes, and integration updates.

## 8.6 AI Workflow Integration

### FR-21 Generate Sales Content from Lead Record
Users must be able to launch Sales Assistant actions from a CRM lead.

### FR-22 Generate Marketing Content from Segments or Lead Context
Users should be able to use CRM lead context to inform marketing outputs where relevant.

### FR-23 AI-Enriched Lead Context
The system may use Nousio’s existing context capabilities to summarize a lead or suggest outreach, but this should not block MVP if complexity is high.

## 8.7 API and Integration Requirements

### FR-24 Authenticated Company-Scoped API
All CRM API endpoints must enforce `companyId` scoping consistent with Nousio architecture from **`solution_overview.md`**.

### FR-25 Idempotency / Duplicate Protection
The API should support safe retries and duplicate handling where feasible.

### FR-26 Webhooks (Optional)
Outbound webhooks for lead status changes are valuable but may be Phase 2.

### FR-27 Sync Logging
Admins should be able to inspect failed or recent sync events.

---

## 9. Non-Functional Requirements

1. **Security**
   - Must preserve strict multi-tenant isolation by `companyId`, per **`solution_overview.md`**.
   - Must respect RBAC roles (`MEMBER`, `ADMIN`, `SUPER_ADMIN`).
   - API authentication and authorization must be enforced for all CRUD operations.

2. **Reliability**
   - Lead ingestion should be resilient to retries and partial failures.
   - Integration failures must be logged.

3. **Performance**
   - Table views should remain responsive under expected SME-scale lead volumes.
   - Filtering, sorting, and pagination should be optimized server-side where necessary.

4. **Usability**
   - The interface should follow Nousio’s product principles of clarity, decisiveness, and one primary action per screen where possible, based on project context and **`solution_overview.md`**.

5. **Auditability**
   - Key lifecycle changes should be traceable for operational review.

6. **Extensibility**
   - Data model and API design should support future expansion into contacts, accounts, opportunities, and automations.

---

## 10. Technical Considerations

## 10.1 Architectural Fit
This feature should align with the current Nousio platform architecture described in **`solution_overview.md`**:

- **Frontend**: Next.js App Router
- **Database**: PostgreSQL via Prisma
- **Auth**: Supabase Auth
- **Storage/Events**: Existing platform patterns where applicable

## 10.2 Multi-Tenant Isolation
All CRM records, activities, pipeline stages, API keys/tokens, and sync logs must be tied to `companyId`.

## 10.3 Suggested Data Model Direction
Potential tables/entities:
- `CrmLead`
- `CrmLeadContact`
- `CrmPipelineStage`
- `CrmLeadActivity`
- `CrmIntegrationConnection`
- `CrmSyncEvent`

These names are suggested design directions, not confirmed existing schema.

## 10.4 API Surface
Suggested API groups:
- `GET /api/crm/leads`
- `POST /api/crm/leads`
- `GET /api/crm/leads/:id`
- `PUT /api/crm/leads/:id`
- `POST /api/crm/leads/:id/activities`
- `GET /api/crm/pipeline`
- `PUT /api/crm/pipeline`
- `POST /api/crm/import/lead-discovery/:leadResultId`
- `POST /api/integrations/crm/leads`

Endpoint naming should be validated against current routing conventions.

## 10.5 Integration Strategy
Strong recommendation: adopt an **API-first approach** in MVP.

Reasoning:
- It is the fastest path to external interoperability.
- It reduces connector-specific complexity early.
- It fits Nousio’s structured, execution-oriented philosophy.
- It creates a stable foundation for later native integrations.

## 10.6 AI Integration Considerations
CRM records should be usable as structured context for the Sales Assistant and potentially the Marketing Assistant. However, CRM data should not be treated as documentary evidence in the same way as RAG-grounded company knowledge unless explicitly separated in prompt design.

This distinction matters because Nousio uses grounding statuses (**VERIFIED**, **PARTIAL**, **NOT FOUND**) for document-based outputs, per **`solution_overview.md`**. Product and engineering should define whether CRM-derived context appears as structured user data rather than verified knowledge evidence.

---

## 11. UX / Workflow

## 11.1 Primary User Flow: External Lead to Managed Pipeline

1. External system sends lead to Nousio via API.
2. Lead is created under the correct `companyId` with source metadata.
3. Lead appears in CRM table view under default stage “New Lead” (or company equivalent).
4. Sales user opens lead detail view.
5. User assigns owner, adds notes, updates stage.
6. User launches Sales Assistant to generate outreach from lead context.
7. Lead progresses to qualified/proposal/customer or lost.

## 11.2 Primary User Flow: Lead Discovery to CRM

1. User runs lead search in Lead Discovery.
2. User reviews `LeadResult` entries.
3. User selects a result and imports it into CRM.
4. CRM lead record is created with preserved source reference.
5. User manages it in the pipeline.

## 11.3 CRM Interface Recommendations

### Main CRM Page
- Table-first layout.
- Clear filters at top.
- Search bar.
- Primary CTA: “Add Lead”.
- Secondary actions: import from Lead Discovery, export, configure pipeline.

### Lead Table Columns
Recommended MVP columns:
- Lead / Company Name
- Contact
- Stage
- Owner
- Source
- Last Activity
- Created Date
- Status / Lifecycle

### Lead Detail View
Recommended sections:
- Header: name, stage, owner, quick actions
- Core info: company/contact details
- Source info
- Notes/activity timeline
- AI actions: generate outreach, summarize lead, create follow-up draft

### UX Principles
Should follow Nousio’s cross-product UX style:
- direct and professional
- clear and concise
- action-oriented
- minimal visual noise
- focused workflows

These principles are grounded in the project context and **`solution_overview.md`**.

---

## 12. Dependencies

### Product Dependencies
1. Existing Lead Discovery module.
2. Existing Sales Assistant module.
3. Existing RBAC model.
4. Existing company/user/auth architecture.

### Technical Dependencies
1. Database schema updates.
2. API authentication model for third-party integrations.
3. Admin UI for pipeline configuration.
4. Audit/event logging infrastructure.

### Organizational Dependencies
1. Product definition of lifecycle terminology.
2. Engineering decision on API auth mechanism.
3. UX design for table and detail workflows.

---

## 13. Risks, Assumptions, and Unknowns

## 13.1 Risks

1. **Scope creep into full CRM platform**
   - Risk: feature expands beyond lead management into a broad sales suite.
   - Mitigation: keep MVP focused on leads, stages, ownership, notes, and integrations.

2. **Integration complexity**
   - Risk: native connectors slow delivery.
   - Mitigation: prioritize generic API-first ingestion in MVP.

3. **Data duplication / poor data quality**
   - Risk: same lead enters multiple times from different sources.
   - Mitigation: define basic dedupe strategy or flag duplicates for review.

4. **Unclear object model**
   - Risk: tension between lead-centric and account/contact-centric models.
   - Mitigation: start with lead-first model and define extension path.

5. **Confusion between CRM data and verified knowledge**
   - Risk: users misinterpret AI outputs as document-grounded when based on CRM entries.
   - Mitigation: clearly separate CRM context from RAG verification model.

## 13.2 Unknowns

1. Required volume and scale expectations.
2. Most important external integration sources.
3. Whether two-way sync is required in MVP.
4. Whether contact records need standalone lifecycle management.
5. Whether executives need dashboard/reporting in first release.

## 13.3 Assumptions

1. MVP is for SME and growth-stage company workflows rather than enterprise complexity.
2. Simplicity and daily usability are more important than feature breadth.
3. CRM should reinforce Nousio’s growth workflows, not replace every external sales tool immediately.

---

## 14. MVP Scope

## 14.1 In Scope for MVP

1. CRM lead entity and persistent storage.
2. Table-based CRM list view.
3. Lead detail view.
4. Manual lead creation/editing.
5. Import from Lead Discovery into CRM.
6. Company-configurable pipeline stages.
7. Stage progression and lifecycle tracking.
8. Lead assignment and notes.
9. Search, filtering, sorting, pagination.
10. Authenticated external API for create/update lead.
11. Sync/event logging for basic integration observability.
12. Sales Assistant launch from CRM lead.

## 14.2 Out of Scope for MVP

1. Full account/contact/opportunity architecture.
2. Complex automations and workflow rules.
3. Native third-party connectors beyond API-first support.
4. Advanced reporting dashboards.
5. Webhooks, if delivery risk is high.
6. Email sync and communication tracking.
7. Revenue forecasting.
8. Multi-pipeline support unless clearly required.

---

## 15. Phase 2 / Later

1. **Native connectors**
   - Forms, ad platforms, external CRMs, website capture tools.

2. **Standalone contact and company/account objects**
   - Richer relationship modeling.

3. **Opportunity/deal management**
   - Monetary value, expected close date, probability.

4. **Kanban pipeline view**
   - Complement table-based management.

5. **Saved views and team dashboards**
   - Role-based visibility.

6. **Duplicate detection and merge workflows**
   - Better data hygiene.

7. **Outbound webhooks**
   - Trigger downstream systems on lead events.

8. **AI recommendations**
   - Next best action, lead scoring refinement, stalled lead alerts.

9. **Activity integrations**
   - Email, meeting, and communication logging.

10. **Reporting and analytics**
   - Funnel conversion by source, owner, stage aging, cycle time.

---

## 16. Success Metrics

Specific numeric targets are not provided because no validated benchmarks or business targets were included in the source material. These should be defined with the product owner.

### Recommended Metric Categories

#### Adoption Metrics
- Number of companies enabling CRM.
- Number of active CRM users.
- Percentage of leads managed in CRM after ingestion.

#### Workflow Metrics
- Number of leads created manually.
- Number of leads imported from Lead Discovery.
- Number of leads created via external API.
- Stage transition volume over time.

#### Conversion/Operational Metrics
- Percentage of leads progressing beyond initial stage.
- Lead-to-proposal progression rate.
- Lead-to-customer progression rate.
- Average time spent in stage.

#### AI Utilization Metrics
- Percentage of CRM leads used to trigger Sales Assistant actions.
- Number of AI-generated outputs launched from CRM context.

#### Data Quality / Reliability Metrics
- Duplicate lead rate.
- API error rate.
- Sync failure rate.
- Percentage of leads missing key fields.

### Strong Recommendation
Before implementation begins, define a **minimum analytics instrumentation plan** so the team can measure:
- ingestion source,
- lead creation path,
- stage transitions,
- AI action launches from CRM,
- conversion outcomes.

---

## 17. Final Recommendation

This feature is strategically strong and should be prioritized as a **lead-management CRM foundation**, not as a full CRM replacement.

The most effective approach is:

1. **Lead-first object model**
2. **Table-first user experience**
3. **Configurable but simple pipeline**
4. **API-first integration layer**
5. **Tight integration with Lead Discovery and Sales Assistant**

This recommendation is consistent with Nousio’s documented strengths:
- structured AI adoption,
- practical workflows,
- growth support,
- company-controlled operational context,
- multi-tenant security,
- specialized assistant ecosystem.

Grounded sources used in this PRD:
- **`nousio_positioning.md`**
- **`solution_overview.md`**
- **`features_documentation.md`**
- **`disruptio_positioning.md`**

If useful, the next best step is to convert this PRD into one of the following execution artifacts:
1. **User stories + acceptance criteria**
2. **Data model / schema specification**
3. **API specification**
4. **UX wireframe outline**
5. **phased delivery plan with engineering tickets**

---

*Exported from Nousio on March 24, 2026*