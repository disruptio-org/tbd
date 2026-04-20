import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const db = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

const logoPath = process.argv[2];
if (!logoPath) { console.error('Usage: node scripts/upload_brand_asset.mjs <path>'); process.exit(1); }

const fileBuffer = fs.readFileSync(logoPath);
const BUCKET = 'brand-assets';
const KEY = 'moby-logo.png';

// Ensure public bucket exists
const { data: buckets } = await db.storage.listBuckets();
if (!buckets?.find(b => b.name === BUCKET)) {
    const { error: createErr } = await db.storage.createBucket(BUCKET, { public: true });
    if (createErr) console.error('Bucket create error:', createErr.message);
    else console.log('Created public bucket:', BUCKET);
} else {
    console.log('Bucket exists:', BUCKET);
}

// Upload the logo
const { error: upErr } = await db.storage.from(BUCKET).upload(KEY, fileBuffer, {
    contentType: 'image/png',
    upsert: true,
});
if (upErr) { console.error('Upload error:', upErr.message); process.exit(1); }

// Get public URL
const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(KEY);
console.log('Public URL:', urlData.publicUrl);

process.exit(0);
