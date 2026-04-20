# Growth Assistant Pages — UX/UI Specification

> **Scope**: Marketing Assistant, Sales Assistant, Product Assistant  
> **Routes**: `/marketing` · `/sales` · `/product`  
> **Last updated**: March 2026

---

## Overview

The three Growth Assistant pages share a single unified UX pattern powered by the `AIAssistantChat` component. Each page follows the same three-phase conversational flow:

```
Phase 1 → Chat & Brief      (Gather intent via conversation or voice)
Phase 2 → Params Card       (Review extracted parameters, trigger generation)
Phase 3 → Split-screen      (Review generated output + continue refining via chat)
```

---

## Page Layout

### Common Structure

```
┌─────────────────────────────────────────────────────────┐
│  Page Header (icon + title + subtitle)                  │
├─────────────────────────────────────────────────────────┤
│  Tabs: [ Create ] [ Drafts ] [ History ]                │
├─────────────────────────────────────────────────────────┤
│  Workspace Selector dropdown                            │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  AIAssistantChat Component (phases 1–3 below)           │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

### Tabs

| Tab | Content |
|---|---|
| **Create** | The main AI chat interface (all 3 phases) |
| **Drafts** | Saved outputs — list of draft cards with load/delete actions |
| **History** | Past generation runs — read-only list sorted by date |

### Workspace Selector
- Displayed above the chat area on the Create tab
- Dropdown shows all available workspaces/projects for the company
- Selecting a workspace injects its `contextText` and `name` into the AI system prompt, grounding responses in the right company context

---

## Phase 1 — Chat & Brief (Empty State)

**Trigger**: User lands on the page for the first time (no messages yet).

### Quick Voice Brief (Initial Empty State)

```
┌────────────────────────────────────────────────────┐
│                                                    │
│              📣  (assistant emoji)                 │
│         AI Marketing Assistant                     │
│   Describe what you need — or click to speak.     │
│                                                    │
│        [ ● 🎤  Start Voice Brief ]                 │
│                                                    │
│              — or type below —                     │
│                                                    │
│  [ 📎 ] [ 🖼️ ] [ Describe what you need... ] [↑] │
└────────────────────────────────────────────────────┘
```

**Content Type Pills** — displayed directly above the voice brief:

```
[ 📣 LinkedIn Post ] [ 🌐 Website Copy ] [ 📝 Blog/Article ] ...
```

- Each pill is a clickable card with an icon + label
- Selecting a pill locks in the content type and highlights it with an accent border
- If not selected, the AI auto-detects the best type from the user's brief

### Voice Recording Flow

1. User clicks **🎤 Start Voice Brief**  
2. Browser requests microphone permission (first time only)
3. **Recording state**:
   - Animated waveform (8 bars, staggered timing)
   - Live timer (0:00 → N:NN)
   - Live transcript appears below waveform as AI recognises speech
   - **⏹️ Stop** button ends recording
4. **Post-recording state** (stopped, transcript visible):
   - Transcript preview box (scrollable if long)
   - **✨ Send Brief** — submits transcript as first chat message
   - **Clear** — wipes transcript, return to idle
   - **🎤 Re-record** — starts a new recording

### Chat Input Bar

Always visible at the bottom of the chat panel:

```
[ 📎 ] [ 🖼️ ] [     text input field     ] [ 🎤 ] [ ↑ ]
```

| Element | Function |
|---|---|
| 📎 | Opens workspace document picker dropdown |
| 🖼️ | Opens file/image upload picker |
| Text input | Free-text or voice-populated input |
| 🎤 | Toggles in-chat voice recording (appears after first message) |
| ↑ | Send button (enabled when input is non-empty) |

**Keyboard shortcut**: `Enter` sends the message. `Shift+Enter` adds a new line.

---

## Phase 1 — Chat & Brief (Active Conversation)

Once the first message is sent, the page transitions from the voice brief empty state to a chat thread view.

### Chat Messages

```
┌────────────────────────────────────────────────────┐
│  [📣] Hello! I can help you create a LinkedIn...   │  ← AI bubble
│                                                    │
│       [You] I need a post about our new launch [●] │  ← User bubble (right-aligned)
│                                                    │
│  [📣] Great! Who is the target audience for...     │  ← AI follow-up
│                                                    │
│  [···]  (thinking indicator — 3 animated dots)     │  ← While waiting
└────────────────────────────────────────────────────┘
```

**Message anatomy:**
- **AI messages**: Left-aligned, white bubble with border, assistant emoji avatar
- **User messages**: Right-aligned, accent-coloured (purple/brand) bubble, "You" avatar
- **Thinking state**: 3 bouncing dots shown while API call is in flight
- **Attachments**: Shown as chips above the message bubble (image thumbnails for images, 📎/📄 icon for files/docs)

### Attachment Chips (pending, before send)

```
┌──────────────────────────────────────────────────┐
│ [ 📄 strategy-doc.pdf ✕ ] [ 🖼 screenshot.png ✕ ]│
└──────────────────────────────────────────────────┘
```

Shown between the message thread and the input bar. Each chip has an ✕ remove button.

### Document Picker Dropdown

Triggered by 📎 button. Appears above the input bar:

```
┌─────────────────────────────────────┐
│ ☑ 📄 company-profile.pdf   128 KB  │
│ ☐ 📄 product-roadmap.docx   56 KB  │
│ ☐ 📄 target-audience.md     12 KB  │
└─────────────────────────────────────┘
```

Checked documents are attached to the next message and their content is injected into the AI system prompt.

### AI Conversation Behaviour

The AI asks **one clarifying question at a time**, progressively building up the parameters it needs. For example (Marketing):

1. "What's the main topic you'd like to cover?"
2. "Who is your target audience?"  
3. "What tone would you prefer — professional, casual, educational?"
4. *(Once required fields are collected)* → Shows **Params Card**

---

## Phase 2 — Params Card (Ready to Generate)

When the AI has gathered all required parameters, it adds a **Params Card** as a special message in the chat thread:

```
┌─────────────────────────────────────────────────┐
│  ⚙️  Ready to generate                          │
│  ─────────────────────────────────────────────  │
│  Content Type      LinkedIn Post                │
│  Topic             AI platform launch           │
│  Audience          CTOs & Product Leaders       │
│  Tone              Professional                 │
│  Language          Portuguese (PT)              │
│  Length            Medium                       │
│                                                 │
│  [      ✨ Generate Draft      ]                │
└─────────────────────────────────────────────────┘
```

A green hint bar also appears below the chat:

```
✅ Ready to generate! Click "✨ Generate Draft" above.
```

**User action**: Click **✨ Generate Draft** to trigger the generation API. The user can also continue chatting to modify any parameter before generating.

---

## Phase 3 — Split-Screen: Output + Refinement

After "Generate Draft" is clicked, the layout **splits into two columns**:

```
┌──────────────────────────────┬────────────────────────┐
│                              │                        │
│   LEFT: Generated Output     │   RIGHT: Chat Panel    │
│   (scrollable)               │   (continues thread)   │
│                              │                        │
└──────────────────────────────┴────────────────────────┘
```

### Left Panel — Generated Output

```
┌───────────────────────────────────────────────┐
│  Title of Generated Content         [Badge]   │
│  One-line summary                             │
├───────────────────────────────────────────────┤
│                                               │
│  [Section Label]                              │
│  Section content rendered as Markdown...      │
│                                               │
│  [Section Label]                              │
│  More markdown content...                     │
│                                               │
├───────────────────────────────────────────────┤
│  [📋 Copy] [💾 Save] [📥 Export] [🔄 Regen]  │
└───────────────────────────────────────────────┘
```

**Generating state**: While the API is processing, a spinner overlay appears on top of the content with a live loading step indicator:
```
  ⟳  Analysing company context...
