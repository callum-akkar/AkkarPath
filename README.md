# Akkar Commissions

A recruitment commission management system built for Akkar. Syncs placements and timesheets from Salesforce, calculates commissions using configurable multi-component plans, and handles the full approval-to-payment workflow.

## Features

### Commission Engine
- **Multi-component plans** — Permanent placements, contract placements, timesheets, flat bonuses, kickers, and manager overrides as separate configurable components
- **Tiered rates** — Different commission rates based on deal value ranges
- **Account filters** — Restrict components to specific client accounts (e.g. Mobileye contracts only)
- **Kicker bonuses** — Retroactive bonus that activates when cumulative NFI crosses a threshold
- **Manager overrides** — Automatic override commission on direct reports' deals
- **Clawback handling** — Negative offsetting entries; PAID entries are never deleted
- **Backdating** — Commission entries can reference a prior period
- **Financial precision** — All monetary calculations use Decimal.js (no floating point)
- **GBP base currency**

### Integrations
- **Salesforce** — Sync placements and timesheets via JSforce. Configurable custom object field names. Clawback detection via negative NFI values.
- **HiBob** — Sync salary, job title, and department from HR system

### Dashboards
- **REP view** — Personal KPIs, target progress bar, NFI vs target chart, monthly commission breakdown
- **Manager view** — Own data plus team table with commission drill-down per member
- **Admin view** — Full system: all users, all data, plan builder, sync controls, calculation triggers

### Workflow
- Commission statuses: `PENDING` → `APPROVED` → `PAID` (with `HELD` for exceptions)
- Bulk approve/pay by period
- Individual hold/release with reason tracking
- Manual commission entries and bonus payouts
- Audit trail on every entry (who created it, when, from what source)

### Exports
- CSV exports: all commissions, placement-only, timesheet-only, payroll report, paid commissions
- Filterable by period and export type

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Database | PostgreSQL via Prisma ORM |
| Auth | NextAuth.js (credentials + JWT sessions) |
| CRM Sync | JSforce (Salesforce REST API) |
| HR Sync | HiBob REST API |
| Calculations | Decimal.js |
| Charts | Recharts |
| Styling | Tailwind CSS |
| Email | Resend (optional) |

## Quick Start

```bash
# Install dependencies
npm install

# Generate Prisma client
npx prisma generate

# Push schema to PostgreSQL
npx prisma db push

# Seed with sample data
npx tsx prisma/seed.ts

# Start dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Demo Credentials

All seed accounts use password `akkar2026`:

| Role    | Email               |
|---------|---------------------|
| Admin   | callum@akkar.com    |
| Manager | manager@akkar.com   |
| Rep     | mike@akkar.com      |
| Rep     | emily@akkar.com     |

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── auth/[...nextauth]/  # NextAuth handler
│   │   ├── bonus/               # Bonus entries
│   │   ├── commissions/         # CRUD, calculate, approve, pay, export
│   │   ├── dashboard/           # Dashboard data (role-filtered)
│   │   ├── plans/               # Plans, components, assignments
│   │   ├── sync/                # Salesforce + HiBob sync triggers
│   │   ├── targets/             # Monthly NFI targets
│   │   └── users/               # User management
│   ├── dashboard/
│   │   ├── admin/               # Admin console (users, sync, calculate)
│   │   ├── commissions/         # Commission entries table
│   │   ├── plans/               # Plan builder + assignments
│   │   ├── reports/             # Reports + CSV exports
│   │   ├── targets/             # Target management grid
│   │   └── team/                # Team view with drill-down
│   └── login/                   # Login page
├── components/
│   └── Sidebar.tsx              # Role-aware navigation
├── lib/
│   ├── auth.ts                  # NextAuth config + role helpers
│   ├── commission-engine.ts     # Core calculation engine
│   ├── db.ts                    # Prisma client singleton
│   ├── hibob.ts                 # HiBob API service
│   └── salesforce.ts            # Salesforce sync service
prisma/
├── schema.prisma                # PostgreSQL schema
└── seed.ts                      # Sample data seeder
scripts/
└── migrate-quotapath.ts         # QuotaPath CSV import tool
```

## Environment Variables

Copy `.env.example` to `.env` and configure:

```bash
# Database (required)
DATABASE_URL="postgresql://user:password@localhost:5432/akkar_commissions"

# Auth (required)
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Salesforce (required for sync)
SF_LOGIN_URL="https://login.salesforce.com"
SF_USERNAME="integration@akkar.com"
SF_PASSWORD="password"
SF_SECURITY_TOKEN="token"

# HiBob (optional)
HIBOB_API_URL="https://api.hibob.com/v1"
HIBOB_API_TOKEN="your-token"
HIBOB_COMPANY_ID="akkar"
```

See `.env.example` for the full list including Salesforce field name mappings.

## Monthly Workflow

1. **Sync** — Admin console → Data Sync → Run Salesforce Sync
2. **Calculate** — Admin console → Calculate & Pay → Run Calculation for the period
3. **Review** — Commissions page → Review entries, hold anything that needs investigation
4. **Approve** — Bulk approve pending entries
5. **Pay** — Mark approved entries as paid after payroll runs
6. **Export** — Reports → Download CSV for payroll/accounting

## Migrating from QuotaPath

Export your historical data from QuotaPath as CSV, then:

```bash
# Preview what will be imported
npx tsx scripts/migrate-quotapath.ts exported-data.csv --dry-run

# Run the import
npx tsx scripts/migrate-quotapath.ts exported-data.csv
```

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full deployment instructions covering Railway, AWS ECS + RDS, and Vercel.

## Access Control

| Action | Admin | Manager | Rep |
|--------|-------|---------|-----|
| View own commissions | Yes | Yes | Yes |
| View team commissions | Yes | Yes | No |
| View all commissions | Yes | No | No |
| Approve commissions | Yes | Yes (team only) | No |
| Mark as paid | Yes | No | No |
| Create/edit plans | Yes | No | No |
| Assign plans | Yes | No | No |
| Manage targets | Yes | No | No |
| Manage users | Yes | No | No |
| Run SF/HiBob sync | Yes | No | No |
| Run commission calculation | Yes | No | No |
| Export CSVs | Yes | No | No |
