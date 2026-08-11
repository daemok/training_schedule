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

### Password policy & login brute-force protection

- `src/lib/password-policy.ts` (`validatePassword`) — 8+ chars, must include at least one
  character from `PASSWORD_SPECIAL_CHARS`, and every character must come from
  `[A-Za-z0-9]` + that same special-char set (rejects spaces, emoji, control characters, etc.).
  Called from every path where a human picks their own password: `signup/actions.ts` and
  `account/actions.ts` (`changePassword`). **Not** called for admin-generated temporary passwords
  (instructor creation, `/api/users/[id]/reset-password`) — those are produced by
  `src/lib/temporary-password.ts`, which now injects one random char from
  `PASSWORD_SPECIAL_CHARS` at a random position so generated passwords always satisfy the same
  policy by construction, without needing a separate validation call.
- `src/lib/login-throttle.ts` — brute-force defense for `src/app/login/actions.ts` only (not
  signup/change-password/reset-password — deliberately scoped to login, the highest-value target).
  Two independent, purely time-window-based checks against the `LoginAttempt` audit table (no
  Redis/external store — this runs on serverless Vercel functions with no shared memory, so the
  window is derived from `createdAt` timestamps in Postgres rather than an in-memory counter):
  - **Per-account**: ≥5 failed attempts for the same email in the last 15 minutes blocks further
    attempts for *that* email, even with the correct password — this is deliberate; it's a
    lockout, not just a "wrong password" response.
  - **Per-IP**: ≥20 failed attempts from the same IP (`x-forwarded-for`, first value) across *any*
    emails in the last 15 minutes blocks that IP — catches credential stuffing across many
    accounts that wouldn't trip the per-account limit.
  - Only failures are recorded (`recordLoginAttempt(ip, email, succeeded)`); successful logins
    don't count toward either limit, and status-blocked logins (`PENDING`/`REJECTED` — password
    was actually correct) aren't recorded at all, since they're not a guessing signal. Both checks
    run identically regardless of whether the email belongs to a real account, so throttling
    itself never leaks account existence.
  - `getClientIp()` reads `headers()` from `next/headers` and falls back to `"unknown"` inside a
    try/catch — `headers()` throws outside a real request context (bare Vitest), the same
    constraint documented above for `cookies()`, so this keeps `login()` unit-testable
    (`tests/api/login-throttle.test.ts`) instead of only being testable end-to-end.
  - `LoginAttempt` has no FK to `User` (see the model comment in `schema.prisma`) — attempts
    against nonexistent emails must still be recorded for the throttle to work without leaking
    which emails are registered. Rows older than 24h are opportunistically pruned (5% chance per
    write, no cron) rather than kept forever.
  - `resetDb()` (`tests/helpers/fixtures.ts`) and `prisma/seed.ts` both clear `LoginAttempt` —
    remember to keep doing this if either script's cleanup list changes, or stale lockouts from a
    previous run/demo session will carry over.

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
  management, signup approvals) — `src/app/admin/page.tsx` is a dashboard hub linking to
  `/admin/instructors`, `/admin/signups`, `/lecture-requests`, and `/apply`. They also have full
  `GENERAL`-equivalent access to the lecture-request flow itself (`/apply`, `/apply/my`,
  `GET/POST /api/lecture-requests`) so they can submit requests the same way a `GENERAL` user
  does — the role guards on those routes/pages allow `GENERAL`, `TEAM_LEAD`, and `MANAGER`
  together (`INSTRUCTOR` is still excluded).
  **Exception — `/admin/users` (사용자 관리, `src/app/api/users/**`) is `MANAGER`-only**, not
  `TEAM_LEAD`+`MANAGER` like every other admin feature above. This is the one deliberate carve-out
  in the role model, guarded independently in `src/proxy.ts` (`pathname.startsWith("/admin/users")`
  checked after the general `/admin` TEAM_LEAD-or-MANAGER rule), the page itself, and every route
  under `/api/users`. It manages *all* `User` accounts regardless of role (unlike `/admin/instructors`,
  which only manages `Instructor` entities): edit email/name, force-reset password to a
  freshly-generated temporary one (same one-time-reveal UX as instructor creation, see
  `src/lib/temporary-password.ts`), and delete. Deletion is blocked (409) if the target has any
  `LectureRequest` as requester or confirmer (no `onDelete: Cascade` on those FKs — deleting would
  otherwise throw a DB error) and self-deletion is blocked (400) regardless of history, to prevent
  a manager locking themselves out. Deleting a `User` never touches the linked `Instructor`/
  `Schedule` rows — it only removes login capability; instructor deletion still goes through the
  separate `/admin/instructors` flow, which itself refuses to delete an `Instructor` that still has
  a linked `User` (see `src/app/api/instructors/[id]/route.ts`), so freeing up an instructor for
  deletion now means deleting their `User` here first.
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

