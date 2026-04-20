const { config } = require('dotenv');
config();
const { Client } = require('pg');

async function main() {
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    await client.query("NOTIFY pgrst, 'reload schema'");
    console.log('✓ Schema cache reload notified');
    await client.end();
}

main().catch(err => { console.error('FATAL:', err.message); process.exit(1); });
