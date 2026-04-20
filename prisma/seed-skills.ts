// ═══════════════════════════════════════════════════════
// Seed: Assistant Skills
// Extracts all hardcoded content types from assistant pages
// and seeds them as AssistantSkill rows for every company.
//
// Usage: npx tsx prisma/seed-skills.ts
// ═══════════════════════════════════════════════════════

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ─── All default skills, extracted from the assistant pages ───

interface SkillDef {
    key: string;
    name: string;
    icon: string;
    description?: string;
    category?: string;
}

const DEFAULT_SKILLS: Record<string, SkillDef[]> = {
    MARKETING: [
        { key: 'linkedin_post',        name: 'LinkedIn Post',        icon: 'briefcase',     category: 'social_media' },
        { key: 'website_copy',         name: 'Website Copy',         icon: 'globe',         category: 'web' },
        { key: 'blog_idea',            name: 'Blog / Article',       icon: 'pen-line',      category: 'content' },
        { key: 'newsletter',           name: 'Newsletter',           icon: 'mail',          category: 'email' },
        { key: 'content_plan',         name: 'Content Plan',         icon: 'calendar-days', category: 'planning' },
        { key: 'campaign_idea',        name: 'Campaign Idea',        icon: 'rocket',        category: 'campaigns' },
        { key: 'service_description',  name: 'Service Description',  icon: 'tag',           category: 'web' },
    ],
    PRODUCT_ASSISTANT: [
        { key: 'prd',                  name: 'PRD',                  icon: 'clipboard-list', category: 'requirements' },
        { key: 'brd',                  name: 'Business Req',         icon: 'briefcase',      category: 'requirements' },
        { key: 'functional_spec',      name: 'Functional Spec',      icon: 'settings',       category: 'requirements' },
        { key: 'technical_brief',      name: 'Technical Brief',      icon: 'wrench',         category: 'engineering' },
        { key: 'user_stories',         name: 'User Stories',         icon: 'user',           category: 'requirements' },
        { key: 'acceptance_criteria',  name: 'Acceptance Criteria',  icon: 'check-square',   category: 'requirements' },
        { key: 'feature_breakdown',    name: 'Feature Breakdown',    icon: 'puzzle',         category: 'planning' },
        { key: 'product_positioning',  name: 'Product Positioning',  icon: 'target',         category: 'strategy' },
        { key: 'brand_positioning',    name: 'Brand Positioning',    icon: 'tag',            category: 'strategy' },
        { key: 'vibe_coding_spec',     name: 'Vibe Coding Spec',     icon: 'rocket',         category: 'engineering' },
        { key: 'roadmap',              name: 'Roadmap',              icon: 'map',            category: 'planning' },
        { key: 'epic_breakdown',       name: 'Epic + Tasks',         icon: 'package',        category: 'planning' },
        { key: 'api_draft',            name: 'API + Entities',       icon: 'plug',           category: 'engineering' },
        { key: 'discovery_analysis',   name: 'Discovery Analysis',   icon: 'microscope',     category: 'research' },
    ],
    SALES: [
        { key: 'outreach_email',       name: 'Outreach Email',       icon: 'mail',           category: 'outreach' },
        { key: 'linkedin_message',     name: 'LinkedIn Message',     icon: 'briefcase',      category: 'outreach' },
        { key: 'discovery_call_plan',  name: 'Discovery Call Plan',  icon: 'phone',          category: 'calls' },
        { key: 'proposal_outline',     name: 'Proposal Outline',     icon: 'clipboard-list', category: 'proposals' },
        { key: 'proposal_draft',       name: 'Full Proposal',        icon: 'file-text',      category: 'proposals' },
        { key: 'follow_up_email',      name: 'Follow-Up Email',      icon: 'refresh-cw',     category: 'outreach' },
        { key: 'objection_handling',   name: 'Objection Handling',   icon: 'shield',         category: 'conversations' },
        { key: 'buyer_specific_pitch', name: 'Buyer-Specific Pitch', icon: 'target',         category: 'conversations' },
        { key: 'meeting_prep_notes',   name: 'Meeting Prep Notes',   icon: 'pen-line',       category: 'calls' },
        { key: 'sales_summary',        name: 'Sales Summary',        icon: 'bar-chart-3',    category: 'reporting' },
        { key: 'lead_discovery',       name: 'Lead Discovery',       icon: 'search',         category: 'prospecting' },
    ],
    ONBOARDING: [
        { key: 'welcome_guide',        name: 'Welcome Guide',        icon: 'book-open',      category: 'guides' },
        { key: 'role_onboarding_plan', name: 'Role Onboarding Plan', icon: 'clipboard-list', category: 'planning' },
        { key: 'training_materials',   name: 'Training Materials',   icon: 'file-text',      category: 'training' },
        { key: 'faq_document',         name: 'FAQ Document',         icon: 'help-circle',    category: 'documentation' },
        { key: 'process_documentation',name: 'Process Documentation',icon: 'cog',            category: 'documentation' },
        { key: 'team_introduction',    name: 'Team Introduction',    icon: 'users',          category: 'guides' },
    ],
    COMPANY_ADVISOR: [
        { key: 'strategy_brief',       name: 'Strategy Brief',       icon: 'trending-up',    category: 'strategy' },
        { key: 'market_analysis',      name: 'Market Analysis',      icon: 'bar-chart-3',    category: 'analysis' },
        { key: 'competitive_analysis', name: 'Competitive Analysis', icon: 'target',         category: 'analysis' },
        { key: 'business_plan',        name: 'Business Plan',        icon: 'clipboard-list', category: 'strategy' },
        { key: 'swot_analysis',        name: 'SWOT Analysis',        icon: 'crosshair',      category: 'analysis' },
        { key: 'investment_memo',      name: 'Investment Memo',      icon: 'file-text',      category: 'finance' },
    ],
};

async function main() {
    console.log('🔧 Seeding assistant skills...\n');

    // Get all companies
    const companies = await prisma.company.findMany({ select: { id: true, name: true } });
    console.log(`Found ${companies.length} companies.\n`);

    let created = 0;
    let skipped = 0;

    for (const company of companies) {
        console.log(`  📦 ${company.name} (${company.id})`);

        for (const [assistantType, skills] of Object.entries(DEFAULT_SKILLS)) {
            for (let i = 0; i < skills.length; i++) {
                const skill = skills[i];
                try {
                    await prisma.assistantSkill.upsert({
                        where: {
                            companyId_assistantType_key: {
                                companyId: company.id,
                                assistantType,
                                key: skill.key,
                            },
                        },
                        update: {}, // Don't overwrite existing customizations
                        create: {
                            companyId: company.id,
                            assistantType,
                            key: skill.key,
                            name: skill.name,
                            icon: skill.icon,
                            category: skill.category || null,
                            description: skill.description || null,
                            status: 'ACTIVE',
                            sortOrder: i,
                            isDefault: true,
                            version: 1,
                        },
                    });
                    created++;
                } catch {
                    skipped++;
                }
            }
        }
    }

    console.log(`\n✅ Done. Created: ${created}, Skipped: ${skipped}`);
}

main()
    .catch((e) => { console.error(e); process.exit(1); })
    .finally(() => prisma.$disconnect());
