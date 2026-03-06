# Hutech Time Tracking

This is a time tracking app for a single company.

It is built around 4 primary workflows:
- clock in and clock out
- add manual hours
- request time off
- review/export hours from admin

It now also includes optional Google Calendar sync for `Time off`.

You should not need to read the entire codebase to understand it. This README explains product behavior, business rules, and where each feature lives.

## User Views

### Employee
Can:
- sign in with Google
- land directly on `Timesheet` after login
- use a single `Clock in` / `Clock out` button
- see a live timer while clocked in
- add manual hours
- review sessions by day
- choose timezone from profile
- request time off from `Time off`
- connect personal Google Calendar for automatic day-off sync

### Admin
Can:
- view all people
- review hours per employee in a date range
- review requested time off per employee
- download monthly CSV by person or for the whole company
- use a separate `Admin` section in navigation

## Screen Behavior

### 1. Dashboard
The dashboard is intentionally simplified.

It only shows the current week summary:
- worked hours
- expected hours
- delta
- year-to-date time off
- daily hours chart (desktop and mobile)
- planned time off for this week
- public holidays for this week

It has no manual filter.
It always shows the current week.

### 2. Timesheet
This is the main screen.

It includes:
- single `Clock in / Clock out` button
- live running timer while a session is open
- day-based view
- sessions list for the selected day
- manual hour entry
- real-time refresh when sessions change

Important behavior:
- after saving manual hours, that day session group opens automatically
- if a new manual session overlaps an existing one, user can choose override
- on override confirm, old overlapping sessions are removed and only the new session remains

### 3. Time Off
Used to mark full days off.

Allowed types:
- Vacation
- Unpaid leave
- Not working

Not allowed:
- past days
- weekends
- California public holidays

On mobile, it does not use a compressed 7-column calendar.
It uses a vertical day list for better readability.
On desktop, it keeps the classic calendar layout.

Also:
- public holidays are generated in code
- they are not stored in the database
- they appear in calendar as `Public holiday`
- example: `Cesar Chavez Day` on March 31
- users can optionally connect Google Calendar
- once connected, saved future days off sync to the user's personal Google Calendar
- when disconnected, the app removes all Google Calendar events that were previously created by this app

#### Google Calendar behavior inside Time Off
- if calendar is not connected, `Time off` shows a connect component
- once connected, that connect component is hidden in `Time off`
- if the connection later breaks or is revoked, the component appears again
- Google Calendar can also be managed from profile settings by clicking the user name/avatar

### 4. Admin
`Admin` navigation is visually separated from the rest and uses a different color.

The screen has these sections:
- `Monthly Employee hours report`
- `People`
- `Monthly Hours export`
- `Time off`

#### Monthly Employee hours report
- has its own visual filter
- that filter only affects this block
- shows hours by employee and by day

#### People
- people list
- role
- monthly CSV download per person

#### Monthly Hours export
- monthly CSV export for the whole company

#### Time off
- placed at the bottom of the admin panel
- shows requested days per employee
- has an independent filter separate from the hours filter
- defaults to current year
- can open a modal with exact date details

## Important Product Rules

### Clocking
- only one active session per user is allowed
- `Clock in` opens a session
- `Clock out` closes it
- elapsed time updates live

### Manual Hours
- cannot add in future dates
- cannot add for dates older than 7 days
- overlap can be overridden
- on override, overlapping previous records are removed

### Day Status
- `Complete` if 8+ hours
- `Partial` if >0 and <8 hours

### Time Off
- full days only
- no half-days
- no manual approval in this version
- requests are auto-approved
- cannot request:
  - a past day
  - a weekend
  - a public holiday
- saving time off is the source of truth
- Google Calendar is only a synced destination, not the source of truth

### Google Calendar Sync
- sync is one-way: app -> Google Calendar
- target calendar is the connected user's `primary` Google Calendar
- events are created as all-day private entries
- user-created future days off are synced on save
- deleting a saved future day off removes the Google Calendar event too
- public holidays are not auto-synced
- if needed later, public holiday sync should be triggered manually, not during OAuth connect
- disconnecting removes all synced events created by the app
- if Google rate-limits requests, the app retries with backoff
- if sync still fails, the app keeps the day off saved locally and shows a reconnect/sync issue state

## Timezones

Each user can choose timezone from profile.
Open profile by clicking name/avatar in the top bar.

Available options:
- Madrid (CET/CEST)
- New York (ET)
- Los Angeles (PT)
- Manila (PHT)

