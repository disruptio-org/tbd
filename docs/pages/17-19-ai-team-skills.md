# 17 — AI Team Settings

## Route
`/settings/ai-brain` (list) + `/settings/ai-brain/[brainType]` (detail editor)

## Purpose
Configure the AI team — create, edit, and manage AI brain profiles. Deep customization of each brain's identity, reasoning, knowledge usage, task behavior, and guardrails. Also includes team design wizard and team structure analysis.

## UX Flow
1. Page loads → fetches all brains + available skills + team structure
2. **Team Overview**: cards for each AI team member
3. **Team Design Wizard**: AI proposes team composition based on company profile
4. **Create/Edit Brain**: deep configuration editor with sliders, toggles, and text fields
5. **Publish**: activate a brain's configuration (version-controlled)

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/ai/brains` | GET | Page load | List all brains | ~300ms |
| `/api/ai/skills` | GET | Page load | Available skills | ~200ms |
| `/api/ai/brains/team-structure` | GET | Page load | Team structure config | ~200ms |
| `/api/ai/brains/team-structure` | POST | Save structure | Update team config | ~300ms |
| `/api/ai/brains/suggest` | POST | Suggest button | AI brain suggestions | ~5-15s |
| `/api/ai/brains` | POST | Create/update brain | Save brain config | ~400ms |
| `/api/ai/brains/{id}/publish` | POST | Publish button | Activate brain version | ~300ms |
| `/api/ai/brains/{id}` | DELETE | Delete button | Remove brain | ~200ms |
| `/api/company/profile/completion` | GET | Wizard check | Profile readiness | ~200ms |
| `/api/ai/brains/design-team` | POST | Design wizard | AI proposes full team | ~10-25s |
| `/api/ai/brains/create-team` | POST | Accept design | Create all proposed brains | ~2-5s |
| `/api/ai/brains/analyze-team` | POST | Analyze button | AI team analysis | ~8-20s |

## Components & Sections

### Team Overview
- Card grid: brain avatar, name, type badge, status, description
- Status: DRAFT (gray), ACTIVE (green), ARCHIVED (red)
- Quick actions: edit, publish, delete

### Team Design Wizard
- Multi-step modal:
  1. Company profile readiness check
  2. AI analyzes company → proposes team composition
  3. Review proposed members (edit name, role, remove)
  4. Accept → creates all brains at once

### Team Structure Modal
- Operating model text area
- Collaboration model text area
- Live collaboration diagram (visual connections)

### Brain Configuration Editor (`/settings/ai-brain/[brainType]`)
- **Identity tab**: tone preset, formality/warmth/assertiveness sliders, personality traits, communication style
- **Reasoning tab**: depth, speed-vs-thoroughness, proactiveness, challenge level sliders
- **Knowledge tab**: source strictness, citation strictness, confidence thresholds, grounding toggles
- **Task Behavior tab**: detail level, action orientation, verbosity, summary style
- **Guardrails tab**: avoid inventing data, flag uncertainty, avoid legal/financial advice toggles
- **Advanced Instructions**: free text for role-specific notes
- **Version History**: past configurations with rollback

---

# 18 — AI Team Workspace

## Route
`/ai-team` (list) + `/ai-team/[memberId]` (detail)

## Purpose
Operational view of AI team members. See each member's recent activity, task history, and performance. Different from the settings page — this is for monitoring, not configuring.

## API Calls
| Endpoint | Method | Trigger | Purpose | Wait Time |
|----------|--------|---------|---------|-----------|
| `/api/ai/brains` | GET | Page load | List team members | ~300ms |
| `/api/ai/members/{id}/tasks` | GET | Member detail | Task history | ~400ms |
| `/api/ai/members/{id}/history` | GET | Member detail | Generation history | ~400ms |

## Components & Sections

### Team Grid
- Cards per AI member with avatar, name, brain type, activity count
- Click → navigate to member detail

### Member Detail (`/ai-team/[memberId]`)
- Profile header: name, brain type, description
- Recent activity list
- Generated content history
- Performance metrics

---

# 19 — Skill Library

## Route
`/skills`

## Purpose
Browse, create, and manage custom AI skills. A standalone page that renders the `SkillsManagerPanel` component (shared with the AI Brain settings page).

## Components & Sections
- Renders `SkillsManagerPanel` component directly
- Full skill management: create, edit, schedule, import, chain
- See AI Team Settings docs for SkillsManagerPanel details
