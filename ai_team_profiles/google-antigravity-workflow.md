# Google Antigravity Workflow — Using the AI Team with a Predefined Process

## Objective
Use Claude as a structured AI team inside Google Antigravity instead of using one undifferentiated chat for everything.

## Core Rule
Never ask one role to do the entire job from idea to code.

Use a fixed sequence.

## Recommended Team
1. Company DNA Brain
2. Product Lead
3. UX/UI Designer
4. Technical Architect
5. Full-Stack Builder
6. QA Reviewer
7. Growth Strategist
8. Execution Operator

## Standard Workflow

### Phase 1 — Direction
Use **Company DNA Brain**
Goal:
- validate whether the initiative matters
- decide the right direction
- define strategic constraints

Prompt:
```md
Act as the Company DNA Brain.

Initiative:
[PASTE]

Context:
[PASTE]

Decide the correct direction for this initiative.
Respond using:
1. Assessment
2. Best Decision
3. Strategic Rationale
4. Risks / Trade-offs
5. Next Move
```

### Phase 2 — Product Definition
Use **Product Lead**
Goal:
- turn the direction into a spec

Prompt:
```md
Act as the Product Lead.

Strategic direction:
[PASTE]

Write the feature definition.
Respond using:
1. User Problem
2. Desired Outcome
3. Proposed Feature
4. MVP Scope
5. Non-Goals
6. Acceptance Criteria
7. Open Risks
```

### Phase 3 — UX
Use **UX/UI Designer**
Goal:
- reduce user friction
- design the flow

Prompt:
```md
Act as the UX/UI Designer.

Feature spec:
[PASTE]

Current UI context:
[PASTE]

Design the best flow.
Respond using:
1. UX Goal
2. Core User Flow
3. Screen Structure
4. Critical Decisions
5. Defaults / Simplifications
6. Edge States
7. UX Recommendation
```

### Phase 4 — Architecture
Use **Technical Architect**
Goal:
- define schema, API, boundaries, and implementation order

Prompt:
```md
Act as the Technical Architect.

Feature spec:
[PASTE]

Relevant architecture:
[PASTE]

Design the implementation approach.
Respond using:
1. Architecture Impact
2. Data Model Changes
3. API / Contract Changes
4. Frontend / Backend Boundaries
5. Implementation Sequence
6. Risks
7. Recommendation
```

### Phase 5 — Delivery Plan
Use **Execution Operator**
Goal:
- turn the spec and plan into ordered tasks

Prompt:
```md
Act as the Execution Operator.

Strategic decision:
[PASTE]

Product spec:
[PASTE]

Architecture plan:
[PASTE]

Create the execution workflow.
Respond using:
1. Current Objective
2. Workstream Order
3. Immediate Tasks
4. Dependencies
5. Risks / Blockers
6. Done Criteria
7. Next Checkpoint
```

### Phase 6 — Build
Use **Full-Stack Builder**
Goal:
- implement in slices

Prompt:
```md
Act as the Full-Stack Builder.

Product spec:
[PASTE]

Architecture plan:
[PASTE]

UX guidance:
[PASTE]

Implement the first slice.
Respond using:
1. Build Plan
2. Files to Change
3. Implementation Notes
4. Code
5. Assumptions
6. Validation Checklist
```

### Phase 7 — Review
Use **QA Reviewer**
Goal:
- validate reliability

Prompt:
```md
Act as the QA Reviewer.

Spec:
[PASTE]

Implementation summary:
[PASTE]

Review this for reliability.
Respond using:
1. Test Scope
2. Critical Scenarios
3. Edge Cases
4. Regression Risks
5. Bugs / Gaps
6. Release Readiness
7. Recommendation
```

### Phase 8 — Commercial Check
Use **Growth Strategist**
Goal:
- make sure the feature strengthens adoption and value

Prompt:
```md
Act as the Growth Strategist.

Feature:
[PASTE]

Company context:
[PASTE]

Validate this from a commercial perspective.
Respond using:
1. Commercial Value
2. User Value Narrative
3. Positioning Angle
4. Monetization / Packaging Relevance
5. Adoption Risks
6. Launch Guidance
7. Recommendation
```

## Recommended Operating Rule
Use one conversation or one Antigravity workspace per feature.  
Keep the outputs in order:
1. strategy
2. product
3. UX
4. architecture
5. execution
6. build
7. QA
8. growth

## Founder Shortcut
When speed matters, use this compressed path:
1. Company DNA
2. Product Lead
3. Technical Architect
4. Full-Stack Builder
5. QA Reviewer

Use the full 8-role flow for larger features.

## Weekly Cadence

### Monday
- Company DNA sets priorities
- Product Lead defines specs
- Execution Operator sequences work

### Tuesday
- UX/UI Designer defines flow
- Technical Architect defines implementation

### Wednesday / Thursday
- Full-Stack Builder implements

### Friday
- QA Reviewer validates
- Growth Strategist checks value and launch framing
- Company DNA decides ship / revise / defer

## Practical Advice for Google Antigravity
- Save each role as a reusable prompt file
- Start every initiative with Company DNA
- Never jump to code before Product + Architecture are clear
- Keep each role output short, structured, and reusable
- Paste prior role outputs into the next role prompt
- Let Execution Operator maintain the running task order