Important:
- default organization timezone is `America/Los_Angeles`
- time sessions include timezone-aware timestamps
- time-off entries are date-only (no time component)
- because of that, a day off must not shift between dates due to timezone conversion
- Google Calendar time-off sync also uses all-day date-only events

## Authentication

The app does not use NextAuth.
It uses custom Google OAuth plus app-managed DB sessions.

Flow:
1. user clicks Google login
2. Google returns callback
3. app creates or reuses the user
4. app creates its own session cookie `tt_session`

Google Calendar sync uses a separate OAuth flow.
This is intentional.
Login and calendar permissions are separate so the user can use the app without granting Calendar access.

## Public Holidays

California public holidays:
- are not stored in the database
- are generated in code at runtime
- are defined in:
  - [src/lib/california-holidays.ts](/Users/axi/Documents/time-tracking/src/lib/california-holidays.ts)

Included examples:
- New Year's Day
- Martin Luther King Jr. Day
- Presidents' Day
- Cesar Chavez Day
- Memorial Day
- Independence Day
- Labor Day
- Veterans Day
- Thanksgiving Day
- Day after Thanksgiving
- Christmas Day

## Database

### Key tables
- `Organization`
- `User`
- `OrganizationUser`
- `TimeSession`
- `WeekLock`
- `AuditLog`
- `AppSession`
- `UserPreference`
- `TimeOffEntry`
- `CalendarConnection`
- `TimeOffCalendarSync`

### What each stores
- `User`: real person identity
- `OrganizationUser`: person-company relationship + role + weekly target
- `TimeSession`: work sessions
- `AppSession`: persistent app login session
- `UserPreference`: user timezone preference
- `TimeOffEntry`: stored time-off days per user
- `CalendarConnection`: encrypted Google Calendar connection per user
- `TimeOffCalendarSync`: mapping between app time-off records and Google Calendar events

## Important API Endpoints

### Auth
- `GET /api/auth/google/start`
- `GET /api/auth/google/callback`
- `POST /api/auth/logout`
- `GET /api/auth/session`
- `GET /api/auth/diagnostics`

### Profile
- `GET /api/me/profile`
- `PATCH /api/me/profile`

### User Hours
- `GET /api/me/range-summary?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/me/week-summary?week_start=YYYY-MM-DD`
- `GET /api/me/month-summary?month=YYYY-MM`

### Sessions
- `GET /api/time-sessions/active`
- `POST /api/time-sessions/start`
- `POST /api/time-sessions/{id}/stop`
- `POST /api/time-sessions`
- `PATCH /api/time-sessions/{id}`

### Time Off
- `GET /api/time-off?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `POST /api/time-off`
- `DELETE /api/time-off/{id}`
- `GET /api/admin/time-off?from=YYYY-MM-DD&to=YYYY-MM-DD`

### Google Calendar Integration
- `GET /api/integrations/google-calendar/status`
- `GET /api/integrations/google-calendar/start`
- `GET /api/integrations/google-calendar/callback`
- `POST /api/integrations/google-calendar/disconnect`

### Admin
- `GET /api/admin/range-overview?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `PATCH /api/admin/users/{membershipId}/status`
- `PATCH /api/admin/users/{membershipId}/weekly-target`
- `POST /api/weeks/{weekStart}/lock`
- `POST /api/weeks/{weekStart}/unlock`

### Export
- `GET /api/exports/payroll.csv?from=YYYY-MM-DD&to=YYYY-MM-DD`
- `GET /api/exports/payroll.csv?from=YYYY-MM-DD&to=YYYY-MM-DD&membership_id=<id>`

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS
- Kysely
- PostgreSQL
- Prisma for schema/migrations
- Custom Google OAuth
- SSE for real-time updates

## Real-Time Updates

The app uses an SSE stream to refresh session changes without page reload.

Endpoint:
- `GET /api/realtime/stream`

Mainly used in `Timesheet`.

## Environment Variables

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

## Run Locally

```bash
npm install
cp .env.example .env.local
npm run prisma:deploy
npm run dev
```

