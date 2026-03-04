# Time Tracking MVP

Single-company time tracking app with Google sign-in, Postgres persistence, weekly summaries, admin controls, and payroll CSV export.

## Stack

- Next.js 15 + TypeScript
- NextAuth (Google OAuth)
- Prisma + PostgreSQL
- Resend (email reminders/invites)

## Setup

1. Install dependencies:
   - `npm install`
2. Create env file:
   - `cp .env.example .env`
3. Set required env vars in `.env`:
   - `DATABASE_URL`
   - `GOOGLE_CLIENT_ID`
   - `GOOGLE_CLIENT_SECRET`
   - `AUTH_SECRET`
   - `APP_BASE_URL`
   - `EMAIL_API_KEY` (optional for local)
   - `EMAIL_FROM_ADDRESS` (optional for local)
   - `CRON_SECRET`
4. Generate Prisma client and run migrations:
   - `npm run prisma:generate`
   - `npm run prisma:migrate -- --name init`
5. Seed first admin (required once):
   - `SEED_ADMIN_EMAIL="admin@company.com" SEED_ADMIN_GOOGLE_SUB="google-sub-from-token" npm run prisma:seed`
6. Start app:
   - `npm run dev`

## Core API Routes

- `POST /api/invitations`
- `POST /api/time-sessions/start`
- `POST /api/time-sessions/:id/stop`
- `PATCH /api/time-sessions/:id`
- `GET /api/me/week-summary?week_start=YYYY-MM-DD`
- `POST /api/weeks/:weekStart/lock`
- `POST /api/weeks/:weekStart/unlock`
- `GET /api/exports/payroll.csv?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `PATCH /api/admin/users/:membershipId/weekly-target`
- `PATCH /api/admin/users/:membershipId/status`

## Cron Jobs

Use `x-cron-secret: $CRON_SECRET` header.

- `POST /api/jobs/auto-lock`
- `POST /api/jobs/reminders`

## Security Notes

- Secrets must only be passed via environment variables.
- Never commit `.env` or database credentials.
- Run DB credential rotation before production launch.
