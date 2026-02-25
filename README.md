# Akkar Commissions

A simple, self-hosted commission management system for the Akkar team. Track deals, manage compensation plans, calculate commissions, and pay your team — all in one place.

## Features

- **Dashboard** — Real-time overview of revenue, commissions, and team performance with charts
- **Deal Tracking** — Create, edit, and manage sales deals with status tracking (open, closed-won, closed-lost)
- **Commission Plans** — Three plan types:
  - **Flat Rate** — Same percentage on every deal
  - **Tiered** — Different rates based on deal amount ranges
  - **Accelerator** — Higher rates as total volume increases
- **Commission Management** — Auto-calculate commissions, approve, and mark as paid (individually or in bulk)
- **Team Management** — Add team members, assign roles (admin/manager/rep), and assign commission plans
- **Role-Based Access** — Admins see everything; reps see only their own deals and commissions
- **Authentication** — Secure login with JWT tokens

## Quick Start

```bash
# Install dependencies
npm install

# Set up database and seed with sample data
npm run setup

# Start the development server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

### Demo Credentials

| Role  | Email              | Password |
|-------|--------------------|----------|
| Admin | admin@akkar.com    | admin123 |
| Rep   | sarah@akkar.com    | rep123   |
| Rep   | mike@akkar.com     | rep123   |
| Rep   | emily@akkar.com    | rep123   |

## Tech Stack

- **Next.js 14** (App Router) — Full-stack React framework
- **TypeScript** — Type-safe code
- **Prisma + SQLite** — Database (zero external dependencies)
- **Tailwind CSS** — Styling
- **Recharts** — Dashboard charts
- **jose** — JWT authentication

## Project Structure

```
src/
├── app/
│   ├── api/           # API routes
│   │   ├── auth/      # Login, register, logout
│   │   ├── deals/     # CRUD for deals
│   │   ├── plans/     # Commission plan management
│   │   ├── commissions/ # Commission tracking & generation
│   │   ├── users/     # Team member management
│   │   └── dashboard/ # Dashboard analytics
│   ├── dashboard/     # Dashboard pages
│   │   ├── deals/     # Deals page
│   │   ├── commissions/ # Commissions page
│   │   ├── plans/     # Commission plans page
│   │   └── team/      # Team management page
│   └── login/         # Login/register page
├── components/        # Shared components
└── lib/               # Utilities (db, auth, commission engine)
```

## Environment Variables

Create a `.env` file:

```
DATABASE_URL="file:./dev.db"
JWT_SECRET="your-secret-key-change-in-production"
```
