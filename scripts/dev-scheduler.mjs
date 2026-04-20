/**
 * Local Dev Scheduler — polls /api/skills/scheduler every 60s
 * 
 * Usage: node scripts/dev-scheduler.mjs
 * 
 * This replicates what Vercel Cron does in production (every 10 min).
 * For local dev we poll every 60s for faster feedback.
 */

const SCHEDULER_URL = 'http://localhost:5000/api/skills/scheduler';
const POLL_INTERVAL_MS = 60_000; // 1 minute

async function tick() {
    const now = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    try {
        const res = await fetch(SCHEDULER_URL, { signal: AbortSignal.timeout(90_000) });
        const data = await res.json();
        if (data.ran > 0 || data.failed > 0) {
            console.log(`[${now}] ⚡ Scheduler: ${data.ran} ran, ${data.failed} failed, ${data.skipped} skipped`);
            if (data.results) {
                for (const r of data.results) {
                    console.log(`  → ${r.skillName}: ${r.status}${r.error ? ` (${r.error})` : ''}`);
                }
            }
        } else {
            console.log(`[${now}] ✓ No due schedules`);
        }
    } catch (err) {
        console.error(`[${now}] ✗ Scheduler error:`, err.message);
    }
}

console.log('🕐 Dev Scheduler started — polling every 60s');
console.log(`   Target: ${SCHEDULER_URL}`);
console.log('   Press Ctrl+C to stop\n');

// Run immediately, then every interval
tick();
setInterval(tick, POLL_INTERVAL_MS);
