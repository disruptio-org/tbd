---
name: ui-redesign-from-screenshot
description: redesign product screens from screenshots into cleaner, developer-ready interfaces while preserving the core information architecture unless the user asks for structural changes. use when a user shares a screenshot, print screen, or reference image of an existing app or webpage and wants a ux/ui redesign, visual improvement, higher-fidelity mockup, rewritten frontend screen, or figma-ready/front-end-ready handoff.
---

# UI redesign from screenshot

Turn screenshots of existing product screens into improved, high-fidelity redesigns.

Default to a **React + Tailwind implementation that can be previewed immediately**. Treat that as the primary deliverable unless the user explicitly asks for another format. If a connected design tool such as Figma is available and the user explicitly wants it, produce the same redesign in that tool too; otherwise do not block on it.

## Default operating mode

Assume these defaults unless the user overrides them:

- Preserve the original screen's core structure, content hierarchy, and functional intent.
- Improve visual design, spacing, alignment, readability, component consistency, and interaction clarity.
- Keep the redesign realistic for production software, not a loose concept piece.
- Produce a developer-ready result: a rendered screen plus concise implementation notes.
- Use modern SaaS product patterns from `references/design-principles.md`.

## Workflow

### 1. Read the screenshot like a product designer

Extract and name:

- page purpose
- layout regions
- major components
- navigation patterns
- primary and secondary actions
- information hierarchy
- obvious UX/UI issues

Do not assume hidden product logic that is not visible in the screenshot. When something is unclear, preserve the visible intent and make the lightest reasonable improvement.

### 2. Decide what must stay fixed

By default, keep fixed:

- overall page type
- major user jobs visible on the screen
- key actions already present
- the rough content structure

Only change the structure substantially when the user explicitly asks for rethinking the flow or when the current layout is clearly broken.

### 3. Redesign before building

Internally define a brief redesign direction using the bundled principles:

- simplify clutter
- strengthen hierarchy
- improve spacing rhythm
- standardize components
- make primary actions obvious
- remove visual noise
- improve scanability and accessibility

Prefer a redesign that feels like a polished version of the same product, not a different product.

### 4. Produce the primary deliverable

Default to a previewable React screen.

When canvas or a previewable code surface is available, create a single-file `code/react` implementation that:

- exports a default React component
- uses Tailwind for styling
- is clean, production-oriented, and easy for developers to extend
- includes realistic placeholder text only when the screenshot text is unreadable
- does not invent extra flows or fake data-heavy complexity unless needed to complete the screen

If code preview is not available, provide the redesigned frontend code directly in chat.

### 5. Add concise developer handoff

After the screen, include a compact handoff section covering:

- what changed and why
- component list
- layout behavior / responsiveness assumptions
- interaction assumptions visible from the redesign
- any uncertain elements inferred from the screenshot

Keep the handoff concise and implementation-focused.

## Output contract

Unless the user asks for a different format, structure the response in this order:

1. **Screen summary** — one short paragraph on what the page is and the redesign direction.
2. **Redesigned screen** — React/Tailwind preview or code.
3. **Developer handoff** — short bullets or short sections.

## Quality bar

The redesign should:

- look like a shippable B2B/SaaS interface
- preserve the recognizability of the original page
- improve clarity more than novelty
- avoid gratuitous visual flourishes
- use consistent spacing and typography
- be believable for frontend developers to implement exactly

## Guardrails

- Do not claim exact product behavior that is not visible.
- Do not replace the page with a generic landing page aesthetic.
- Do not remove important controls just to make the design cleaner.
- Do not over-explain theory when the user clearly wants the redesigned artifact.
- If the screenshot is too low-resolution to read details, say so briefly and proceed with the best visible interpretation.

## Optional variants

### If the user asks for Figma

If a connected design tool is actually available in the environment, mirror the redesign there. Keep the same structure and principles as the React version. Still provide a short handoff summary.

### If the user asks for broader UX changes

When the prompt explicitly asks to rethink the flow, you may:

- reorganize sections
- change emphasis between actions
- simplify navigation
- merge or split panels

In that case, clearly note that the redesign includes structural UX changes, not just visual polish.

## Use bundled reference

Use `references/design-principles.md` as the default source of design standards for hierarchy, spacing, components, interaction clarity, accessibility, and production realism.
