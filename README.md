# Time Tracking Web App

Single-company time tracking platform with Google OAuth, server-managed sessions, PostgreSQL persistence, weekly/monthly insights, admin operations, and payroll-ready CSV exports.

This repository is designed for production on **Railway Node** with PostgreSQL, and supports custom domain fronting (for example Cloudflare DNS/proxy).

## 1. Product Overview

### Core user outcomes
- Sign in with Google and access personal workspace.
- Log and edit worked time from timesheet.
- See worked vs expected vs variance over selected ranges.
- Download monthly payroll CSV (per employee or all employees).

### Admin outcomes
- View organization members and role state.
- Review employee range-based daily totals.
- Export monthly payroll data for selected date windows.
- Lock/unlock payroll weeks and manage policy constraints.

## 2. Tech Stack

- **Frontend/App**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: TailwindCSS + HuTech tokenized design system
- **DB Runtime**: Kysely + `pg`
- **Schema/Migrations**: Prisma (migrations + seed only)
- **Auth**: Custom Google OAuth + HttpOnly app sessions (no NextAuth runtime)
- **Email**: Resend (reminder jobs)

## 3. Architecture

### Auth model
- `/api/auth/google/start` builds OAuth URL + state cookie.
- `/api/auth/google/callback` validates state, exchanges code, fetches Google profile, provisions membership, creates app session.
- Session cookie: `tt_session` (HttpOnly, Secure in HTTPS, SameSite=Lax).
- Session records stored in `AppSession` table (token hash + expiry/revocation).

### Data model (active tables)
- `Organization`
- `User`
- `OrganizationUser`
- `TimeSession`
- `WeekLock`
- `AuditLog`
- `AppSession`

### Performance model (current)
- Added aggregated endpoints for range summaries:
  - `GET /api/me/range-summary`
  - `GET /api/admin/range-overview`
- Summary endpoints use short cache policy (30s):
  - `Cache-Control: private, max-age=0, s-maxage=30, stale-while-revalidate=30`

## 4. Project Structure

- `src/app/` app routes and API handlers
- `src/components/` UI and feature components
- `src/lib/` auth, db adapter, aggregates, validation, utility modules
- `prisma/schema.prisma` schema + indexes
- `prisma/seed.mjs` seed utility

## 5. Environment Variables

Required for runtime:

- `DATABASE_URL` (PostgreSQL URL)
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`

Recommended:

- `APP_BASE_URL` (defaults in code to `https://time-tracking.hutech.tech` if omitted)
- `AUTH_TRUST_HOST` (`true` recommended when behind proxy)
- `EMAIL_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `CRON_SECRET`

Reference: `.env.example`

## 6. Local Development

### Install

```bash
npm install
```

### Configure env

```bash
cp .env.example .env.local
# fill required values
```

### Run migrations (first run / schema updates)

```bash
npm run prisma:deploy
```

### Optional seed

```bash
npm run prisma:seed
```

### Start dev server

```bash
npm run dev -- --port 3000
```

Open: `http://localhost:3000`

## 7. Build & Quality

```bash
npm run typecheck
npm run build
```

## 8. API Surface (Current)

### Auth
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/auth/diagnostics`
- `GET /api/auth/error`

### User summaries
- `GET /api/me/week-summary?week_start=YYYY-MM-DD`
- `GET /api/me/month-summary?month=YYYY-MM`
- `GET /api/me/range-summary?from=YYYY-MM-DD&to=YYYY-MM-DD`

### Time sessions
- `POST /api/time-sessions/start`
- `POST /api/time-sessions/{id}/stop`
- `POST /api/time-sessions`
- `PATCH /api/time-sessions/{id}`

### Admin
- `GET /api/admin/range-overview?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `PATCH /api/admin/users/{membershipId}/status`
- `PATCH /api/admin/users/{membershipId}/weekly-target`
- `POST /api/weeks/{weekStart}/lock`
- `POST /api/weeks/{weekStart}/unlock`

### Exports
- `GET /api/exports/payroll.csv?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/exports/payroll.csv?from=YYYY-MM-DD&to=YYYY-MM-DD&membership_id=<id>`

## 9. CSV Behavior

- Export is **monthly aggregated** inside selected date range.
- Per-person filename:
  - `<employee-name>-YYYY-MM-DD-to-YYYY-MM-DD.csv`
- All-employees filename:
  - `hutech-YYYY-MM-DD-to-YYYY-MM-DD-monthly.csv`

## 10. Deploy (Railway Node)

### Recommended Railway commands

Build:
```bash
npm ci --include=dev && npx prisma migrate deploy && npm run build
```

Start:
```bash
npm run start
```

### Notes
- Keep app runtime on Railway Node (not edge runtime for DB code).
- Ensure `DATABASE_URL` points to reachable PostgreSQL host from Railway service.
- If using internal Railway host, ensure service networking is correctly linked.

## 11. Troubleshooting

### A) OAuth errors

#### `oauth_provider_misconfigured`
- Validate `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`.
- Ensure Google OAuth redirect URI exactly matches:
  - `<APP_BASE_URL>/api/auth/google/callback`

#### `oauth_state_invalid`
- Usually mixed host/protocol or stale cookies.
- Ensure `APP_BASE_URL` matches actual domain.
- Ensure proxy forwards host/proto correctly.

### B) Session creation errors

#### `db_unreachable`
- DB host/port not reachable from runtime network.
- Verify `DATABASE_URL` and network path.

#### `db_auth_failed`
- Invalid DB credentials in `DATABASE_URL`.

#### `db_schema_missing`
- Run `npx prisma migrate deploy` on deployment.

### C) Frontend runtime chunk error

#### `__webpack_modules__[moduleId] is not a function`
- Usually stale local chunks after heavy changes.
- Fix:
  ```bash
  # stop dev server
  rm -rf .next
  npm run dev -- --port 3000
  ```
- Hard refresh browser (`Cmd+Shift+R`).

## 12. Performance Notes

Implemented improvements:
- Reduced dashboard fan-out to one aggregated summary call.
- Added short cache headers for repeated summary loads.
- Added server-side aggregate helpers for user/admin range responses.
- Added basic perf logs in aggregated endpoints (`dbMs`, `totalMs`).

## 13. Security Notes

- Never commit secrets or raw credentials.
- Use env vars only in deploy/runtime environments.
- Keep `AUTH_SECRET` high-entropy and rotate for production changes.
- Enforce HTTPS in production so secure cookies are always set.

## 14. Maintenance Guidelines

- Keep Prisma for schema/migrations and seed only.
- Keep runtime DB access in `src/lib/db.ts` + Kysely layers.
- Prefer adding new aggregate endpoints for heavy UI analytics instead of client fan-out.
- Preserve backward compatibility for existing API contracts whenever possible.
