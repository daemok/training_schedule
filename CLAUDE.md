# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Commands

```bash
npm run dev              # Start dev server (Turbopack) at localhost:3000
npm run build             # Production build
npm run lint               # ESLint (eslint-config-next core-web-vitals + typescript)
npx tsc --noEmit           # Type-check (no separate typecheck script)

npm test                   # Run full Vitest suite (tests/api/**)
npx vitest run tests/api/my-schedules.test.ts   # Run a single test file
npx vitest run -t "allows a team lead to update"  # Run tests matching a name

npm run db:migrate         # prisma migrate dev (dev.db)
npm run db:seed            # prisma db seed (tsx prisma/seed.ts) — wipes and reseeds
npm run db:reset           # prisma migrate reset (drops db, remigrates, reseeds)
npm run db:studio          # Prisma Studio GUI
npx prisma generate        # Regenerate client after editing schema.prisma (output: src/generated/prisma)
```

There is no watch-mode test script; `npm test` always runs once (`vitest run`).

## Architecture

Full-stack Next.js 16 App Router app (frontend + API routes in one project). SQLite via Prisma 7
with the `@prisma/adapter-better-sqlite3` driver adapter (see "Database" below for the Postgres
migration path). Auth is a stateless signed JWT session cookie (no session table).

### Auth & route protection

- `src/proxy.ts` — Next.js **Proxy** (the replacement for the old `middleware.ts` in this version
  of Next.js; see `node_modules/next/dist/docs/` per AGENTS.md) runs on every route except
  `/login`. No session → redirect to `/login` (pages) or `401` (`/api/*`). It also redirects
  non-`INSTRUCTOR` accounts away from `/my-schedule` to `/calendar`.
- Session = signed JWT (`jose`, HS256, `AUTH_SECRET`) in an httpOnly `session` cookie, verified by
  `src/lib/auth/session.ts`. Stateless by design — no server-side revocation, so it must be
  verifiable without a DB call (the Proxy runs where `better-sqlite3` isn't available).
- Two ways to read the session, both in `src/lib/auth/current-user.ts`:
  - `getCurrentUser()` — server components, relies on `next/headers` cookies().
  - `getSessionFromRequest(request)` — route handlers, reads `NextRequest.cookies` directly. Used
    everywhere in `src/app/api/**` specifically so tests can call route handlers with a
    hand-built `NextRequest` (see `tests/helpers/request.ts`) without needing Next's request
    context.

### Roles & permissions

Three `UserRole` values: `INSTRUCTOR`, `TEAM_LEAD`, `MANAGER`. `User` (login account) is a
separate table from `Instructor` (the work entity); only `role: INSTRUCTOR` accounts have a
1:1 `instructorId` link, which is the sole source of truth for "own schedule" ownership.

- **INSTRUCTOR**: CRUD only their own schedules via `/my-schedule` + `/api/my/schedules*`.
- **TEAM_LEAD` / `MANAGER`**: treated as superiors with full access — they can view, register,
  edit, and delete **any** instructor's schedules (done inline from `/calendar`, not
  `/my-schedule`, which stays instructor-only), and they see personal-schedule detail
  (`title`/`memo`) unmasked for every instructor, not just their own.
- Permission checks for write operations live in `src/lib/schedule-actor.ts`
  (`resolveScheduleActor` + `canManageSchedule`), shared by `/api/my/schedules/route.ts` and
  `/api/my/schedules/[id]/route.ts`. For `TEAM_LEAD`/`MANAGER`, POST requires an explicit
  `instructorId` in the body (400 if missing, 404 if it doesn't exist); PATCH/DELETE ignore
  ownership entirely for these roles.
- Read-side masking of personal-schedule fields lives in `src/lib/access-control.ts`
  (`canViewPersonalDetail` / `maskScheduleForViewer(s)`). Only a genuinely *different instructor*
  viewing someone else's `PERSONAL` schedule gets `title` replaced with the
  `PERSONAL_TITLE_PLACEHOLDER` ("개인 일정") and `memo` nulled — the owner and any TEAM_LEAD/MANAGER
  see real values. This runs server-side before the JSON response is built (not a client-side
  hide), and viewer identity always comes from the session, never from request query params.
- `src/lib/schedule-query.ts` (`fetchMaskedSchedules`) is the single query+mask implementation
  shared by `/api/schedules` (calendar view) and `/api/schedules/export` (Excel download) — keep
  these two in sync by editing that one function rather than duplicating logic.

### Data model (`prisma/schema.prisma`)

`Instructor` (work entity) ↔ `User` (login account, optional 1:1 via `instructorId`) ↔
`Schedule` (owned by an `Instructor`) → `ScheduleDeleteLog` (audit snapshot on delete, no FK back
to `Schedule` since the row is actually removed; `deletedByUserId` records the acting *user's*
`user_id`, which may be the owning instructor or a `TEAM_LEAD`/`MANAGER` acting on their behalf) →
`Notification` (sent to all `TEAM_LEAD` accounts when a schedule is created, message contains the
real title since team leads can see personal detail).

### Key directories

- `src/app/api/my/schedules/` — write endpoints (register/edit/delete), authorization described
  above. `GET` here is instructor-own-month-only and unrelated to the TEAM_LEAD/MANAGER flow.
- `src/app/api/schedules/` — read-only calendar endpoint + `/export` (Excel via `exceljs`), both
  built on `fetchMaskedSchedules`.
- `src/app/calendar/` — shared month/week/day calendar for all three roles; also where
  TEAM_LEAD/MANAGER do their register/edit/delete (`ScheduleAdminFormModal.tsx`,
  `ConfirmDeleteModal.tsx`, buttons gated on `viewerRole` inside `CalendarView.tsx`).
- `src/app/my-schedule/` — instructor-only self-service CRUD screen (separate, simpler form
  components from the calendar's admin versions).
- `src/lib/schedule-labels.ts` — single source of truth for `TimeBlock`/`ScheduleType` labels,
  re-exported by both `calendar/types.ts` and `my-schedule/types.ts`.
- `src/generated/prisma/` — Prisma client output (non-default path, not `node_modules/.prisma`);
  git-ignored, regenerate with `npx prisma generate` after schema changes.

### Testing

- `tests/global-setup.ts` runs once before the whole suite (separate process): wipes
  `prisma/test.db` and runs `prisma migrate deploy` against it.
- `tests/setup.ts` runs per test file, before any app module import: pins `DATABASE_URL` to
  `prisma/test.db` and sets a fallback `AUTH_SECRET`.
- `tests/helpers/fixtures.ts`: `resetDb()` clears all tables and creates a fixed set of fixtures
  (2 instructors, 4 users — instructor A/B, team lead, manager) before each test;
  `sessionCookieFor(user)` mints a real signed session cookie string without going through the
  login server action.
- `tests/helpers/request.ts`: `makeRequest(url, opts)` builds a `NextRequest` directly so route
  handlers (`GET`/`POST`/`PATCH`/`DELETE` exports) can be called as plain functions in tests.
- `vitest.config.ts` sets `fileParallelism: false` — every test file shares the same SQLite file,
  so parallel files would race on `resetDb()`. Don't re-enable this without giving each file its
  own DB.

### Database swap (SQLite → Postgres)

Dev uses SQLite (`dev.db`) for speed; this is not viable for serverless/multi-instance deploys.
To move to Postgres: change `datasource db { provider }` in `prisma/schema.prisma` and swap
`@prisma/adapter-better-sqlite3` for `@prisma/adapter-pg` (or equivalent) in `src/lib/prisma.ts`.
No query/business logic needs to change.
