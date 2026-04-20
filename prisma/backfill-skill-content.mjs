// Backfill descriptions + instruction prompts for all seeded skills
// Usage: node prisma/backfill-skill-content.mjs

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const SKILL_CONTENT = {
    // ─── MARKETING ─────────────────────────────────────
    linkedin_post: {
        description: 'Create engaging LinkedIn posts optimized for reach and engagement.',
        instructionPrompt: `You are creating a LinkedIn post for the company.

Structure:
1. Hook — attention-grabbing first line (use a bold statement, question, or surprising stat)
2. Value body — 3-5 short paragraphs with actionable insights
3. Call to action — encourage comments, shares, or visits
4. Hashtags — 3-5 relevant tags

Rules:
- Maximum 1300 characters
- Use line breaks for readability
- Use emoji sparingly (1-2 max)
- Write in the company's brand voice
- Focus on providing value, not selling
- End with a question to encourage engagement`,
    },
    website_copy: {
        description: 'Generate compelling website copy for landing pages, about pages, and service descriptions.',
        instructionPrompt: `You are writing website copy for the company.

Structure:
1. Headline — clear, benefit-driven (max 10 words)
2. Subheadline — supporting detail 
3. Body copy — 2-4 paragraphs explaining value
4. Features/Benefits — bullet list of key points
5. Call to action — clear next step

Rules:
- Write for scannability (short paragraphs, bold key phrases)
- Lead with benefits, not features
- Use active voice and direct language
- Avoid jargon unless industry-specific
- Include social proof references where relevant`,
    },
    blog_idea: {
        description: 'Draft blog articles and content ideas aligned with your brand strategy.',
        instructionPrompt: `You are writing a blog article for the company.

Structure:
1. Title — SEO-optimized, compelling
2. Introduction — hook the reader, state the problem
3. Body — 3-5 sections with H2 headers
4. Conclusion — summary + call to action
5. Meta description — 155 characters for SEO

Rules:
- Target 800-1500 words
- Use conversational but professional tone
- Include data or examples where possible
- Add internal linking suggestions
- Write for both humans and search engines`,
    },
    newsletter: {
        description: 'Compose email newsletters that inform and engage your subscribers.',
        instructionPrompt: `You are writing an email newsletter for the company.

Structure:
1. Subject line — compelling, under 50 characters
2. Preview text — supporting hook, under 90 characters
3. Greeting — personalized opening
4. Main content — 2-3 key stories/updates
5. Call to action — one clear CTA
6. Sign-off — warm closing

Rules:
- Keep total length under 500 words
- Use short paragraphs (2-3 sentences max)
- Include one primary CTA and one secondary
- Write in a conversational, personal tone
- Make it scannable with bold text and bullet points`,
    },
    content_plan: {
        description: 'Create structured content calendars and editorial plans.',
        instructionPrompt: `You are creating a content plan for the company.

Structure:
1. Content themes — 3-5 monthly themes aligned with business goals
2. Calendar — weekly content schedule with types and channels
3. Content mix — ratio of educational, promotional, engagement content
4. Key dates — industry events, holidays, product launches
5. KPIs — metrics to track per content type

Output as a structured table or calendar format.

Rules:
- Balance content types (80% value, 20% promotional)
- Include multiple channels (social, blog, email)
- Align with business objectives and audience needs
- Suggest repurposing opportunities`,
    },
    campaign_idea: {
        description: 'Brainstorm creative marketing campaign concepts.',
        instructionPrompt: `You are ideating a marketing campaign for the company.

Structure:
1. Campaign name — memorable, on-brand
2. Concept — one-paragraph overview
3. Target audience — specific segment
4. Key message — single core idea
5. Channels — where it will run
6. Timeline — phases and duration
7. Success metrics — how to measure impact

Rules:
- Be creative but realistic
- Align with brand positioning
- Consider budget constraints
- Include both digital and offline tactics where relevant
- Suggest A/B testing opportunities`,
    },
    service_description: {
        description: 'Write clear, persuasive descriptions for your services and offerings.',
        instructionPrompt: `You are writing a service description for the company.

Structure:
1. Service name and tagline
2. Problem statement — what pain does this solve?
3. Solution overview — how the service works
4. Key benefits — 4-6 bullet points
5. Process — step-by-step how it works
6. Ideal client — who is this for?
7. Call to action

Rules:
- Lead with the customer's problem, not the solution
- Use specific, measurable outcomes
- Avoid generic claims — be concrete
- Write at a 8th grade reading level
- Include differentiators from competitors`,
    },

    // ─── PRODUCT ASSISTANT ─────────────────────────────
    prd: {
        description: 'Generate comprehensive Product Requirements Documents.',
        instructionPrompt: `You are creating a Product Requirements Document (PRD).

Structure:
1. Overview — product vision and goals
2. Problem statement — user pain points
3. Target users — personas and segments
4. Requirements — functional and non-functional
5. User stories — as a [user], I want [action], so that [benefit]
6. Success metrics — KPIs and acceptance criteria
7. Timeline — milestones and dependencies
8. Open questions — items needing clarification

Rules:
- Be specific and measurable
- Use MUST/SHOULD/COULD prioritization
- Include edge cases and constraints
- Reference competitor analysis where relevant
- Keep it actionable, not theoretical`,
    },
    brd: {
        description: 'Create Business Requirements Documents linking business goals to product needs.',
        instructionPrompt: `You are creating a Business Requirements Document (BRD).

Structure:
1. Executive summary
2. Business objectives and goals
3. Stakeholder analysis
4. Current state assessment
5. Proposed solution overview
6. Business requirements (categorized)
7. Cost-benefit analysis
8. Risk assessment
9. Implementation timeline

Rules:
- Focus on business value, not technical implementation
- Include measurable success criteria
- Address all stakeholder concerns
- Use clear, non-technical language
- Include ROI projections where possible`,
    },
    functional_spec: {
        description: 'Detail functional specifications for features and systems.',
        instructionPrompt: `You are writing a Functional Specification.

Structure:
1. Feature overview
2. Scope and boundaries
3. Functional requirements (numbered)
4. User interface descriptions
5. Data requirements
6. Business rules and logic
7. Error handling
8. Integration points

Rules:
- Each requirement must be testable
- Include acceptance criteria
- Define input/output for each function
- Specify validation rules
- Document all edge cases`,
    },
    technical_brief: {
        description: 'Write technical briefs for engineering teams.',
        instructionPrompt: `You are writing a Technical Brief for engineers.

Structure:
1. Problem context
2. Technical requirements
3. Proposed architecture/approach
4. Technology stack recommendations
5. Data model considerations
6. API specifications
7. Performance requirements
8. Security considerations
9. Testing strategy

Rules:
- Be technically precise
- Include code examples where helpful
- Consider scalability and maintainability
- Address monitoring and observability
- Define rollback strategies`,
    },
    user_stories: {
        description: 'Generate well-structured user stories with acceptance criteria.',
        instructionPrompt: `You are writing User Stories.

Format per story:
- Title: concise feature name
- Story: As a [persona], I want [action], so that [benefit]
- Acceptance criteria: Given [context], When [action], Then [expected result]
- Priority: MUST / SHOULD / COULD
- Estimation notes

Rules:
- Each story should be independent and testable
- Follow INVEST criteria (Independent, Negotiable, Valuable, Estimable, Small, Testable)
- Include negative/edge case scenarios
- Group by epic or feature area
- Keep stories small enough for one sprint`,
    },
    acceptance_criteria: {
        description: 'Define clear acceptance criteria for features and stories.',
        instructionPrompt: `You are writing Acceptance Criteria.

Format (Gherkin style):
GIVEN [precondition/context]
WHEN [action/trigger]
THEN [expected outcome]

Additional format:
- Functional criteria (what it does)
- Non-functional criteria (performance, accessibility)
- Edge cases and error scenarios
- UI/UX criteria

Rules:
- Each criterion must be independently verifiable
- Cover happy path, sad path, and edge cases
- Include data validation rules
- Specify error messages
- Define boundary conditions`,
    },
    feature_breakdown: {
        description: 'Break down complex features into manageable sub-features and tasks.',
        instructionPrompt: `You are breaking down a feature into components.

Structure:
1. Feature overview
2. Sub-features list with descriptions
3. Task breakdown per sub-feature
4. Dependencies map
5. Effort estimation (T-shirt sizing)
6. Priority order
7. MVP vs. full scope

Rules:
- Each task should be completable by one person
- Identify blockers and dependencies early
- Separate frontend, backend, and infrastructure work
- Mark which items are MVP-critical
- Include testing tasks`,
    },
    product_positioning: {
        description: 'Craft clear product positioning statements.',
        instructionPrompt: `You are creating a Product Positioning statement.

Structure:
1. Target audience — specific segment
2. Market category — where you compete
3. Key benefit — primary value proposition
4. Competitive alternative — what they use today
5. Differentiator — why you're better
6. Positioning statement (one paragraph)
7. Elevator pitch (30 seconds)

Rules:
- Be specific, not generic
- Focus on one clear differentiator
- Back claims with evidence
- Address the buyer's primary concern
- Test against competitor positioning`,
    },
    brand_positioning: {
        description: 'Define brand positioning strategy and messaging framework.',
        instructionPrompt: `You are creating a Brand Positioning document.

Structure:
1. Brand essence — one-word/phrase core
2. Brand promise — what you commit to
3. Brand personality — human traits
4. Target audience — psychographic profile
5. Competitive landscape — where you stand
6. Key messages — 3-5 core messages
7. Tone of voice guidelines
8. Brand story — origin narrative

Rules:
- Align with company values
- Be authentic and differentiated
- Create emotional connection
- Ensure consistency across touchpoints
- Include examples of brand in action`,
    },
    vibe_coding_spec: {
        description: 'Create development specifications with a focus on UX and feel.',
        instructionPrompt: `You are writing a Vibe Coding Specification.

Structure:
1. Vision — what the experience should feel like
2. Design principles — 3-5 guiding rules
3. Interaction patterns — how elements respond
4. Motion design — animations and transitions
5. Sound design — audio feedback (if applicable)
6. Technical requirements — performance budgets
7. Reference examples — inspirational links
8. Anti-patterns — what to avoid

Rules:
- Focus on how it feels, not just how it looks
- Include specific timing values for animations
- Reference real-world examples
- Define the emotional journey
- Consider accessibility in every interaction`,
    },
    roadmap: {
        description: 'Build product roadmaps with clear milestones and priorities.',
        instructionPrompt: `You are creating a Product Roadmap.

Structure:
1. Vision and strategy summary
2. Now (current quarter) — in-progress items
3. Next (next quarter) — planned items
4. Later (future) — backlog items
5. Dependencies and risks
6. Resource requirements
7. Success metrics per milestone

Format as a visual timeline or structured table.

Rules:
- Align with business objectives
- Balance quick wins with strategic bets
- Include customer-facing and internal items
- Mark confidence levels
- Leave room for flexibility`,
    },
    epic_breakdown: {
        description: 'Break down epics into stories and tasks with estimates.',
        instructionPrompt: `You are breaking down an Epic into stories and tasks.

Structure:
1. Epic overview and goals
2. User stories (5-15 per epic)
3. Technical tasks per story
4. Acceptance criteria per story
5. Story point estimates
6. Sprint allocation suggestion
7. Dependency graph

Format:
Epic > Story > Task (with estimates)

Rules:
- Stories should fit in one sprint
- Include technical debt tasks
- Add testing and documentation tasks
- Identify cross-team dependencies
- Mark MVP-critical items`,
    },
    api_draft: {
        description: 'Draft API endpoints and entity schemas for new features.',
        instructionPrompt: `You are drafting API endpoints and data entities.

Structure:
1. Entity definitions (data models)
2. Relationships diagram
3. API endpoints list
4. Request/Response schemas (JSON examples)
5. Authentication requirements
6. Rate limiting rules
7. Error response formats
8. Versioning strategy

Format each endpoint:
METHOD /path — Description
Request: { fields }
Response: { fields }
Errors: [codes]

Rules:
- Follow REST conventions
- Use consistent naming (camelCase for JSON, kebab-case for URLs)
- Include pagination for list endpoints
- Document all status codes
- Include validation rules`,
    },
    discovery_analysis: {
        description: 'Conduct discovery research analysis for new product opportunities.',
        instructionPrompt: `You are conducting a Discovery Analysis.

Structure:
1. Research objective
2. Methodology used
3. Key findings (categorized)
4. User pain points (ranked)
5. Opportunity areas
6. Competitive landscape insights
7. Recommendations (prioritized)
8. Next steps and experiments

Rules:
- Base conclusions on evidence
- Separate facts from assumptions
- Include both qualitative and quantitative insights
- Identify risks and unknowns
- Propose experiments to validate assumptions`,
    },

    // ─── SALES ─────────────────────────────────────────
    outreach_email: {
        description: 'Compose personalized cold outreach emails that get responses.',
        instructionPrompt: `You are writing a cold outreach email.

Structure:
1. Subject line — personalized, curiosity-driven (under 50 chars)
2. Opening — personal connection or relevant trigger
3. Value proposition — one clear benefit (2 sentences max)
4. Social proof — brief reference to similar success
5. Call to action — specific, low-commitment ask
6. Sign-off — professional, warm

Rules:
- Keep under 150 words total
- Personalize with research about the prospect
- No generic "I hope this finds you well"
- One CTA only (meeting, reply, resource)
- Write like a human, not a template`,
    },
    linkedin_message: {
        description: 'Craft LinkedIn connection requests and follow-up messages.',
        instructionPrompt: `You are writing a LinkedIn message.

Types:
A) Connection request (300 char limit):
- Mention mutual connection or shared interest
- One clear reason to connect
- No selling in the request

B) Follow-up message:
- Reference the connection context
- Provide value first (insight, resource)
- Soft CTA

Rules:
- Be genuinely curious, not salesy
- Keep it conversational
- Reference their recent posts or activity
- Maximum 3-4 sentences for connection requests
- Include a specific value add`,
    },
    discovery_call_plan: {
        description: 'Prepare structured discovery call plans and question frameworks.',
        instructionPrompt: `You are preparing a Discovery Call Plan.

Structure:
1. Pre-call research summary — company, person, industry context
2. Opening — rapport building (2-3 min)
3. Discovery questions — organized by theme (15-20 min)
   - Current state questions
   - Pain/challenge questions
   - Impact questions
   - Future state questions
4. Value alignment — connect their needs to our solution (5 min)
5. Next steps agreement (2-3 min)

Rules:
- Prepare 8-10 open-ended questions
- Listen-to-talk ratio should be 70/30
- Document buying process and decision makers
- Identify timeline and budget indicators
- Prepare objection responses`,
    },
    proposal_outline: {
        description: 'Create proposal outlines tailored to prospect needs.',
        instructionPrompt: `You are creating a Proposal Outline.

Structure:
1. Executive summary — their problem, our solution
2. Understanding of needs — mirror their words back
3. Proposed solution — tailored to their requirements
4. Methodology / approach — how we'll deliver
5. Timeline — phases and milestones
6. Investment — pricing structure
7. Team — who will work on this
8. Case studies — relevant success stories
9. Next steps — clear path forward

Rules:
- Lead with their problem, not our capabilities
- Use their language and terminology
- Include 2-3 pricing options
- Add relevant social proof
- Keep executive summary to one page`,
    },
    proposal_draft: {
        description: 'Draft complete business proposals ready for client review.',
        instructionPrompt: `You are writing a full Business Proposal.

Structure:
1. Cover page — professional, branded
2. Executive summary (1 page)
3. Situation analysis — current challenges
4. Proposed solution — detailed scope
5. Deliverables — specific outputs  
6. Methodology — step-by-step process
7. Timeline — Gantt-style phases
8. Investment / Pricing — detailed breakdown
9. Team bios — relevant experience
10. Case studies — 2-3 examples
11. Terms and conditions
12. Appendix — supporting data

Rules:
- Customize heavily for each prospect
- Address objections proactively
- Include ROI calculations
- Use professional formatting
- Keep it under 15 pages`,
    },
    follow_up_email: {
        description: 'Write follow-up emails that move deals forward.',
        instructionPrompt: `You are writing a follow-up email.

Types:
A) Post-meeting follow-up:
- Recap key points discussed
- Confirm next steps
- Attach relevant resources

B) Nurture follow-up:
- Share relevant insight or resource
- Reference previous conversation
- Soft re-engagement CTA

C) Break-up email:
- Acknowledge silence respectfully
- Provide final value
- Leave door open

Rules:
- Add new value in every follow-up
- Reference previous interactions specifically
- Keep under 100 words for nurture
- Include clear next step
- Space follow-ups appropriately (3-5 business days)`,
    },
    objection_handling: {
        description: 'Prepare responses to common sales objections.',
        instructionPrompt: `You are preparing Objection Handling responses.

Format per objection:
1. Objection — exact words prospect uses
2. Psychology — why they're saying this
3. Acknowledge — validate their concern
4. Reframe — shift perspective
5. Evidence — proof to support your reframe
6. Bridge — connect back to value
7. Check — confirm the concern is addressed

Common categories:
- Price / Budget
- Timing
- Competition
- Authority / Decision process
- Need / Status quo

Rules:
- Never argue — acknowledge first
- Use "feel, felt, found" framework where appropriate
- Have 2-3 responses per objection
- Include specific data points
- Practice delivery, not just words`,
    },
    buyer_specific_pitch: {
        description: 'Tailor pitches to specific buyer personas and roles.',
        instructionPrompt: `You are creating a Buyer-Specific Pitch.

Structure:
1. Buyer profile — role, responsibilities, KPIs
2. Their world — daily challenges and pressures
3. Hook — opening that resonates with their role
4. Value props — benefits framed for their KPIs
5. Proof points — examples from similar roles/companies
6. Objection anticipation — pre-handle concerns
7. CTA — role-appropriate next step

Buyer types to consider:
- C-level (ROI, strategy, competitive advantage)
- VP/Director (efficiency, team performance, risk)
- Manager (workflow, tools, daily impact)
- End user (ease of use, time savings)

Rules:
- Speak their language
- Address their specific KPIs
- Use role-relevant metrics
- Match seniority with appropriate detail level`,
    },
    meeting_prep_notes: {
        description: 'Prepare comprehensive meeting preparation notes.',
        instructionPrompt: `You are preparing Meeting Prep Notes.

Structure:
1. Meeting context — purpose, attendees, stage in pipeline
2. Company research — recent news, financials, challenges
3. Attendee profiles — LinkedIn summaries, roles
4. Previous interactions — conversation history summary
5. Agenda — proposed flow with time allocation
6. Key objectives — what we want to achieve
7. Questions to ask — prioritized list
8. Potential objections — with prepared responses
9. Materials to share — decks, case studies, demos
10. Follow-up plan — next steps to propose

Rules:
- Spend 30+ minutes on research
- Find personal connection points
- Identify the decision-making process
- Prepare for multiple scenarios
- Document everything for CRM`,
    },
    sales_summary: {
        description: 'Generate pipeline summaries and sales activity reports.',
        instructionPrompt: `You are creating a Sales Summary report.

Structure:
1. Period overview — dates and scope
2. Key metrics — pipeline value, conversion rates, win rate
3. Deals won — highlights and lessons
4. Deals lost — reasons and learnings
5. Pipeline health — stage distribution
6. Activity metrics — calls, emails, meetings
7. Forecast — next period predictions
8. Action items — priorities for next period

Rules:
- Use data, not opinions
- Include trend comparisons (vs last period)
- Highlight at-risk deals
- Celebrate wins with context
- Keep to one page for executives`,
    },
    lead_discovery: {
        description: 'Research and identify potential leads matching your ideal customer profile.',
        instructionPrompt: `You are conducting Lead Discovery research.

Structure:
1. Ideal Customer Profile recap — industry, size, signals
2. Target companies — list with research summary
3. Key contacts — names, roles, LinkedIn profiles
4. Trigger events — recent news, hiring, funding
5. Pain hypotheses — likely challenges per company
6. Personalization hooks — specific angles for outreach
7. Prioritization — ranked by fit and timing

Rules:
- Focus on quality over quantity
- Include specific personalization data
- Verify contact information
- Note competitor presence
- Suggest multi-channel approach per lead`,
    },

    // ─── ONBOARDING ────────────────────────────────────
    welcome_guide: {
        description: 'Create welcoming onboarding guides for new team members.',
        instructionPrompt: `You are creating a Welcome Guide for new employees.

Structure:
1. Welcome message — warm, personal from leadership
2. Company overview — mission, values, culture
3. First week checklist — day-by-day plan
4. Key contacts — who to reach out to for what
5. Tools and access — accounts to set up
6. Communication norms — channels, response times
7. FAQ — common new hire questions
8. Fun facts — team traditions, inside tips

Rules:
- Be warm and encouraging
- Focus on making them feel included
- Include practical how-to information
- Avoid information overload
- Add personality and culture cues`,
    },
    role_onboarding_plan: {
        description: 'Design structured onboarding plans specific to each role.',
        instructionPrompt: `You are creating a Role-Specific Onboarding Plan.

Structure:
Week 1: Orientation & Setup
- Company overview, tools, key meetings

Week 2: Team Integration
- Shadow sessions, workflow introduction

Week 3-4: Guided Work
- First assignments with support

Month 2: Growing Independence
- Own projects, regular check-ins

Month 3: Full Contribution
- Independent work, 90-day review

Include for each phase:
- Learning objectives
- Activities and tasks
- Resources and materials
- Check-in points
- Success metrics

Rules:
- Customize for the specific role
- Include both technical and cultural goals
- Build in feedback loops
- Assign a buddy/mentor
- Set clear 30-60-90 day expectations`,
    },
    training_materials: {
        description: 'Develop training materials and learning resources.',
        instructionPrompt: `You are creating Training Materials.

Structure:
1. Learning objectives — what they'll be able to do after
2. Prerequisites — what they should know before
3. Content sections — organized by topic
4. Exercises — hands-on practice for each section
5. Quiz/Assessment — verify understanding
6. Reference guide — quick-reference summary
7. Additional resources — further learning

Rules:
- Use progressive complexity
- Include real-world examples
- Add visual aids and diagrams
- Keep each section to 15-20 minutes
- Include both reading and doing activities`,
    },
    faq_document: {
        description: 'Compile frequently asked questions and clear answers.',
        instructionPrompt: `You are creating an FAQ Document.

Structure:
Categories:
- Getting Started
- Tools & Access
- Processes & Workflows
- HR & Benefits
- Culture & Communication
- Technical Questions

Per question:
- Question — phrased as employees would ask it
- Answer — clear, concise (2-4 sentences)
- Links — resources for more detail
- Contact — who to ask for more help

Rules:
- Use natural language for questions
- Keep answers concise and actionable
- Link to detailed docs where available
- Update regularly based on actual questions
- Include search-friendly keywords`,
    },
    process_documentation: {
        description: 'Document company processes and standard operating procedures.',
        instructionPrompt: `You are writing Process Documentation (SOP).

Structure:
1. Process name and purpose
2. Scope — what it covers and doesn't
3. Roles and responsibilities — who does what
4. Prerequisites — what's needed before starting
5. Step-by-step procedure — numbered, detailed
6. Decision points — if/then branches
7. Tools required — software, templates
8. Quality checkpoints — verification steps
9. Troubleshooting — common issues and solutions
10. Revision history

Rules:
- Write for someone doing this for the first time
- Include screenshots where helpful
- Number every step
- Highlight critical decision points
- Include expected time per step`,
    },
    team_introduction: {
        description: 'Create team introduction documents for new hires.',
        instructionPrompt: `You are creating a Team Introduction document.

Structure:
1. Team overview — mission and goals
2. Team structure — org chart or hierarchy
3. Team members — name, role, expertise, fun fact
4. How we work — rituals, meetings, communication
5. Current projects — what the team is working on
6. Team norms — expectations and agreements
7. Social — team traditions, channels
8. Contact guide — who to reach out to for what

Rules:
- Make it personal and welcoming
- Include photos if possible
- Highlight each person's expertise area
- Show how roles interconnect
- Include informal/social information`,
    },

    // ─── COMPANY ADVISOR ───────────────────────────────
    strategy_brief: {
        description: 'Draft strategic briefs for business initiatives.',
        instructionPrompt: `You are creating a Strategy Brief.

Structure:
1. Executive summary — one paragraph
2. Strategic context — market situation
3. Objective — specific, measurable goal
4. Strategy — how to achieve the objective
5. Key initiatives — 3-5 action areas
6. Resource requirements — budget, team, time
7. Risks and mitigations
8. Success metrics and timeline
9. Decision needed — clear ask

Rules:
- Keep the entire brief to 2-3 pages
- Be specific about outcomes, not activities
- Include data to support recommendations
- Address the "so what" for each point
- Make the ask clear and actionable`,
    },
    market_analysis: {
        description: 'Analyze market dynamics, trends, and opportunities.',
        instructionPrompt: `You are conducting a Market Analysis.

Structure:
1. Market overview — size, growth rate, trends
2. Market segmentation — key segments and characteristics
3. Customer analysis — needs, behaviors, preferences
4. Competitive landscape — key players and positioning
5. Industry trends — technology, regulation, social
6. Market drivers and barriers
7. Opportunity assessment — where to play
8. Recommendations — strategic implications

Rules:
- Use data and sources where possible
- Distinguish between trends and fads
- Include both macro and micro analysis
- Quantify market opportunity
- Identify white spaces and gaps`,
    },
    competitive_analysis: {
        description: 'Evaluate competitive positions and identify strategic advantages.',
        instructionPrompt: `You are conducting a Competitive Analysis.

Structure:
1. Competitive landscape overview
2. Per competitor:
   - Company overview
   - Product/service comparison
   - Pricing strategy
   - Market positioning
   - Strengths and weaknesses
   - Recent moves and strategy
3. Competitive matrix — feature comparison table
4. Our competitive advantages
5. Threats and vulnerabilities
6. Strategic recommendations

Rules:
- Be objective, not dismissive of competitors
- Include both direct and indirect competitors
- Focus on customer-relevant differentiators
- Update regularly (competitive landscapes shift)
- Identify actionable insights, not just data`,
    },
    business_plan: {
        description: 'Create comprehensive business plans for new ventures or initiatives.',
        instructionPrompt: `You are writing a Business Plan.

Structure:
1. Executive summary (1 page)
2. Company description — mission, vision, values
3. Market analysis — opportunity and trends
4. Products/Services — offerings and differentiation
5. Marketing strategy — go-to-market plan
6. Operations plan — how you'll deliver
7. Team and organization
8. Financial projections — 3-year forecast
9. Funding requirements — if applicable
10. Appendix — supporting data

Rules:
- Lead with the problem and opportunity
- Back claims with market data
- Be realistic with financial projections
- Address risks and contingencies
- Keep it concise but comprehensive`,
    },
    swot_analysis: {
        description: 'Perform SWOT analysis to evaluate strategic position.',
        instructionPrompt: `You are performing a SWOT Analysis.

Structure:
1. Strengths (Internal, Positive)
   - What we do well
   - Unique resources and capabilities
   - Competitive advantages

2. Weaknesses (Internal, Negative)
   - Areas for improvement
   - Resource gaps
   - Known limitations

3. Opportunities (External, Positive)
   - Market trends favorings us
   - Unmet customer needs
   - Partnership possibilities

4. Threats (External, Negative)
   - Competitive pressures
   - Market shifts
   - Regulatory changes

5. Cross-analysis — SO, WO, ST, WT strategies
6. Priority actions — top 3 items per quadrant

Rules:
- Be honest and evidence-based
- Prioritize items by impact
- Connect insights to actionable strategies
- Consider both short and long-term
- Involve multiple perspectives`,
    },
    investment_memo: {
        description: 'Prepare investment memos for funding decisions.',
        instructionPrompt: `You are writing an Investment Memo.

Structure:
1. Executive summary — the opportunity in one paragraph
2. Company overview — what they do and for whom
3. Market opportunity — TAM, SAM, SOM with evidence
4. Product/Technology — competitive moat
5. Business model — how they make money
6. Traction — key metrics and growth
7. Team — leadership backgrounds
8. Financial summary — revenue, burn, projections
9. Use of funds — allocation breakdown
10. Risks — key risks and mitigations
11. Terms — deal structure
12. Recommendation — invest/pass with rationale

Rules:
- Be objective and analytical
- Include both bull and bear cases
- Back every claim with data
- Compare to relevant benchmarks
- Make a clear recommendation with rationale`,
    },
};

async function main() {
    console.log('Backfilling skill content...\n');

    const { data: skills, error } = await supabase
        .from('AssistantSkill')
        .select('id, key, name, description, instructionPrompt')
        .is('instructionPrompt', null);

    if (error) { console.error(error); return; }
    console.log(`Found ${skills.length} skills without instruction prompts.\n`);

    let updated = 0;
    for (const skill of skills) {
        const content = SKILL_CONTENT[skill.key];
        if (!content) { console.log(`  ⏭ No content for: ${skill.key}`); continue; }

        const { error: upErr } = await supabase
            .from('AssistantSkill')
            .update({
                description: content.description,
                instructionPrompt: content.instructionPrompt,
                updatedAt: new Date().toISOString(),
            })
            .eq('id', skill.id);

        if (upErr) {
            console.error(`  ✗ ${skill.key}:`, upErr.message);
        } else {
            updated++;
            console.log(`  ✓ ${skill.key}`);
        }
    }

    console.log(`\nDone. Updated: ${updated}/${skills.length}`);
}

main();
