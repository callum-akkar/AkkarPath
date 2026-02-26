# Akkar Commissions — Deployment Guide

## Architecture

- **App**: Next.js 14 (App Router) deployed as a single container
- **Database**: PostgreSQL 15+
- **External Services**: Salesforce (JSforce), HiBob (REST API), Resend (email)

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL 15+ database
- Salesforce Connected App credentials (for SF sync)
- HiBob API credentials (for salary sync)
- Resend API key (for email notifications, optional)

## Environment Variables

Copy `.env.example` to `.env` and fill in all values:

```bash
# Database
DATABASE_URL="postgresql://user:password@host:5432/akkar_commissions?schema=public"

# NextAuth
NEXTAUTH_URL="https://commissions.akkar.com"
NEXTAUTH_SECRET="generate-with: openssl rand -base64 32"

# Salesforce
SF_LOGIN_URL="https://login.salesforce.com"
SF_USERNAME="integration@akkar.com"
SF_PASSWORD="password"
SF_SECURITY_TOKEN="token"
SF_PLACEMENT_OBJECT="Placement__c"
SF_TIMESHEET_OBJECT="Timesheet__c"

# HiBob
HIBOB_API_URL="https://api.hibob.com/v1"
HIBOB_API_TOKEN="your-hibob-api-token"
HIBOB_COMPANY_ID="akkar"

# Resend (optional)
RESEND_API_KEY="re_..."
NOTIFICATION_FROM_EMAIL="commissions@akkar.com"
```

## Quick Start (Local Development)

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to database (creates tables)
npx prisma db push

# Seed with sample data
npx tsx prisma/seed.ts

# Start dev server
npm run dev
```

Default login: `callum@akkar.com` / `akkar2026`

## Database Setup

### Option A: Prisma Push (simple, for dev/staging)
```bash
npx prisma db push
```

### Option B: Prisma Migrate (production, with migration history)
```bash
npx prisma migrate deploy
```

To create a new migration after schema changes:
```bash
npx prisma migrate dev --name describe_your_change
```

## Production Deployment

### Option 1: Railway / Render (Recommended for simplicity)

1. Push code to GitHub
2. Connect repo to Railway or Render
3. Add PostgreSQL addon
4. Set environment variables
5. Build command: `npm run build`
6. Start command: `npm start`
7. Railway auto-deploys on push

**Railway-specific:**
```bash
# Railway will auto-detect Next.js
# Set DATABASE_URL from Railway's PostgreSQL addon
# Add all other env vars in the dashboard
```

### Option 2: AWS ECS + RDS

1. **RDS**: Create PostgreSQL 15 instance (db.t3.medium for production)
2. **ECR**: Build and push Docker image
3. **ECS**: Create Fargate service with task definition
4. **ALB**: Application Load Balancer with HTTPS
5. **Secrets Manager**: Store env vars

```dockerfile
# Dockerfile
FROM node:18-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx prisma generate
RUN npm run build

FROM node:18-alpine AS runner
WORKDIR /app
ENV NODE_ENV production
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
EXPOSE 3000
CMD ["node", "server.js"]
```

Enable standalone output in `next.config.js`:
```js
module.exports = { output: 'standalone' }
```

### Option 3: Vercel

1. Push to GitHub
2. Import project in Vercel
3. Add PostgreSQL (Vercel Postgres or external)
4. Set environment variables
5. Deploy

## Post-Deployment Steps

1. **Run migrations**:
   ```bash
   npx prisma db push  # or npx prisma migrate deploy
   ```

2. **Create admin user** (via seed or manually):
   ```bash
   npx tsx prisma/seed.ts
   ```

3. **Configure Salesforce**:
   - Create a Connected App in Salesforce
   - Set API credentials in env vars
   - Map custom object field names in env vars
   - Test sync from Admin > Data Sync

4. **Configure HiBob** (optional):
   - Get API token from HiBob admin
   - Set credentials in env vars
   - Test sync from Admin > Data Sync

5. **Set up targets**:
   - Admin > Targets: Set monthly NFI targets per team member

6. **Create commission plans**:
   - Admin > Plans: Create plans with components
   - Assign plans to team members

7. **Import QuotaPath data** (if migrating):
   ```bash
   # Export from QuotaPath as CSV
   npx tsx scripts/migrate-quotapath.ts exported-data.csv --dry-run
   # Review output, then:
   npx tsx scripts/migrate-quotapath.ts exported-data.csv
   ```

## Monthly Workflow

1. **Sync data**: Admin > Data Sync > Run Salesforce Sync
2. **Calculate commissions**: Admin > Calculate & Pay > Run Calculation
3. **Review**: Commissions page — review entries, hold/release as needed
4. **Approve**: Bulk approve pending entries
5. **Pay**: Mark approved entries as paid after payroll
6. **Export**: Reports > Export CSV for payroll/accounting

## Monitoring

- Check `/api/dashboard` for system health
- Sync logs are stored in the `SyncLog` table
- Use Prisma Studio for database inspection: `npx prisma studio`

## Backup

For PostgreSQL backups:
```bash
# Dump
pg_dump $DATABASE_URL > backup_$(date +%Y%m%d).sql

# Restore
psql $DATABASE_URL < backup_20260226.sql
```

## Security Notes

- All passwords are hashed with bcrypt (12 rounds)
- JWT sessions expire after 7 days
- Role-based access control: ADMIN > MANAGER > REP
- REPs can only see their own data
- Managers can see their direct reports' data
- Only admins can modify plans, targets, run syncs, and approve payments
- PAID commission entries are never automatically deleted or modified
