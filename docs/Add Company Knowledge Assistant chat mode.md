Functional Requirements
1 — Add New Chat Mode

Create a new chat mode:

Company Knowledge Assistant

This mode must be selectable when starting a chat.

Possible approaches:

Option A (preferred):

assistantType = COMPANY_KNOWLEDGE

Option B:

Separate route:

/chat/company-assistant

The assistant must behave differently from the normal AI chat.

2 — Retrieval Pipeline

The assistant must retrieve company knowledge before answering.

The retrieval process should:

Generate embedding of the user question

Perform similarity search against DocumentEmbedding

Retrieve top relevant chunks

Build context from these chunks

Pass context to the LLM

Retrieved data must include:

documentId
filename
chunkText
similarity score

Only documents belonging to the current companyId should be used.

3 — Context Construction

The assistant context must contain:

Company profile (if exists)

Relevant document chunks

User question

Example context structure:

COMPANY PROFILE:
{company profile data}

COMPANY DOCUMENTS:
{retrieved document chunks}

QUESTION:
{user message}
4 — Assistant Behavior Rules

The assistant must follow these rules:

Prioritize company knowledge over general knowledge.

Use only retrieved documents when possible.

If the answer is not found in company documents, say clearly:

that the information is not available in company knowledge.

Do not hallucinate company policies or facts.

Provide concise answers.

When possible, reference the source document.

5 — Source Attribution

Each answer must return metadata containing:

sources: [
  {
    documentId
    filename
    chunkTextPreview
  }
]

The UI should display these sources under the assistant response.

Clicking a source must open the existing DocumentViewerModal.

6 — Grounding Status

Each answer must include a grounding status:

VERIFIED
PARTIAL
NOT_FOUND

Definitions:

VERIFIED
Answer is directly supported by company documents.

PARTIAL
Answer includes some inference but references company documents.

NOT_FOUND
No relevant company knowledge was found.

7 — UI Requirements

Add a new assistant entry point:

Company Assistant

Example UI placement:

Chat sidebar

Assistant selector

New chat button dropdown

When the assistant loads, show suggested prompts:

What does our company do?

What are our main products?

How do we onboard a client?

Where can I find HR policies?

Summarize our services.

Display response with:

AI message

source list

grounding badge

Example:

Answer:
...

Sources:
📄 Employee Handbook
📄 Product Overview
8 — Security

Ensure the assistant respects:

companyId isolation

The assistant must never access documents belonging to another company.

All retrieval queries must filter by companyId.

Implementation Guidance

Reuse existing modules where possible.

Relevant existing systems:

Document

DocumentEmbedding

Chat

Conversation

Message

Existing AI models:

embedding: text-embedding-3-small
chat: gpt-4o-mini
EXPECTED OUTPUT

The agent implementing this task should deliver the following.

1 — Backend Changes
Add assistant type support

Update chat system to support:

assistantType = COMPANY_KNOWLEDGE
Update Chat API

Modify:

POST /api/chat

Logic:

if assistantType == COMPANY_KNOWLEDGE:
    run company knowledge pipeline
else:
    run existing chat pipeline
Implement Retrieval Function

Create function:

findRelevantCompanyChunks(companyId, question)

Steps:

generate query embedding

search DocumentEmbedding table

compute cosine similarity

return top 5-10 chunks

Build Context Builder

Function:

buildCompanyKnowledgeContext(profile, chunks)

Returns formatted context string.

Update LLM Prompt

System prompt must be:

You are the internal AI assistant for a company.

Your role is to answer questions using the company's internal knowledge.

Use the provided company documents to answer the question.

If the answer is not contained in the documents, say that the information is not available in the company knowledge.

Do not invent company policies or details.

Always reference documents when possible.
Response Metadata

Return structure:

{
  answer: string,
  groundingStatus: VERIFIED | PARTIAL | NOT_FOUND,
  sources: [
    {
      documentId: string,
      filename: string,
      preview: string
    }
  ]
}
2 — Frontend Changes

Add:

Company Assistant Entry

Location:

Chat sidebar

Button:

Company Assistant
Assistant UI State

When opening assistant:

Display suggested prompts.

Response Rendering

Render:

assistant message

grounding badge

sources list

Example UI:

AI Response

[VERIFIED]

Answer text...

Sources
📄 Employee Handbook
📄 Product Overview

Clicking source opens:

DocumentViewerModal
3 — Database Changes (if needed)

Possible additions:

Conversation table:

assistantType

Message metadata:

groundingStatus
sources
4 — Testing

Test cases:

Question answerable from documents.

Question partially answerable.

Question unrelated to company documents.

Multiple document sources.

Company isolation validation.

5 — Success Criteria

The feature is complete when:

Users can open Company Assistant

The assistant answers using company documents

Sources are displayed

Answers include grounding status

Clicking sources opens document viewer

No cross-company data leakage occurs