`LectureBrand` (e.g. 뉴트리라이트/아티스트리 — team-lead/manager-managed master list) is now
purely an `Instructor` affiliation: every `Instructor` has a required `brandId` (replaces the old
free-text `team` field 1:1; the "강사 및 강의 관리" screen's 브랜드 section manages the list and a
soft-delete/restore toggle, same `isActive` pattern as `LectureType`). `LectureBrand` is **not**
connected to `LectureType` — that FK was removed; a lecture program's application period is the
only per-program gate. `LectureType` (an actual "개설된 강의 프로그램"; `applicationStartDate`/
`applicationEndDate` are nullable — null in a given direction means unbounded, checked against
current system time, and editable at any time via `PATCH /api/lecture-types/[id]` since the window
only constrains `GENERAL` requesters, never `TEAM_LEAD`/`MANAGER`) ↔ `InstructorLectureType`
(join table — which instructors can teach which `LectureType`, managed only by TEAM_LEAD/MANAGER)
← `LectureRequest` (a request against one instructor/lectureType/date/timeBlock; on creation it
atomically creates a `PROVISIONAL` `Schedule` row via `scheduleId` to occupy the slot immediately
— see "Lecture requests" below).
`RequestLock` is a separate, short-lived table (10-minute TTL) unrelated to the data model above —
it exists purely to serialize concurrent access to `RequestFormModal` for the same
(instructor, date, timeBlock), not to represent any persisted business fact.

### Lecture requests (general users)

- `GENERAL` (and `TEAM_LEAD`/`MANAGER`, see above) users pick a lecture (`LectureType`) on `/apply`
  and submit a request via `POST /api/lecture-requests`. `ApplyViewSwitcher.tsx` toggles between
  two independent sub-views (mirrors `my-schedule`'s list/calendar switcher, sharing no state
  between them — each fetches its own data):
  - `ApplyFlow.tsx` (리스트형): pick one date, see qualified instructors × block availability as a
    table for that single day.
  - `ApplyCalendarView.tsx` (캘린더형): full month grid; each day cell shows three always-visible
    오전/오후/저녁 pills (not instructor names — cells are too small) colored by whether *any*
    qualified instructor is free in that block, with an instructor-filter `<select>` to narrow to
    one. Clicking a pill with exactly one available instructor opens `RequestFormModal` directly;
    with more than one it opens a small "강사 선택" picker modal first. Both sub-views share
    `apply-types.ts` (`LectureType`/`InstructorOption`/`ScheduleRow`/`APPLY_BLOCKS` labels) and the
    same availability rule: a (date, block) is available for an instructor iff `/api/schedules`
    (queried with `instructor=ALL` and masked/filtered client-side) has no row for that
    instructor/date/block, regardless of the row's `scheduleType` or `status` — **and** iff there's
    no active `RequestLock` held by someone else for that slot (see below).
  - The lecture dropdown itself (fetched via `/api/lecture-types` or the server-rendered prop on
    `/apply/page.tsx`, which does its own Prisma query rather than calling the API route) is
    filtered server-side by `applicationStartDate`/`applicationEndDate` **only when the viewer's
    role is `GENERAL`** — `TEAM_LEAD`/`MANAGER` always see every active lecture regardless of
    period, matching the same exception applied in the POST validation below.
- **Concurrent-edit lock** (`src/lib/request-lock.ts`, `POST`/`DELETE`/`GET
  /api/lecture-requests/locks`): opening `RequestFormModal` acquires a 10-minute lock on
  (instructorId, date, timeBlock) via `acquireRequestLock` — a plain `create()` that falls back to
  a conditional `updateMany()` (reclaim if expired or already mine) on a unique-constraint
  conflict, which is safe under concurrent requests because the `updateMany` WHERE clause is
  re-evaluated atomically at UPDATE time, not against a stale read. Cancel or successful submit
  releases it immediately (`releaseRequestLock`); otherwise the modal's own countdown
  (`RequestFormModal.tsx`, `lockExpiresAt` prop) auto-closes and releases client-side when the
  10 minutes run out, and the server-side `expiresAt` is the authoritative fallback if the tab is
  closed instead. `ApplyFlow`/`ApplyCalendarView` fetch `GET .../locks` alongside `/api/schedules`
  so a slot someone else is actively filling out shows as "입력중" (list view) or simply excluded
  from "available" (calendar view) rather than only failing at click time.
- That POST is transactional: it validates the requested time falls inside
  `TIME_BLOCK_RANGE[timeBlock]` (`src/lib/schedule-labels.ts` — the only place block↔clock-time
  bounds are enforced; regular instructor schedule entry stays free-form), checks the
  `LectureType` application period for `GENERAL` requesters only, then creates a `Schedule` row
  with `status: "PROVISIONAL"` **and** the `LectureRequest` row in the same transaction, so the
  slot is unavailable to anyone else immediately (reuses `findOverlaps` for the conflict check →
  409 if taken), and releases the requester's own `RequestLock` for that slot on success.
