const { config } = require('dotenv');
config();
const { Client } = require('pg');

async function main() {
    const c = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await c.connect();
    const r = await c.query(
        `UPDATE "SkillSchedule" SET "showOnToday"=true, "includeInBrief"=true WHERE "name" LIKE '%Daily AI Trends%' RETURNING id, name, "showOnToday", "includeInBrief"`
    );
    console.log('Updated:', JSON.stringify(r.rows, null, 2));
    await c.end();
}
main().catch(e => console.error(e.message));
