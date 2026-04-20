import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data: users, error } = await supabase
    .from('User')
    .select('id, email, role')
    .order('createdAt', { ascending: true });

if (error) {
    console.error('Error:', error.message);
    process.exit(1);
}

console.log(`\nFound ${users.length} user(s):`);
for (const u of users) {
    console.log(`  - ${u.email} (${u.role})`);
}

if (users.length === 0) {
    console.log('\nNo users yet. Please log in at http://localhost:3000/login first.');
    console.log('Then re-run: node scripts/set_super_admin.mjs');
    process.exit(0);
}

const target = users[0];
if (target.role === 'SUPER_ADMIN') {
    console.log(`\n${target.email} is already SUPER_ADMIN.`);
    process.exit(0);
}

const { error: updateErr } = await supabase
    .from('User')
    .update({ role: 'SUPER_ADMIN' })
    .eq('id', target.id);

if (updateErr) {
    console.error('Update error:', updateErr.message);
    process.exit(1);
}

console.log(`\nDone! ${target.email} is now SUPER_ADMIN!`);
console.log('Go to: http://localhost:3000/backoffice');
