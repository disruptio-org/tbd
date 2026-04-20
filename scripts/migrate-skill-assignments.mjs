/**
 * Data Migration: Populate SkillAssignment from AssistantSkill.assistantType
 *
 * For every existing AssistantSkill row that has an assistantType value,
 * create a corresponding SkillAssignment row.
 *
 * Run with: node scripts/migrate-skill-assignments.mjs
 */

import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const db = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

async function migrate() {
    console.log('📦 Fetching all AssistantSkill rows with assistantType...');

    const { data: skills, error } = await db
        .from('AssistantSkill')
        .select('id, assistantType, key, companyId')
        .not('assistantType', 'is', null);

    if (error) {
        console.error('❌ Error fetching skills:', error.message);
        process.exit(1);
    }

    console.log(`Found ${skills.length} skills to migrate.`);

    if (skills.length === 0) {
        console.log('✅ Nothing to migrate.');
        return;
    }

    // Check for duplicate (companyId, key) combos
    const seen = new Map();
    const duplicates = [];
    for (const s of skills) {
        const companyKey = `${s.companyId}::${s.key}`;
        if (seen.has(companyKey)) {
            duplicates.push({ existing: seen.get(companyKey), duplicate: s });
        } else {
            seen.set(companyKey, s);
        }
    }

    if (duplicates.length > 0) {
        console.warn(`⚠️  Found ${duplicates.length} duplicate (companyId, key) combos:`);
        for (const d of duplicates) {
            console.warn(`   key="${d.duplicate.key}" company=${d.duplicate.companyId}`);
            console.warn(`     existing: type=${d.existing.assistantType} id=${d.existing.id}`);
            console.warn(`     duplicate: type=${d.duplicate.assistantType} id=${d.duplicate.id}`);

            // Resolve: rename duplicate key with suffix
            const newKey = `${d.duplicate.key}_${d.duplicate.assistantType.toLowerCase()}`;
            console.warn(`     → Renaming to "${newKey}"`);
            const { error: renameErr } = await db
                .from('AssistantSkill')
                .update({ key: newKey })
                .eq('id', d.duplicate.id);
            if (renameErr) {
                console.error(`   ❌ Failed to rename: ${renameErr.message}`);
            }
        }
    }

    // Create SkillAssignment rows
    const assignments = skills.map(s => ({
        id: crypto.randomUUID(),
        skillId: s.id,
        assistantType: s.assistantType,
    }));

    console.log(`📝 Creating ${assignments.length} SkillAssignment rows...`);

    // Insert in batches of 100
    for (let i = 0; i < assignments.length; i += 100) {
        const batch = assignments.slice(i, i + 100);
        const { error: insertErr } = await db.from('SkillAssignment').insert(batch);
        if (insertErr) {
            console.error(`❌ Error inserting batch ${i / 100 + 1}:`, insertErr.message);
        } else {
            console.log(`   ✅ Batch ${i / 100 + 1}: ${batch.length} rows`);
        }
    }

    console.log('✅ Migration complete!');
}

migrate().catch(err => {
    console.error('❌ Migration failed:', err);
    process.exit(1);
});