```

Steps cycle every ~2.5s through messages like:
- "Analysing company context..."
- "Crafting your content..."
- "Applying final polish..."

**Output actions** (bottom action bar):

| Button | Action |
|---|---|
| 📋 Copy | Copies full markdown content to clipboard |
| 💾 Save | Opens save-as-draft dialog with editable title |
| 📥 Export | Downloads as `.txt` file |
| 🔄 Regenerate | Re-runs generation with same parameters |

### Right Panel — Chat Refinement

The chat thread continues on the right. The user can now send natural language refinement commands:

```
You: make it shorter
You: change the tone to more casual
You: focus more on the ROI angle
You: expand the call to action section
```

The AI maps these to **refinement actions**:

| User command | Action triggered |
|---|---|
| "make it shorter", "more concise" | `shorten` |
| "expand", "more detail", "longer" | `expand` |
| "rewrite", "reword" | `rewrite` |
| "change tone", "more persuasive" | `change_tone` |
| "regenerate", "start fresh" | `regenerate` |

On unrecognised commands, GPT-4o classifies the intent and maps it to the closest action.

---

## Assistant-Specific Differences

### 📣 Marketing Assistant (`/marketing`)

| Field | Options |
|---|---|
| **Content Types** | LinkedIn Post, Website Copy, Blog/Article, Newsletter, Content Plan, Campaign Idea, Service Description |
| **Required params** | `contentType`, `topic` |
| **Optional params** | audience, goal, tone, language, length, callToAction |
| **Output sections** | Hook, Main Content, Call to Action, Hashtags (LinkedIn) |

### 💰 Sales Assistant (`/sales`)

| Field | Options |
|---|---|
| **Content Types** | Outreach Email, LinkedIn Message, Discovery Call Plan, Proposal Outline, Proposal Draft, Follow-up Email, Objection Handling, Buyer-Specific Pitch, Meeting Prep Notes, Sales Summary |
| **Required params** | `taskType`, `objective` |
| **Optional params** | prospectCompanyName, prospectWebsite, prospectIndustry, prospectLocation, buyerRole, painOpportunity, offerToPosition, tone, language, length, callToAction |
| **Output sections** | Subject/Opening, Body, Call to Action, Notes |

### 📦 Product Assistant (`/product`)

| Field | Options |
|---|---|
| **Content Types** | PRD, BRD, Functional Spec, Technical Brief, User Stories, Acceptance Criteria, Feature Breakdown, Product Positioning, Brand Positioning, Vibe Coding Spec, Roadmap, Epic Breakdown, API Draft, Discovery Analysis |
| **Required params** | `outputType`, `productOrFeature` |
| **Optional params** | targetPersona, problemSolved, keyBenefits, audienceType, detailLevel, tone, language |
| **Output sections** | Varies by output type (e.g. PRD: Executive Summary → Goals → Functional Requirements → MVP Scope → Success Metrics) |
| **Extra tab** | **Documents** tab for uploading knowledge files (PDF, DOCX, etc.) to the workspace |

---

## Auto Tool-Selection

If the user does **not** manually select a content type pill, the AI **detects the most appropriate type automatically** from the conversation:

> *User*: "I need to write to a prospect at Acme Corp — they're a logistics company and we can help with their routing"  
> *AI*: [auto-selects **Outreach Email**] "Got it! I'll prepare an outreach email. What's the main pain point you want to address?"

The auto-selected type is **highlighted in the pill grid** so the user can see and override it at any time.

---

## Voice Input — Detailed Behaviour

### Browser Support
- Uses the native **Web Speech API** (`SpeechRecognition` / `webkitSpeechRecognition`)
- Supported in Chrome and Edge. Not available in Firefox/Safari (fallback: text input only).
- Default recognition language: **Portuguese (PT)** (`rec.lang = 'pt-PT'`)

### Interim vs. Final Transcription
- **Interim results** appear in real time as the user speaks (italic/grey)
- **Final results** are committed when the browser confirms them
- Both are concatenated and shown in the transcript box

### In-Chat Voice (after first message)
- Available via the 🎤 button in the input bar
- While recording: button turns red with pulsing animation, a compact waveform and timer appear above the input, input field shows "Listening…" placeholder and is disabled
- Stopping voice: transcript is placed into the input field, user can edit before sending

---

## Drafts Tab

```
┌─────────────────────────────────────────────────────────┐
│  [Title of Draft]              LinkedIn Post  2h ago    │
│  [Summary line...]                        [Load] [Del]  │
├─────────────────────────────────────────────────────────┤
│  [Another Draft]                Website Copy  1d ago    │
│  [Summary line...]                        [Load] [Del]  │
└─────────────────────────────────────────────────────────┘
```

- **Load**: Switches to Create tab and populates the result panel with the saved draft for further editing
- **Delete**: Removes the draft (with a confirmation prompt)
- Drafts are stored per user and per assistant type

---

## History Tab

- Read-only chronological list of all past generation runs
- Each row shows: output type badge, title, creation date, summary (first 120 chars)
- No delete or load action — purely for reference and audit

---

## Loading & Error States

| State | Visual |
|---|---|
| **Chat waiting for AI** | Three bouncing dots in an AI bubble |
| **Generating content** | Spinner overlay on left panel + cycling step text |
| **Generation error** | Error toast notification + ⚠️ message in chat |
| **API error in chat** | `⚠️ Something went wrong. Please try again.` bubble |

---

## Responsive Behaviour

| Breakpoint | Layout |
|---|---|
| **> 900px** | Full split-screen (left output + right chat) |
| **≤ 900px** | Stacked layout — output panel on top (50vh), chat below (50vh) |
| **Collapsed sidebar** | All page containers expand to `max-width: none`, content fills full available width |
