const { config } = require('dotenv');
config();
const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    console.log('Connected to PostgreSQL');

    try {
        await client.query(`ALTER TABLE "SkillSchedule" ADD COLUMN IF NOT EXISTS "showOnToday" BOOLEAN NOT NULL DEFAULT false`);
        console.log('✓ showOnToday column added');
    } catch (err) {
        console.log('showOnToday:', err.message);
    }

    try {
        await client.query(`ALTER TABLE "SkillSchedule" ADD COLUMN IF NOT EXISTS "includeInBrief" BOOLEAN NOT NULL DEFAULT false`);
        console.log('✓ includeInBrief column added');
    } catch (err) {
        console.log('includeInBrief:', err.message);
    }

    // Reload PostgREST schema cache
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('✓ Schema cache reloaded');

    await client.end();
    console.log('Done!');
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
