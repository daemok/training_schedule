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

npm run db:migrate         # prisma migrate dev — applies to DATABASE_URL
npm run db:seed            # prisma db seed (tsx prisma/seed.ts) — wipes and reseeds
npm run db:reset           # prisma migrate reset (drops db, remigrates, reseeds)
npm run db:studio          # Prisma Studio GUI
npx prisma generate        # Regenerate client after editing schema.prisma (output: src/generated/prisma)
```

There is no watch-mode test script; `npm test` always runs once (`vitest run`). `postinstall`
runs `prisma generate` automatically after `npm install` (needed since the generated client is
git-ignored — required for CI/Vercel builds to see a client matching the current schema).

## Architecture

Full-stack Next.js 16 App Router app (frontend + API routes in one project). Postgres (Prisma
Postgres by default) via Prisma 7 with the `@prisma/adapter-pg` driver adapter — dev, test, and
prod all use Postgres, distinguished only by which connection string is loaded (see "Database"
below). Auth is a stateless signed JWT session cookie (no session table).

### Auth & route protection

- `src/proxy.ts` — Next.js **Proxy** (the replacement for the old `middleware.ts` in this version
  of Next.js; see `node_modules/next/dist/docs/` per AGENTS.md) runs on every route except
  `/login`. No session → redirect to `/login` (pages) or `401` (`/api/*`). It also redirects
  non-`INSTRUCTOR` accounts away from `/my-schedule` to `/calendar`.
- Session = signed JWT (`jose`, HS256, `AUTH_SECRET`) in an httpOnly `session` cookie, verified by
  `src/lib/auth/session.ts`. Stateless by design — no server-side revocation, so it must be
  verifiable without a DB call (the Proxy runs where the `pg` driver isn't available/desired).
- Two ways to read the session, both in `src/lib/auth/current-user.ts`:
  - `getCurrentUser()` — server components, relies on `next/headers` cookies().
  - `getSessionFromRequest(request)` — route handlers, reads `NextRequest.cookies` directly. Used
    everywhere in `src/app/api/**` specifically so tests can call route handlers with a
    hand-built `NextRequest` (see `tests/helpers/request.ts`) without needing Next's request
    context.

### Roles & permissions

Four `UserRole` values: `INSTRUCTOR`, `TEAM_LEAD`, `MANAGER`, `GENERAL`. `User` (login account) is
a separate table from `Instructor` (the work entity); only `role: INSTRUCTOR` accounts have a
1:1 `instructorId` link, which is the sole source of truth for "own schedule" ownership.
`User.status` (`PENDING`/`APPROVED`/`REJECTED`) gates login — only `GENERAL` self-signups start
as `PENDING`; every other account is created pre-approved (seed/admin-created).

- **INSTRUCTOR**: CRUD only their own schedules via `/my-schedule` + `/api/my/schedules*` (list or
  calendar sub-view, toggled client-side — see `ScheduleViewSwitcher.tsx`).
- **TEAM_LEAD / MANAGER**: treated as superiors with full access — they can view, register, edit,
  and delete **any** instructor's schedules (done inline from `/calendar`, not `/my-schedule`,
  which stays instructor-only), see personal-schedule detail (`title`/`memo`) unmasked for every
  instructor, and are the only roles that can reach `/admin/**` (lecture-type/instructor-pool
  management, signup approvals).
- **GENERAL**: browses instructor availability by lecture type and submits lecture requests from
  `/apply`; cannot touch `/api/my/schedules` at all (rejected in `resolveScheduleActor`, see
  below) — schedule rows are only ever created for them indirectly via the lecture-request flow.
- Permission checks for write operations live in `src/lib/schedule-actor.ts`
  (`resolveScheduleActor` + `canManageSchedule`), shared by `/api/my/schedules/route.ts`,
  `/api/my/schedules/[id]/route.ts`, and the lecture-request confirm/reject routes. `GENERAL` is
  explicitly rejected (403) here. For `TEAM_LEAD`/`MANAGER`, POST requires an explicit
  `instructorId` in the body (400 if missing, 404 if it doesn't exist); PATCH/DELETE ignore
  ownership entirely for these roles.
- `src/lib/require-role.ts` (`requireRole(request, roles[])`) is the simpler allow-list guard used
  by role-gated endpoints that aren't about schedule ownership (lecture-type CRUD, instructor-pool
  assignment, signup approval).
- Read-side masking of personal-schedule fields lives in `src/lib/access-control.ts`
  (`canViewPersonalDetail` / `maskScheduleForViewer(s)`). Only a genuinely *different instructor*
  (or a `GENERAL` viewer) looking at someone else's `PERSONAL` schedule gets `title` replaced with
  the `PERSONAL_TITLE_PLACEHOLDER` ("개인 일정") and `memo` nulled — the owner and any
  TEAM_LEAD/MANAGER see real values. This runs server-side before the JSON response is built (not
  a client-side hide), and viewer identity always comes from the session, never from request query
  params.
- `src/lib/schedule-query.ts` (`fetchMaskedSchedules`) is the single query+mask implementation
  shared by `/api/schedules` (calendar view) and `/api/schedules/export` (Excel download) — keep
  these two in sync by editing that one function rather than duplicating logic.

### Data model (`prisma/schema.prisma`)

`Instructor` (work entity) ↔ `User` (login account, optional 1:1 via `instructorId`) ↔
`Schedule` (owned by an `Instructor`; `startTime`/`endTime` are nullable — null means the entry
occupies the entire `timeBlock`, used for block-level `PERSONAL` entries; `status` is
`CONFIRMED`/`PROVISIONAL`) → `ScheduleDeleteLog` (audit snapshot on delete, no FK back to
`Schedule` since the row is actually removed; `deletedByUserId` records the acting *user's*
`user_id`) → `Notification` (sent to relevant `TEAM_LEAD`/instructor accounts, message contains
the real title since recipients can see personal detail).

`LectureType` ↔ `InstructorLectureType` (join table — which instructors can teach which type,
managed only by TEAM_LEAD/MANAGER) ← `LectureRequest` (a `GENERAL` user's request against one
instructor/lectureType/date/timeBlock; on creation it atomically creates a `PROVISIONAL` `Schedule`
row via `scheduleId` to occupy the slot immediately — see "Lecture requests" below).

### Lecture requests (general users)

- `GENERAL` users pick a lecture type on `/apply`, see which qualified instructors are free for
  each block that day (computed client-side in `ApplyFlow.tsx` from `/api/schedules`, cross-
  referenced against `/api/lecture-types/[id]/instructors`), and submit a request via
  `POST /api/lecture-requests`.
- That POST is transactional: it validates the requested time falls inside
  `TIME_BLOCK_RANGE[timeBlock]` (`src/lib/schedule-labels.ts` — the only place block↔clock-time
  bounds are enforced; regular instructor schedule entry stays free-form), then creates a
  `Schedule` row with `status: "PROVISIONAL"` **and** the `LectureRequest` row in the same
  transaction, so the slot is unavailable to anyone else immediately (reuses
  `findOverlaps` for the conflict check → 409 if taken).
- Confirm/reject (`/api/lecture-requests/[id]/confirm|reject`) reuse `resolveScheduleActor` +
  `canManageSchedule` — only the target instructor or TEAM_LEAD/MANAGER can resolve a request.
  Confirm flips the `Schedule.status` to `CONFIRMED` in place; reject **deletes** the provisional
  `Schedule` row (freeing the slot) and nulls `LectureRequest.scheduleId`.
- `src/app/lecture-requests/` is the confirm/reject inbox (instructor sees only their own pending
  requests; TEAM_LEAD/MANAGER see all). `src/app/apply/my/` is the requester's own status list.

### Key directories

- `src/app/api/my/schedules/` — write endpoints (register/edit/delete), authorization described
  above. `GET` here is instructor-own-month-only and unrelated to the TEAM_LEAD/MANAGER flow.
- `src/app/api/schedules/` — read-only calendar endpoint + `/export` (Excel via `exceljs`), both
  built on `fetchMaskedSchedules`.
- `src/app/api/lecture-types/`, `src/app/api/instructors/[id]/lecture-types/` — lecture-type CRUD
  and per-instructor assignment, TEAM_LEAD/MANAGER only.
- `src/app/api/lecture-requests/` — create/list/confirm/reject, described above.
- `src/app/api/signups/` — pending-signup list + approve/reject, TEAM_LEAD/MANAGER only.
- `src/app/calendar/` — shared month/week/day calendar for all three staff roles; also where
  TEAM_LEAD/MANAGER do their register/edit/delete (`ScheduleAdminFormModal.tsx`,
  `ConfirmDeleteModal.tsx`, buttons gated on `viewerRole` inside `CalendarView.tsx`). Empty cells
  are clickable to create when a single instructor is selected in the filter.
  `src/lib/schedule-all-day.ts` (`submitAllDayPersonalSchedule`) fans a "종일" (all-day) personal
  entry out into 3 separate MORNING/AFTERNOON/EVENING rows client-side, with rollback-on-partial-
  failure — there is no "ALL_DAY" enum value, each block is still an independent `Schedule` row.
- `src/app/my-schedule/` — instructor-only self-service CRUD, list or calendar sub-view
  (`ScheduleViewSwitcher.tsx` / `ScheduleCalendarView.tsx`, reuses the `calendar/` grid components).
- `src/app/admin/` — TEAM_LEAD/MANAGER only (guarded in `src/proxy.ts`): `instructors/` is the
  lecture-type/instructor-pool manager, `signups/` is the approval queue.
- `src/app/apply/`, `src/app/signup/` — GENERAL-only lecture request flow and public signup.
- `src/lib/schedule-labels.ts` — single source of truth for `TimeBlock`/`ScheduleType` labels and
  `TIME_BLOCK_RANGE` (lecture-request time validation only).
- `src/generated/prisma/` — Prisma client output (non-default path, not `node_modules/.prisma`);
  git-ignored, regenerated automatically via `postinstall` or manually with `npx prisma generate`.

### Testing

- Tests run against `TEST_DATABASE_URL` — a **separate Postgres database** from the one
  `DATABASE_URL` points at (dev/prod). Both must be set in `.env`; see `.env.example`.
- `tests/global-setup.ts` runs once before the whole suite (separate process, loads `.env` via
  `dotenv/config`): runs `prisma migrate deploy` against `TEST_DATABASE_URL`.
- `tests/setup.ts` runs per test file, before any app module import: overwrites
  `process.env.DATABASE_URL` with `TEST_DATABASE_URL` (so `@/lib/prisma` connects to the test DB)
  and sets a fallback `AUTH_SECRET`.
- `tests/helpers/fixtures.ts`: `resetDb()` clears all tables and creates a fixed set of fixtures
  (2 instructors, 5 users — instructor A/B, team lead, manager, an approved GENERAL, a PENDING
  GENERAL — plus one `LectureType` assigned to instructor A) before each test;
  `sessionCookieFor(user)` mints a real signed session cookie string without going through the
  login server action.
- `tests/helpers/request.ts`: `makeRequest(url, opts)` builds a `NextRequest` directly so route
  handlers (`GET`/`POST`/`PATCH`/`DELETE` exports) can be called as plain functions in tests.
- `vitest.config.ts` sets `fileParallelism: false` — every test file shares the same DB, so
  parallel files would race on `resetDb()`. Don't re-enable this without giving each file its own
  DB. Because tests hit a real network Postgres instance (not a local file), the suite takes
  ~1 minute rather than a few seconds — this is expected, not a regression.

### Database

Prisma Postgres (or any Postgres — swap the connection string, no code changes needed) via the
`@prisma/adapter-pg` driver adapter in `src/lib/prisma.ts` and `prisma/seed.ts`. The datasource
block in `schema.prisma` has no `url`/`directUrl` — connection strings live only in `.env`
(`DATABASE_URL`, `TEST_DATABASE_URL`), loaded through `prisma.config.ts`. See README's "배포
가이드" for the Vercel deploy path.
