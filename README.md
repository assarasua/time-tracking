# Hutech Time Tracking

Production-ready single-company time tracking app with Google OAuth, custom app sessions, PostgreSQL persistence, real-time timesheet updates, timezone profile settings, admin controls, and payroll CSV exports.

## 1. What This App Does

### Employee outcomes
- Sign in with Google and access the workspace.
- Use a single **Clock in / Clock out** button in Timesheet.
- Add manual hours by day (with policy constraints).
- See worked/expected/variance by selected date range.
- Review day sessions in local selected profile timezone.

### Admin outcomes
- View people and role status.
- Review employee daily/range totals.
- Update member status and weekly target.
- Lock/unlock weeks.
- Export monthly payroll CSV by selected date range (single employee or all employees).

## 2. Core UX Improvements Implemented

- **Default post-login page is Timesheet**.
- **Single toggle clock action** in Timesheet (`Clock in` / `Clock out`) with live running timer.
- **Real-time refresh** for timesheet changes via server push stream (`/api/realtime/stream`).
- **Auto-open sessions** after saving manual hours.
- **Manual time input supports both typing and suggested 15-min slots**.
- **Override flow with confirmation modal** when manual range overlaps existing session.
- On confirmed override, previous overlapping records are deleted and audit-logged.
- **Add hours policy is enforced in UI + API**:
  - no future dates,
  - no dates older than 7 days from current day.
- **Profile timezone settings moved to top bar** (click avatar/name opens modal settings).
- Timezone choices are constrained to:
  - Madrid (CET/CEST)
  - New York (ET)
  - Los Angeles (PT)
  - Manila (PHT)
- Org default timezone set to **America/Los_Angeles**.
- Dashboard includes **daily-hours chart** for selected range (desktop/tablet only, hidden on mobile).

## 3. Tech Stack

- **App**: Next.js 15 (App Router), React 19, TypeScript
- **Styling**: TailwindCSS with HuTech tokenized design patterns
- **Runtime DB access**: Kysely + `pg`
- **Schema tooling**: Prisma schema/seed (Prisma client package still present)
- **Auth**: Custom Google OAuth + server-managed HttpOnly sessions
- **Email**: Resend (reminder jobs)

## 4. Authentication and Sessions

### Flow
1. `GET /api/auth/google/start` creates OAuth state + redirects to Google.
2. `GET /api/auth/google/callback` validates state, exchanges token, fetches profile, provisions user/membership, creates app session.
3. Session cookie: `tt_session` (HttpOnly, SameSite=Lax, Secure on HTTPS).

### Provisioning rules
- New users are provisioned automatically on first valid Google login.
- Forced admin emails are supported in provisioning logic.

### Session storage
- `AppSession` table stores token hash, expiry, and revocation metadata.

## 5. Data Model (Active)

- `Organization`
- `User`
- `OrganizationUser`
- `TimeSession`
- `WeekLock`
- `AuditLog`
- `AppSession`
- `UserPreference` (profile timezone)

## 6. Business Rules

### Manual add-hours (`POST /api/time-sessions`)
- `endAt` must be after `startAt`.
- Not allowed for future dates.
- Not allowed if target day is older than 7 days from now.
- Non-admins cannot add hours in locked weeks.
- Overlap behavior:
  - prompts confirmation in UI,
  - creates new session,
  - deletes previous overlapping sessions,
  - logs override in `AuditLog`.

### Edit existing session (`PATCH /api/time-sessions/{id}`)
- Same 7-day historical restriction for non-admins.
- Enforces week-lock policy for non-admins.

### Daily completion status
- `Complete` when day total >= **8h (480m)**.
- `Partial` when day total > 0 and < 8h.

## 7. Real-Time Updates

This app uses a server push stream (SSE) to propagate session changes instantly.

- Stream endpoint: `GET /api/realtime/stream`
- Publisher events on:
  - `POST /api/time-sessions`
  - `POST /api/time-sessions/start`
  - `POST /api/time-sessions/{id}/stop`
