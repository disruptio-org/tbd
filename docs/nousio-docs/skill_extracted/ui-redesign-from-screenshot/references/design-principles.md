# Default design principles

Use these principles when redesigning product screenshots into production-oriented interfaces.

## 1. Preserve information architecture first

Start by keeping the original page's visible jobs, content groupings, and action structure intact. Improve the experience without changing the product's meaning unless the user explicitly asks for deeper UX changes.

## 2. Clear hierarchy over decoration

Prioritize:

- one obvious primary action
- readable section grouping
- strong visual distinction between primary, secondary, and tertiary information
- predictable scan paths

Use size, spacing, weight, and containment before using ornamental styling.

## 3. SaaS-grade spacing rhythm

Default to a clean spacing system with generous breathing room.

- Tight inside dense controls, relaxed between sections.
- Use consistent gaps within component families.
- Increase spacing around page headers, cards, filters, and action bars.
- Avoid the cramped look that often comes from screenshot-derived UIs.

## 4. Reduce chrome, not capability

Remove unnecessary borders, duplicate labels, excessive boxes, and visual noise.
Keep the visible capabilities. The redesign should feel simpler because it is clearer, not because features disappeared.

## 5. Component consistency

Normalize repeated UI patterns:

- buttons
- inputs and selects
- cards/panels
- tabs
- tables and lists
- badges and status chips
- sidebars and top bars

Prefer a small number of consistent component patterns used repeatedly.

## 6. Strong page framing

Most application screens should have:

- a clear page title area
- a visible summary of what the screen is for
- an action zone for the key next steps
- well-separated content regions

Users should understand the page purpose in a few seconds.

## 7. Interaction clarity

Make interactive elements feel intentional.

- Primary actions should stand out.
- Secondary actions should be available but quieter.
- Destructive or risky actions should be visually differentiated.
- Filters, sorting, and search should be grouped logically.

## 8. Accessibility-aware defaults

Design with readable contrast, large enough hit areas, visible labels, and clear focus/hover affordances in mind. Avoid tiny text and low-contrast placeholder-heavy patterns.

## 9. Responsive realism

Build layouts developers can actually ship.

- Prefer practical grid systems.
- Avoid impossible asymmetries.
- Collapse secondary panels reasonably on smaller screens.
- Keep headers and action bars adaptable.

## 10. Production realism

The output should look like an implementation target, not a moodboard.

Prefer:

- clean React structure
- realistic spacing and alignment
- practical states and placeholders
- restrained visual language

Avoid speculative micro-interactions, decorative glassmorphism, or brand-heavy marketing tropes unless the screenshot itself calls for them.

## Default stylistic direction

Unless the user provides brand rules, bias toward:

- modern B2B SaaS
- calm visual system
- neutral surfaces
- crisp typography hierarchy
- rounded corners and soft shadows used sparingly
- strong whitespace discipline
- concise labels

## Handoff expectations

After the redesigned screen, provide concise implementation notes covering:

- key improvements
- component inventory
- responsive assumptions
- any inferred content or behavior