- Confirm/reject (`/api/lecture-requests/[id]/confirm|reject`) reuse `resolveScheduleActor` +
  `canManageSchedule` — only the target instructor or TEAM_LEAD/MANAGER can resolve a request.
  Confirm flips the `Schedule.status` to `CONFIRMED` in place; reject **deletes** the provisional
  `Schedule` row (freeing the slot), nulls `LectureRequest.scheduleId`, and requires a non-empty
  `reason` in the request body (400 without one) stored on `LectureRequest.rejectionReason` —
  surfaced in the requester's notification and on `/apply/my`. The "가신청" status label was renamed
  to "미확정" everywhere it's shown (calendar badges, toasts, notifications). These same two
  endpoints are called from three places: the dedicated `src/app/lecture-requests/` inbox
  (instructor sees only their own pending requests; TEAM_LEAD/MANAGER see all), directly from the
  calendar's `DetailPanel` (`src/app/calendar/DetailPanel.tsx`) when a `PROVISIONAL` `LECTURE`
  schedule pill is clicked on `/calendar` or `/my-schedule`, and `/my-schedule`'s own calendar view
  — all three collect the reject reason through the shared `src/components/RejectReasonModal.tsx`
  before calling the API. `canDecideLectureRequest` there is computed client-side from
  `canManageSchedule`-equivalent logic (TEAM_LEAD/MANAGER, or the owning instructor). The panel
  gets the request detail (FC/LOS, attendee count, content, requester) via `fetchMaskedSchedules`'s
  `lectureRequest` join (`src/lib/schedule-query.ts`), not a second fetch. `src/app/apply/my/` is
  the requester's own status list.
- **Queue position**: because venue capacity means not every simultaneous request for a given
  date+block can be accommodated, every `LectureRequest` returned by `scope=mine`/`scope=pending`
  (and the two server-rendered pages that duplicate that query, `/lecture-requests` and
  `/apply/my`) carries a `queuePosition` — its 1-based rank by `createdAt` among *all* requests
  (any status, any instructor) sharing that exact `date`+`timeBlock`, computed by
  `attachQueuePositions` (`src/lib/lecture-request-queue.ts`). No region/location dimension is
  factored in — deliberately scoped to date+block only, per explicit product decision.

### Key directories

- `src/app/api/my/schedules/` — write endpoints (register/edit/delete), authorization described
  above. `GET` here is instructor-own-month-only and unrelated to the TEAM_LEAD/MANAGER flow.
- `src/app/api/schedules/` — read-only calendar endpoint + `/export` (Excel via `exceljs`), both
  built on `fetchMaskedSchedules`.
- `src/app/api/lecture-types/`, `src/app/api/instructors/[id]/lecture-types/` — lecture program CRUD
  (name/description/application period, all editable after creation) and per-instructor assignment,
  TEAM_LEAD/MANAGER only. `src/app/api/lecture-brands/` — brand CRUD, now solely for the
  `Instructor.brandId` picker (see "Data model" above).
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
  `BulkPersonalScheduleModal.tsx` (opened from either sub-view via "+ 개인일정 일괄 등록") lets an
  instructor multi-select up to `MAX_BULK_PERSONAL_DATES` (30, `src/lib/schedule-bulk.ts`) dates on
  a small month calendar and register the same block(종일/오전/오후/저녁)+사유 as `PERSONAL`
  schedules across all of them in one request to `POST /api/my/schedules/bulk`
  (`src/app/api/my/schedules/bulk/route.ts`, INSTRUCTOR-only — no TEAM_LEAD/MANAGER-on-behalf-of
  path, unlike the singular `POST /api/my/schedules`). The route pre-checks every (date, block)
  pair for conflicts and creates nothing on a 409 unless `force:true`; on success all rows are
  created in one `prisma.$transaction`, and `notifyTeamLeadsOfBulkPersonalSchedule` sends **one**
  summary notification per team lead instead of one per created row (a "종일" × 30 dates batch is
  90 rows).
- `src/app/admin/` — TEAM_LEAD/MANAGER only (guarded in `src/proxy.ts`): `page.tsx` is the
  dashboard hub, `instructors/` (page title "강사 및 강의 관리") is the instructor/brand/lecture-
  program manager (`InstructorManager.tsx` — sections in order: 강사 list+CRUD, 강사별 강의
  프로그램 배정 immediately below it — active lecture programs only, matching the filter already
  applied to the 강의 프로그램 list itself — 브랜드 (soft-delete/restore), 강의 프로그램 with
  inline edit for name/description/application dates), `signups/` is the approval queue, `users/` is
  account management (see "Roles & permissions" above — MANAGER-only, the one exception to
  TEAM_LEAD/MANAGER parity).
- `src/app/apply/`, `src/app/signup/` — lecture request flow (open to `GENERAL`, `TEAM_LEAD`, and
  `MANAGER` — guarded per-page since `/apply` isn't gated in `src/proxy.ts`) and public signup
  (still `GENERAL`-only). `/apply`'s left column renders `MonthlyAnnouncementBox.tsx` — a free-text
  "이달의 교육 프로그램 안내" (max 1000 chars) backed by the singleton `MonthlyAnnouncement` table
  and `GET/PATCH /api/monthly-announcement` (`GET` open to any logged-in role, `PATCH` TEAM_LEAD/
  MANAGER only; the route upserts against `findFirst()` since there's no natural unique key for the
  single row).
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
