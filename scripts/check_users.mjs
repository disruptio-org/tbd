import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

// Check auth users (Supabase auth, not our User table)
console.log('--- Supabase Auth Users ---');
const { data: authData, error: authErr } = await supabase.auth.admin.listUsers();
if (authErr) {
    console.error('Auth error:', authErr.message);
} else {
    console.log(`Found ${authData.users.length} auth user(s):`);
    for (const u of authData.users) {
        console.log(`  - ${u.email} (id: ${u.id})`);
    }
}

// Check our User table
console.log('\n--- User Table ---');
const { data: users, error } = await supabase
    .from('User')
    .select('id, email, role, companyId')
    .order('createdAt', { ascending: true });

if (error) {
    console.error('User table error:', error.message);
} else {
    console.log(`Found ${users.length} user(s) in User table:`);
    for (const u of users) {
        console.log(`  - ${u.email} (${u.role})`);
    }
}

// Check Company table
console.log('\n--- Company Table ---');
const { data: companies, error: compErr } = await supabase
    .from('Company')
    .select('id, name, plan');

if (compErr) {
    console.error('Company table error:', compErr.message);
} else {
    console.log(`Found ${companies.length} company(ies):`);
    for (const c of companies) {
        console.log(`  - ${c.name} (${c.plan})`);
    }
}