Open:
- [http://localhost:3000](http://localhost:3000)

For Google OAuth to work in local, your Google OAuth client must include these exact redirect URIs:

- `http://localhost:3000/api/auth/google/callback`
- `http://localhost:3000/api/integrations/google-calendar/callback`

For production:

- `https://time-tracking.hutech.tech/api/auth/google/callback`
- `https://time-tracking.hutech.tech/api/integrations/google-calendar/callback`

## Useful Commands

```bash
npm run dev
npm run build
npm run typecheck
npm run prisma:deploy
npm run prisma:seed
```

## Railway Deploy

Build:

```bash
npm ci --include=dev && npx prisma migrate deploy && npm run build
```

Start:

```bash
npm run start
```

## Troubleshooting

### Google Login Fails
Check:
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `AUTH_SECRET`
- `APP_BASE_URL`
- exact callback:
  - `<APP_BASE_URL>/api/auth/google/callback`

### Google Calendar Connect Fails
Check:
- exact callback:
  - `<APP_BASE_URL>/api/integrations/google-calendar/callback`
- that the Google OAuth client includes both login and calendar redirect URIs
- that `APP_BASE_URL` matches the environment you are actually using

### Google Calendar Events Do Not Appear
Check:
- that you are looking at the same Google account that you connected
- that you are looking at the primary calendar for that account
- that you saved a user-created future day off
- that the integration status is not `Reconnect required` or `Sync issue`

Important:
- the app can save the day off even when Google sync fails
- local app save success does not guarantee Google accepted the event

### Google Calendar Rate Limit Error
If you see `rateLimitExceeded`:
- the app now retries with backoff
- connect flow no longer writes public holidays during OAuth
- if Google still refuses the write, wait and try again later
- app-side time off remains saved even if Google rejects the event temporarily

### Database Connection Fails
Check:
- `DATABASE_URL`
- SSL settings
- Railway/network accessibility from runtime

### Frontend behaves oddly or webpack error appears
Run:

```bash
rm -rf .next
npm run dev
```

## Folder Map

- [src/app](/Users/axi/Documents/time-tracking/src/app): pages and API routes
- [src/components](/Users/axi/Documents/time-tracking/src/components): UI components
- [src/lib](/Users/axi/Documents/time-tracking/src/lib): auth, db, business rules, utilities
- [prisma/schema.prisma](/Users/axi/Documents/time-tracking/prisma/schema.prisma): reference schema
- [prisma/seed.mjs](/Users/axi/Documents/time-tracking/prisma/seed.mjs): local seed

## Where to Change What

### If you want to change login or sessions
Look at:
- [src/lib/auth](/Users/axi/Documents/time-tracking/src/lib/auth)
- [src/app/api/auth](/Users/axi/Documents/time-tracking/src/app/api/auth)

### If you want to change Timesheet
Look at:
- [src/components/timesheet-board.tsx](/Users/axi/Documents/time-tracking/src/components/timesheet-board.tsx)
- [src/app/api/time-sessions](/Users/axi/Documents/time-tracking/src/app/api/time-sessions)

### If you want to change Time off
Look at:
- [src/components/time-off-board.tsx](/Users/axi/Documents/time-tracking/src/components/time-off-board.tsx)
- [src/lib/time-off.ts](/Users/axi/Documents/time-tracking/src/lib/time-off.ts)
- [src/lib/california-holidays.ts](/Users/axi/Documents/time-tracking/src/lib/california-holidays.ts)
- [src/lib/google-calendar.ts](/Users/axi/Documents/time-tracking/src/lib/google-calendar.ts)
- [src/app/api/time-off](/Users/axi/Documents/time-tracking/src/app/api/time-off)

### If you want to change Google Calendar sync
Look at:
- [src/lib/google-calendar.ts](/Users/axi/Documents/time-tracking/src/lib/google-calendar.ts)
- [src/components/google-calendar-sync-card.tsx](/Users/axi/Documents/time-tracking/src/components/google-calendar-sync-card.tsx)
- [src/app/api/integrations/google-calendar](/Users/axi/Documents/time-tracking/src/app/api/integrations/google-calendar)
- [src/components/profile-timezone-settings.tsx](/Users/axi/Documents/time-tracking/src/components/profile-timezone-settings.tsx)

### If you want to change Admin
Look at:
- [src/app/admin/page.tsx](/Users/axi/Documents/time-tracking/src/app/admin/page.tsx)
- [src/components/admin-time-off-summary.tsx](/Users/axi/Documents/time-tracking/src/components/admin-time-off-summary.tsx)

## Quick Summary

If you skip the details:
- `Timesheet` is the primary screen
- `Dashboard` always shows the current week
- `Time off` handles full-day requests
- Google Calendar sync is optional and managed from `Time off` or profile settings
- `Admin` handles review, people, and exports
- public holidays come from code, not database
- time-off uses date-only values (no timezone shifting)
- sessions use timezone-aware timestamps