- Timesheet subscribes with `EventSource` and reloads selected range on `time_session_changed`.

## 8. API Surface

### Auth
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/auth/diagnostics`
- `GET /api/auth/error`

### Profile
- `GET /api/me/profile`
- `PATCH /api/me/profile`

### User summaries
- `GET /api/me/week-summary?week_start=YYYY-MM-DD`
- `GET /api/me/month-summary?month=YYYY-MM`
- `GET /api/me/range-summary?from=YYYY-MM-DD&to=YYYY-MM-DD`

### Time sessions
- `GET /api/time-sessions/active`
- `POST /api/time-sessions/start`
- `POST /api/time-sessions/{id}/stop`
- `POST /api/time-sessions`
- `PATCH /api/time-sessions/{id}`

### Realtime
- `GET /api/realtime/stream`

### Admin
- `GET /api/admin/range-overview?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `PATCH /api/admin/users/{membershipId}/status`
- `PATCH /api/admin/users/{membershipId}/weekly-target`
- `POST /api/weeks/{weekStart}/lock`
- `POST /api/weeks/{weekStart}/unlock`

### Exports
- `GET /api/exports/payroll.csv?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/exports/payroll.csv?from=YYYY-MM-DD&to=YYYY-MM-DD&membership_id=<id>`

### Jobs
- `POST /api/jobs/auto-lock`
- `POST /api/jobs/reminders`

## 9. CSV Export Behavior

- Export is monthly-aggregated within selected range.
- Per-person file:
  - `<employee-name>-YYYY-MM-DD-to-YYYY-MM-DD.csv`
- All employees file:
  - `hutech-YYYY-MM-DD-to-YYYY-MM-DD-monthly.csv`

## 10. Environment Variables

### Required
- `DATABASE_URL`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`

### Recommended
- `APP_BASE_URL`
- `AUTH_TRUST_HOST=true`
- `EMAIL_API_KEY`
- `EMAIL_FROM_ADDRESS`
- `CRON_SECRET`

Use `.env.example` as base.

## 11. Local Development

```bash
npm install
cp .env.example .env.local
npm run prisma:deploy
npm run dev -- --port 3000
```

Open: `http://localhost:3000`

Optional seed:

```bash
npm run prisma:seed
```

## 12. Build and Quality

```bash
npm run typecheck
npm run build
```

## 13. Deploy (Railway Node)

### Build command

```bash
npm ci --include=dev && npx prisma migrate deploy && npm run build
```

### Start command

```bash
npm run start
```

### Deploy notes
- Keep runtime on Railway Node (not edge runtime for DB code).
- Ensure production domain matches Google callback URL:
  - `<APP_BASE_URL>/api/auth/google/callback`
- If using proxy/CDN, forward host/proto correctly.

## 14. Troubleshooting

### OAuth / login
- `oauth_provider_misconfigured`:
  - verify Google client ID/secret and callback URL.
- `oauth_state_invalid`:
  - host/proto mismatch, stale cookies, or wrong `APP_BASE_URL`.

### DB connectivity
- `db_unreachable`:
  - DB host/port not reachable from runtime.
- `db_auth_failed`:
  - invalid credentials.
- `db_schema_missing`:
  - run `npx prisma migrate deploy`.

### Frontend stale bundle error
- `__webpack_modules__[moduleId] is not a function`

```bash
rm -rf .next
npm run dev -- --port 3000
```

Hard refresh browser afterward.

## 15. Security Notes

- Never commit secrets.
- Use environment variables per environment.
- Keep `AUTH_SECRET` high entropy and rotate as needed.
- Enforce HTTPS in production.

## 16. Repository Map

- `src/app/` routes and API handlers
- `src/components/` UI and interaction components
- `src/lib/` auth, db, realtime, aggregates, utilities
- `prisma/schema.prisma` schema reference
- `prisma/seed.mjs` seed script

