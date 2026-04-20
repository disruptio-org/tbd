# 04 — Deployment & Infrastructure

## Hosting Model

| Component | Provider | Type |
|-----------|----------|------|
| Application | Vercel or self-hosted VM | Serverless (Vercel) or Node.js process |
| Database | Supabase Cloud | Managed PostgreSQL |
| File Storage | Supabase Storage | Managed S3-compatible |
| Authentication | Supabase Auth | Managed identity provider |
| AI Services | OpenAI Cloud | External API |

## Build Process

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Build Next.js production bundle
npm run build

# Start production server
npm start
```

## Deployment Flow

### Vercel (Primary)
1. Push to `main` branch
2. Vercel auto-detects Next.js project
3. Runs `npm run build` 
4. Deploys to serverless functions + edge CDN
5. Environment variables configured in Vercel dashboard

### Self-Hosted VM
1. SSH into server
2. `git pull` latest code
3. `npm install && npm run build`
4. Restart process manager (PM2 or systemd)
5. Environment variables in `.env.local`

## Database Migrations

| Command | Purpose |
|---------|---------|
| `npx prisma db push` | Push schema changes to DB (development) |
| `npx prisma migrate dev` | Create migration files (development) |
| `npx prisma migrate deploy` | Apply migrations (production) |
| `npx prisma studio` | Visual database browser |

> ⚠️ **CRITICAL**: Never use `prisma db push --force-reset` on a production database. This destroys all data.

## Rollback Strategy

- **Application**: Revert git commit and redeploy
- **Database**: No automated rollback; would require manual migration reversal
- **Prisma migrations**: Can create "down" migrations manually if needed
- **Feature rollback**: Disable features via Backoffice `CompanyFeature` toggles

## Storage Dependencies

| Service | Usage | Criticality |
|---------|-------|-------------|
| Supabase PostgreSQL | All application data | Critical |
| Supabase Storage | Uploaded document files | Critical |
| OpenAI API | AI generation + embeddings | Critical (AI features) |

## Scaling Approach

### Current
- Single deployment (monolithic Next.js)
- Serverless auto-scaling on Vercel (per-function)
- Database connection pooling via Supabase PgBouncer

### Future Considerations
- **Background job queue** (BullMQ/Redis) for AI processing
- **Caching layer** (Redis) for frequent queries
- **CDN** for static assets (handled by Vercel)
- **Read replicas** for heavy read workloads

## Backup Strategy

- **Database**: Supabase automated daily backups (configurable retention)
- **Storage**: Supabase Storage redundancy (managed)
- **Application code**: Git (version control)
- **Environment config**: Manual backup of `.env.local`

## Disaster Recovery

| Scenario | Recovery |
|----------|----------|
| Database corruption | Restore from Supabase backup |
| Application crash | Redeploy from latest stable commit |
| Storage failure | Supabase managed redundancy |
| OpenAI outage | AI features unavailable; core CRUD still works |
| Supabase outage | Full application downtime (critical dependency) |
