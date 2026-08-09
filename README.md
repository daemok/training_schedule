# 강사 스케줄 관리 (Training Schedule)

강사별 강의/개인일정을 관리하는 웹 애플리케이션입니다. 강사·팀장·매니저 3개 역할의
로그인/권한, 공용 캘린더, 엑셀 내보내기, 팀장 알림, 자동 테스트까지 갖춘 실사용 가능한
수준으로 구성되어 있습니다(단계별 구현 히스토리는 아래 각 절 참고).

## 기술 스택

| 영역 | 선택 |
| --- | --- |
| 프론트엔드 | Next.js (App Router) + TypeScript |
| 백엔드 | Next.js API Routes |
| 데이터베이스 | PostgreSQL — Prisma Postgres (Prisma ORM, `@prisma/adapter-pg`) |
| 스타일링 | TailwindCSS (반응형) |
| 인증 | 이메일+비밀번호(bcryptjs) + 서명된 세션 JWT(jose) |
| 엑셀 내보내기 | exceljs |
| 테스트 | Vitest |

프론트엔드와 백엔드를 하나의 Next.js 프로젝트로 통합해, 초기 개발 속도를 높이는 구성입니다.
개발·테스트·운영 모두 Postgres를 사용하며(개발/운영용 `DATABASE_URL`과 테스트 전용
`TEST_DATABASE_URL`을 분리해서 씀), 다른 Postgres 제공자(Neon, Supabase, Vercel Postgres
등)로 옮기려면 `.env`의 연결 문자열만 교체하면 됩니다(아래 "배포 가이드" 참고).

## 폴더 구조

```
training_schedule/
├── prisma/
│   ├── schema.prisma        # Instructor / User / Schedule / ScheduleDeleteLog / Notification 등 모델
│   ├── seed.ts               # 시드 데이터 스크립트 (계정 포함)
│   └── migrations/           # 마이그레이션 이력 (Postgres SQL)
├── prisma.config.ts          # Prisma CLI 설정 (DB 위치, 시드 커맨드)
├── vitest.config.ts          # 테스트 러너 설정 (파일 병렬 실행 끔 — 테스트 DB 공유)
├── .env                       # DATABASE_URL, TEST_DATABASE_URL, AUTH_SECRET (git 미포함)
├── .env.example               # 배포/신규 개발 환경용 템플릿
├── tests/
│   ├── global-setup.ts        # 테스트 DB 마이그레이션 (전체 1회 실행)
│   ├── setup.ts                # 각 테스트 파일의 DATABASE_URL/AUTH_SECRET 지정
│   ├── helpers/
│   │   ├── fixtures.ts         # 강사/계정 픽스처 생성 + 세션 쿠키 발급 헬퍼
│   │   └── request.ts          # 테스트용 NextRequest 생성 헬퍼
│   └── api/
│       ├── my-schedules.test.ts            # 스케줄 등록/수정/삭제 API
│       ├── schedules-calendar.test.ts       # 캘린더 조회 API(강사 필터/전체 조회/기간)
│       └── personal-reason-masking.test.ts  # 개인일정 사유 비노출(조회 API + 엑셀 내보내기)
├── src/
│   ├── proxy.ts               # 전 라우트 인증 가드 (Next.js Proxy, 구 middleware)
│   ├── components/
│   │   └── Toast.tsx           # 하단 확인 토스트 (등록/수정/삭제 시 표시)
│   ├── app/
│   │   ├── api/
│   │   │   ├── instructors/route.ts        # GET(목록)/POST(등록) /api/instructors, [id]/route.ts PATCH(수정)/DELETE(삭제) — 강사 관리, 팀장/매니저 전용
│   │   │   ├── schedules/route.ts          # GET /api/schedules (기간+강사 필터, 세션 기반 마스킹)
│   │   │   ├── schedules/export/route.ts   # GET 엑셀(.xlsx) 다운로드 (동일 마스킹 재사용)
│   │   │   ├── notifications/route.ts      # GET 내 알림 목록
│   │   │   ├── notifications/read-all/route.ts # POST 전체 읽음 처리
│   │   │   └── my/schedules/
│   │   │       ├── route.ts                # GET(본인 월별 목록, INSTRUCTOR 전용)/POST(등록 — 강사는 본인, 팀장/매니저는 instructorId 지정)
│   │   │       └── [id]/route.ts           # PATCH(수정)/DELETE(삭제+로그) — 본인 소유 또는 팀장/매니저(전체 허용)
│   │   ├── calendar/                  # 강사·팀장·매니저 공용 캘린더 (월/주/일 뷰; 팀장/매니저는 등록/수정/삭제도 가능)
│   │   │   ├── page.tsx               # 서버 컴포넌트 — 세션에서 뷰어 확정 + 최초 데이터 로드
│   │   │   ├── CalendarView.tsx       # 필터/뷰 전환/데이터 refetch/엑셀 다운로드/CRUD 오케스트레이션 (client)
│   │   │   ├── MonthGrid.tsx          # 월간 그리드 (모바일에서는 가로 스크롤)
│   │   │   ├── WeekView.tsx           # 주간(시간대 × 요일) 테이블
│   │   │   ├── DayView.tsx            # 일간 목록
│   │   │   ├── EventPill.tsx          # 셀 안의 일정 항목(시간대 배지 + 강사 색상 점)
│   │   │   ├── DetailPanel.tsx        # 일정 클릭 시 사이드 패널 (팀장/매니저에게는 수정/삭제 버튼도 표시)
│   │   │   ├── ScheduleAdminFormModal.tsx # 팀장/매니저 전용 등록·수정 폼 모달(강사 선택 포함)
│   │   │   ├── ConfirmDeleteModal.tsx # 팀장/매니저 전용 삭제 확인 모달
│   │   │   ├── NotificationBell.tsx   # 팀장 전용 알림 벨
│   │   │   ├── colors.ts              # 강사별 categorical 색상(팔레트 고정 순서 배정)
│   │   │   ├── date-utils.ts          # 월/주/일 범위 계산, 그리드 생성
│   │   │   └── types.ts               # 캘린더 전용 DTO/라벨 타입
│   │   ├── schedules/page.tsx         # (구) 매니저/팀장용 화면 — 현재는 /calendar로 리다이렉트
│   │   ├── login/
│   │   │   ├── page.tsx               # 이메일+비밀번호 로그인 화면 (client, useActionState)
│   │   │   └── actions.ts             # login/logout 서버 액션 (bcrypt 검증 + 세션 쿠키 발급)
│   │   ├── my-schedule/
│   │   │   ├── page.tsx               # 강사 본인의 월별 스케줄 관리 화면 (모바일 대응)
│   │   │   ├── ScheduleManager.tsx    # 월 이동 + 목록 + 모달 + 토스트 오케스트레이션 (client)
│   │   │   ├── ScheduleFormModal.tsx  # 등록/수정 폼 모달 (client, 모바일에서 입력란 세로 배치)
│   │   │   ├── ConfirmDeleteModal.tsx # 삭제 확인 모달 (client)
│   │   │   └── types.ts               # 화면에서 쓰는 DTO/라벨 타입 (lib/schedule-labels 재사용)
│   │   ├── page.tsx                   # 랜딩 페이지 (로그인 세션에 따라 내용 분기)
│   │   └── layout.tsx
│   ├── lib/
│   │   ├── prisma.ts             # Prisma Client 싱글턴 (pg 드라이버 어댑터)
│   │   ├── access-control.ts     # 개인일정 필드 접근 제어(마스킹) 로직 + PERSONAL_TITLE_PLACEHOLDER
│   │   ├── schedule-actor.ts     # 스케줄 등록/수정/삭제 행위자 판정(본인 강사 vs 팀장/매니저 전체 권한)
│   │   ├── schedule-labels.ts    # 시간대/일정유형 라벨 (여러 화면이 공유하는 단일 출처)
│   │   ├── schedule-query.ts     # 기간+강사 필터 조회 및 마스킹 (캘린더 API·엑셀 내보내기 공유)
│   │   ├── notifications.ts      # 신규 스케줄 등록 시 팀장에게 알림 생성 (실제 제목 그대로 전달)
│   │   ├── auth/
│   │   │   ├── session.ts        # 세션 JWT 발급/검증 (jose, edge/node 겸용)
│   │   │   ├── current-user.ts   # getCurrentUser()(서버 컴포넌트) / getSessionFromRequest()(라우트 핸들러, 테스트 가능)
│   │   │   └── constants.ts      # 세션 쿠키 이름, 만료 시간
│   │   ├── date.ts               # 날짜/월 범위 계산 헬퍼
│   │   ├── schedule-validation.ts# 시각 순서 비교 헬퍼
│   │   ├── schedule-input.ts     # 스케줄 등록/수정 입력값 검증·정규화
│   │   └── schedule-overlap.ts   # 본인 일정 시간 겹침 조회
│   └── generated/prisma/         # Prisma가 생성한 클라이언트 코드 (git 미포함)
└── README.md
```

## 데이터 모델 요약

### Instructor (강사)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `instructor_id` | Int (PK, autoincrement) | 강사 ID |
| `name` | String | 강사명 |
| `status` | Enum(`ACTIVE`/`INACTIVE`) | 활성/비활성 상태 |
| `team` | String | 소속 팀 |

### Schedule (스케줄)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `schedule_id` | Int (PK, autoincrement) | 스케줄 ID |
| `instructor_id` | Int (FK → Instructor) | 담당 강사 |
| `date` | DateTime | 스케줄 날짜 |
| `time_block` | Enum(`MORNING`/`AFTERNOON`/`EVENING`) | 오전/오후/저녁 |
| `start_time` / `end_time` | String (`HH:mm`) | 시작/종료 시각 |
| `schedule_type` | Enum(`LECTURE`/`PERSONAL`) | 강의/개인일정 |
| `title` | String | ⚠️ **본인 전용 필드** (아래 참고) |
| `location` | String? | 장소 |
| `memo` | String? | ⚠️ **본인 전용 필드** (아래 참고) |
| `created_at` / `updated_at` | DateTime | 생성/수정 시각 |

### ScheduleDeleteLog (스케줄 삭제 이력)

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `log_id` | Int (PK, autoincrement) | 로그 ID |
| `schedule_id` | Int | 삭제된 스케줄의 원래 ID (FK 아님, 원본 삭제 후에도 값 보존) |
| `instructor_id` | Int | 스케줄 소유 강사 |
| `date` / `time_block` / `start_time` / `end_time` / `schedule_type` / `title` / `location` / `memo` | - | 삭제 시점의 스냅샷 |
| `deleted_by` | Int | 삭제를 수행한 강사 ID (현재 단계에서는 본인만 삭제 가능하므로 `instructor_id`와 동일) |
| `deleted_at` | DateTime | 삭제 시각 |

### User (로그인 계정)

`Instructor`(업무 엔티티)와 분리된 로그인 계정 테이블. 강사(`INSTRUCTOR`) 계정만
`instructor_id`로 자신의 `Instructor` row와 1:1 연결되며, 팀장/매니저는 스케줄을
소유하지 않으므로 `instructor_id`가 `null`입니다.

| 필드 | 타입 | 설명 |
| --- | --- | --- |
| `user_id` | Int (PK, autoincrement) | 계정 ID |
| `email` | String (unique) | 로그인 이메일 |
| `password_hash` | String | bcrypt 해시 |
| `role` | Enum(`INSTRUCTOR`/`TEAM_LEAD`/`MANAGER`) | 로그인 역할 — 세션(JWT)에 그대로 실림 |
| `instructor_id` | Int? (FK → Instructor, unique) | `role=INSTRUCTOR`일 때만 값이 있음 |
| `created_at` / `updated_at` | DateTime | 생성/수정 시각 |

#### 필드 접근 제어(개인일정 마스킹) 설계

`schedule_type`이 `PERSONAL`(개인일정)인 스케줄은 `title`/`memo`가 **본인 전용 필드**로 취급됩니다.

- `prisma/schema.prisma`에는 두 필드 위에 "본인 전용 필드" 주석을 명시해, 스키마만 보고도
  마스킹 대상 필드를 알 수 있도록 했습니다.
- 실제 마스킹 로직은 `src/lib/access-control.ts`의 `maskScheduleForViewer` /
  `maskSchedulesForViewer` 함수로 구현되어 있습니다. 강사 본인(`role: "INSTRUCTOR"` +
  본인 `instructorId`) 또는 팀장/매니저(상급자 — 모든 강사의 개인일정을 열람할 수 있음)가
  아니면 `title`은 `"개인 일정"`으로, `memo`는 `null`로 치환됩니다.
- `/api/schedules`, `/calendar` 페이지는 뷰어 컨텍스트(`role`, `instructorId`)를 **오직
  로그인 세션에서만** 가져옵니다 — 4단계에서 정식 인증이 도입되며 쿼리 파라미터로 역할을
  넘기던 데모 방식은 완전히 제거되었습니다(자세한 내용은 아래 "정식 인증/권한 체계" 참고).

## 강사용 스케줄 등록/수정/삭제 (2단계)

로그인/세션은 4단계에서 정식 이메일+비밀번호 인증으로 교체되었습니다(아래 "정식 인증/권한
체계" 절 참고). 이 절의 화면 흐름 자체는 그대로 유지됩니다.

### 화면 흐름

1. `/login`에서 강사를 선택해 로그인합니다.
2. `/my-schedule`에서 본인의 월별 스케줄을 확인합니다. 상단의 "← 이전 달 / 다음 달 →"로
   조회할 달을 이동할 수 있습니다(URL의 `year`/`month` 쿼리로 상태 유지).
3. "+ 새 일정 등록" 버튼으로 등록 모달을 열거나, 각 항목의 "수정" 버튼으로 기존 값을 채운
   모달을 엽니다.
4. 등록/수정 폼:
   - **일정 유형**(강의/개인일정) 라디오에 따라 하단 입력란이 바뀝니다.
     - 강의: **강의명**(필수), **장소**(선택, 오프라인 강의실명 또는 온라인 링크)
     - 개인일정: **사유**(선택 입력) 하나만 노출 — 비워두면 자동으로 "개인 일정"이 저장되며,
       다른 강사의 화면에는 사유 내용과 무관하게 항상 "개인 일정"으로만 마스킹되어 보입니다
       (팀장/매니저는 상급자로서 실제 사유를 그대로 볼 수 있습니다).
   - **날짜**(date input), **시간대**(오전/오후/저녁 라디오, 필수), **시작/종료 시각**(`<input type="time">`)
   - 종료 시각이 시작 시각보다 빠르거나 같으면 클라이언트/서버 양쪽에서 저장을 막고 에러
     메시지를 보여줍니다.
   - 같은 날짜에 본인의 다른 일정과 시간이 겹치면 저장 요청이 409로 거부되고, 겹치는 일정
     목록과 함께 경고가 표시됩니다. "그래도 저장" 버튼을 누르면 겹침을 허용하고 저장합니다.
5. 삭제 버튼을 누르면 바로 삭제되지 않고 확인 모달이 뜹니다. 확인을 누르면 서버에서
   ① `ScheduleDeleteLog`에 삭제 전 스냅샷을 기록하고 ② 트랜잭션으로 `Schedule` row를
   실제로 삭제합니다.

### 소유권 검증 / 상급자 권한

`/api/my/schedules`(POST) 및 `/api/my/schedules/[id]`(PATCH/DELETE)는 로그인 세션 기준으로
행위자(actor)를 확정한 뒤 권한을 검사합니다(`src/lib/schedule-actor.ts`의
`resolveScheduleActor` + `canManageSchedule`).

- **강사(`INSTRUCTOR`)**: 세션의 `instructorId`(위조 불가능한 서명된 JWT에서 추출)와 대상
  스케줄의 `instructor_id`가 일치할 때만 처리하며, 불일치 시 403을 반환합니다. 등록 시
  요청 본문에 `instructorId`를 넣어도 무시되고 항상 본인 강사로 고정됩니다.
- **팀장/매니저(`TEAM_LEAD`/`MANAGER`)**: 상급자로서 모든 강사의 스케줄을 등록/수정/삭제할
  수 있습니다. 등록 시에는 요청 본문의 `instructorId`로 대상 강사를 지정해야 하며(값이
  없거나 존재하지 않는 강사면 각각 400/404), 수정/삭제 시에는 대상 스케줄이 어느 강사
  소유인지와 무관하게 항상 허용됩니다.

## 공용 캘린더 (3단계)

`/calendar`는 강사·팀장·매니저가 함께 사용하는 캘린더 화면입니다. 강사는 조회만 가능하고
(등록/수정/삭제는 `/my-schedule`에서), 팀장/매니저는 상급자로서 이 화면에서 모든 강사의
스케줄을 등록·수정·삭제까지 할 수 있습니다.

### 화면 구성

- **월/주/일 뷰 토글**: 상단의 월간/주간/일간 버튼으로 전환합니다. 월간은 6주 그리드,
  주간은 시간대(오전/오후/저녁) × 요일 테이블, 일간은 시간대별 목록으로 표시됩니다.
  "← 이전 / 오늘 / 다음 →"으로 뷰 단위(월·주·일)에 맞춰 기간을 이동합니다.
- **시간대 색상/라벨**: 모든 뷰에서 오전(하늘색)/오후(호박색)/저녁(보라색) 배지가 항상
  텍스트 라벨과 함께 표시됩니다(`types.ts`의 `TIME_BLOCK_BADGE_CLASS`).
- **강사 필터 드롭다운**: "전체 강사" 선택 시 등록된 모든 강사의 일정이 함께 표시되고,
  각 일정 앞에 강사별 고정 색상 점 + 강사명이 붙습니다(`colors.ts` — dataviz 스킬의 검증된
  8색 categorical 팔레트를 강사 id 순서에 고정 배정, 색상만으로 구분하지 않도록 항상
  강사명 텍스트를 함께 노출). 특정 강사를 선택하면 해당 강사의 일정만 필터링되어 표시되고
  강사 배지는 숨겨집니다(단일 강사이므로 불필요).
- **일정 상세 사이드 패널**: 일정을 클릭하면 강의명(또는 "개인 일정"), 등록 강사명, 날짜·
  시간대, 시작~종료 시각, 장소, 메모를 오른쪽 패널로 보여줍니다. 개인일정의 실제 사유는
  `access-control.ts`의 마스킹 규칙을 그대로 재사용하므로, 서버가 애초에 상세 값을
  내려주지 않는 경우(본인도 팀장/매니저도 아닌 다른 강사가 볼 때)에는 클라이언트에서도
  볼 수 없습니다. 팀장/매니저에게는 수정/삭제 버튼이 함께 표시됩니다.
- **새 일정 등록 · 수정 · 삭제 (팀장/매니저 전용)**: 툴바의 "+ 새 일정 등록" 버튼으로
  강사를 선택해 새 일정을 등록할 수 있고(`ScheduleAdminFormModal.tsx`), 상세 패널의
  "수정"/"삭제" 버튼으로 임의 강사의 기존 일정을 변경할 수 있습니다. 등록/수정/삭제 폼과
  겹침 검증·확인 모달은 `/my-schedule`의 강사용 화면과 동일한 규칙을 따릅니다.
- **뷰어 정보 표시**: 상단 우측에 로그인한 계정의 실제 역할("강사 · 김민준" / "팀장" /
  "매니저")이 배지로 표시됩니다. 이 값은 로그인 세션에 고정되어 사용자가 임의로 바꿀 수
  없습니다(역할 사칭 방지).

### API 최적화

`/api/schedules`는 `from`(포함)/`to`(미포함) 날짜 범위와 `instructor`(ALL 또는 강사 id)를
필수/선택 쿼리로 받아, 선택된 기간 + 선택된 강사 조건으로만 DB를 조회합니다(전체 테이블을
가져와 클라이언트에서 필터링하지 않음). 월간/주간/일간 뷰 전환, 이전/다음 이동, 강사 필터
변경 시마다 `CalendarView.tsx`가 현재 상태에 맞는 `from`/`to`를 계산해 다시 요청합니다.
뷰어의 `role`/`instructorId`는 쿼리로 받지 않고 서버가 세션에서만 읽습니다(아래 4단계 참고).

```
GET /api/schedules?from=2026-07-01&to=2026-08-01&instructor=ALL
GET /api/schedules?from=2026-07-01&to=2026-08-01&instructor=3
```

## 정식 인증/권한 체계 (4단계)

### 역할 정의

| 역할 | 값(`UserRole`) | 권한 |
| --- | --- | --- |
| 강사 | `INSTRUCTOR` | 본인 스케줄만 등록/수정/삭제 가능. 캘린더에서 본인 일정은 상세 열람 가능, 타 강사 선택 시 개인일정은 "개인 일정"으로만 노출 |
| 팀장 | `TEAM_LEAD` | 상급자 — 모든 강사의 스케줄을 캘린더에서 조회·등록·수정·삭제 가능(전체/개별 강사 필터 포함), 개인일정 상세(사유/메모)도 마스킹 없이 열람 가능. `/admin`(관리자 페이지)에서 강사 관리·가입 승인을 처리하며, `/apply`에서 일반 사용자와 동일하게 직접 강의를 신청할 수도 있음 |
| 매니저 | `MANAGER` | 팀장과 동일한 전체 권한(관리자 페이지, 강의 신청 포함) |
| 일반 사용자 | `GENERAL` | 강의 유형별 강사 가능 일정을 조회하고 `/apply`에서 강의를 신청. 가입은 팀장/매니저 승인이 필요(`status: PENDING`→`APPROVED`) |

### 로그인 방식: 이메일 + 비밀번호

- `/login`에서 이메일/비밀번호를 입력하면 서버 액션(`src/app/login/actions.ts`)이
  `User.email`로 계정을 조회하고 `bcryptjs`로 비밀번호 해시를 비교합니다.
- 인증에 성공하면 `{ userId, email, role, instructorId }`를 담은 세션을 **서명된
  JWT**(`jose`, HS256, `AUTH_SECRET` 서명키)로 발급해 `session`이라는 httpOnly 쿠키에
  저장합니다(만료 12시간, `src/lib/auth/session.ts`). 세션은 DB에 저장하지 않는
  stateless 토큰이므로, 라우트 가드가 실행되는 Edge 런타임(Prisma의 pg 드라이버 어댑터를
  쓸 수 없는 환경)에서도 DB 조회 없이 서명만으로 검증할 수 있습니다.
- 강사 계정은 로그인 후 `/my-schedule`로, 팀장/매니저 계정은 `/calendar`로 리다이렉트됩니다.
- 로그아웃은 세션 쿠키 삭제로 처리됩니다(만료 전 강제 무효화는 지원하지 않음 — 그래서
  세션 만료 시간을 짧게 유지합니다).
- 로그인한 모든 역할은 `/account`에서 본인 비밀번호를 변경할 수 있습니다
  (`src/app/account/actions.ts`) — 현재 비밀번호 확인 후 새 비밀번호(8자 이상)로 교체합니다.
  홈 화면(`/`)의 "비밀번호 변경" 링크로 이동할 수 있습니다.

### 라우트 가드 — 인증되지 않은 사용자는 어떤 화면에도 접근 불가

`src/proxy.ts`(Next.js Proxy, 이전의 middleware)가 `/login`을 제외한 **모든 경로**
(페이지 + API 라우트)에서 세션 쿠키를 검증합니다.

- 세션이 없거나 위조/만료된 경우: 일반 페이지 요청은 `/login?next=<원래 경로>`로
  리다이렉트, API 요청(`/api/*`)은 `401`을 반환합니다.
- 세션은 있지만 역할이 맞지 않는 경우: `role !== "INSTRUCTOR"`인 계정이 `/my-schedule`에
  접근하면 `/calendar`로 리다이렉트합니다(팀장/매니저는 캘린더 화면에서 모든 강사의
  스케줄을 관리하므로 이 화면이 별도로 필요 없음).

### 백엔드 레벨 필드 필터링 (프론트 은닉 아님)

개인일정의 사유(`title`/`memo`)는 조회 API(`/api/schedules`, `/api/schedules` 내부에서
쓰는 `access-control.ts`)가 **응답을 만들기 전에** 마스킹 여부를 결정합니다. 즉 조건에
맞지 않으면 실제 값이 애초에 JSON에 담기지 않으며, 브라우저 개발자 도구로 네트워크
응답을 들여다봐도 값 자체가 없습니다(프론트에서 CSS로 숨기거나 화면에서만 지우는
방식이 아님).

- 뷰어의 `role`/`instructorId`는 절대 요청 쿼리 파라미터로 받지 않고, 항상 서버가
  세션(JWT)에서 직접 읽습니다. 즉 로그인 세션이 강사(A)인 상태에서 API 쿼리에
  `role=MANAGER`나 다른 강사의 `viewerId`를 억지로 넣어도 서버는 무시하고 실제 세션값만
  사용합니다 — 쿼리 조작을 통한 권한 상승이 불가능합니다.
- 강사 본인의 개인일정, 그리고 팀장/매니저(상급자 — 모든 강사의 개인일정을 열람할 수
  있음)가 조회하는 경우에는 `title`/`memo`가 실제 값 그대로 내려갑니다. 그 외의 경우
  (다른 강사가 보는 경우)에만 `title`이 `"개인 일정"`으로, `memo`가 `null`로 치환된 뒤
  응답이 만들어집니다.

### 테스트 계정 (시드 데이터, `npm run db:seed`로 생성)

모든 계정의 비밀번호는 `password123`입니다.

| 이메일 | 역할 | 비고 |
| --- | --- | --- |
| `minjun@example.com` | 강사(INSTRUCTOR) | 김민준 (A팀) |
| `seoyeon@example.com` | 강사(INSTRUCTOR) | 이서연 (A팀) |
| `doyun@example.com` | 강사(INSTRUCTOR) | 박도윤 (B팀) |
| `jiwoo@example.com` | 강사(INSTRUCTOR) | 최지우 (B팀, 비활성 강사) |
| `haeun@example.com` | 강사(INSTRUCTOR) | 정하은 (C팀) |
| `teamlead@example.com` | 팀장(TEAM_LEAD) | 스케줄 미소유 |
| `manager@example.com` | 매니저(MANAGER) | 스케줄 미소유 |
| `general@example.com` | 일반 사용자(GENERAL) | 승인됨 — 바로 로그인 가능 |
| `pending@example.com` | 일반 사용자(GENERAL) | 승인 대기 — 로그인 시 거부되어야 정상 |

### 역할별 테스트 시나리오

| # | 계정 | 동작 | 기대 결과 |
| --- | --- | --- | --- |
| 1 | (로그인 전) | `/`, `/calendar`, `/my-schedule` 직접 접근 | 모두 `/login`으로 리다이렉트. `/api/schedules` 등 API는 401 |
| 2 | (로그인 전) | 위조/만료된 `session` 쿠키로 접근 | 로그인하지 않은 것과 동일하게 차단 |
| 3 | `minjun@example.com` | 로그인 | `/my-schedule`로 리다이렉트, 본인 스케줄 목록 노출(개인일정 "병원 진료" 사유까지 그대로 보임) |
| 4 | `minjun@example.com` | 다른 강사의 스케줄 id로 PATCH/DELETE 직접 호출 | `403 본인 일정만 수정/삭제할 수 있습니다` |
| 5 | `minjun@example.com` | `/calendar`에서 "전체 강사" 선택 | 모든 강사 일정이 강사별 색상으로 표시. 본인 개인일정만 상세, 타 강사 개인일정은 "개인 일정"만 노출 |
| 6 | `minjun@example.com` | `/api/schedules`에 `role=MANAGER`, 타 강사 `viewerId`를 쿼리로 조작 | 서버가 세션(김민준/INSTRUCTOR)만 신뢰 — 조작한 값 무시, 타 강사 개인일정 여전히 마스킹 |
| 7 | `teamlead@example.com` | 로그인 | `/calendar`로 리다이렉트, "팀장" 배지. 전체 강사 캘린더 조회 가능하며 모든 개인일정 상세도 그대로 열람 가능 |
| 8 | `teamlead@example.com` | `/my-schedule` 직접 접근 | `/calendar`로 자동 리다이렉트(강사 전용 화면이므로) |
| 9 | `teamlead@example.com` | `/calendar`에서 "새 일정 등록" → 강사 선택 후 등록, 다른 강사의 기존 일정을 수정/삭제 | 모두 성공(상급자로서 모든 강사의 스케줄을 관리할 수 있음) |
| 10 | `manager@example.com` | 로그인 후 7~9와 동일 시나리오 반복 | 팀장과 동일한 전체 관리 권한 결과 |
| 11 | 아무 계정 | 잘못된 비밀번호로 로그인 시도 | `이메일 또는 비밀번호가 올바르지 않습니다` 에러만 표시, 세션 발급 안 됨 |

## 실사용 마무리 기능 (5단계)

### 엑셀 내보내기

`/calendar` 상단의 "엑셀 다운로드" 버튼은 **현재 화면에 보이는 조건 그대로**(선택된
월/주/일 범위 + 강사 필터)로 `.xlsx` 파일을 내려받습니다.

```
GET /api/schedules/export?from=2026-07-01&to=2026-08-01&instructor=ALL
```

- 컬럼: 날짜, 시간블록, 시작시각, 종료시각, 구분(강의/개인일정), 강의명, 강사명, 장소
- `/api/schedules`와 동일한 `fetchMaskedSchedules()`(`src/lib/schedule-query.ts`)를 그대로
  재사용합니다. 개인일정의 실제 사유는 로그인한 강사 본인의 일정을 본인이 내려받거나,
  팀장/매니저(상급자 — 전체 열람 권한)가 내려받는 경우에는 그대로 포함되고, 그 외(다른
  강사가 내려받는 경우)에는 "개인 일정"으로만 적힙니다 —
  `tests/api/personal-reason-masking.test.ts`에서 실제로 엑셀 파일을 파싱해 검증합니다.

### 알림 · 확인 토스트

- **등록/수정/삭제 확인 토스트**: `/my-schedule`(강사 본인 화면)과 `/calendar`(팀장/매니저의
  전체 강사 관리)에서 일정을 등록·수정·삭제하면 화면 하단에 "일정이 등록/수정/삭제되었습니다"
  토스트가 3초간 표시됩니다(`src/components/Toast.tsx`).
- **팀장 알림**: 강사 본인이 신규 일정을 등록하거나, 팀장/매니저가 다른 강사를 대신해
  등록(POST)하면 서버가 모든 `TEAM_LEAD` 계정 앞으로 알림을 생성합니다
  (`src/lib/notifications.ts`). 팀장은 개인일정 상세를 열람할 권한이 있으므로 알림에도
  실제 제목/사유가 그대로 담기며, 등록을 수행한 사람이 팀장 본인이면 스스로에게는 알리지
  않습니다. `/calendar`에서 팀장으로 로그인하면 우측 상단에 알림 벨(안읽음 개수 배지)이
  표시되고, 클릭하면 최근 20건을 볼 수 있습니다. 알림은 DB에 저장되며(폴링/실시간 구독
  없이 벨을 열 때마다 다시 조회), "모두 읽음" 버튼으로 일괄 처리할 수 있습니다.

### 테스트

```bash
npm test
```

Vitest로 5개 영역을 검증합니다(총 60개 테스트, `tests/api/`):

| 파일 | 검증 내용 |
| --- | --- |
| `my-schedules.test.ts` | 등록(성공/검증 실패/겹침 409/강제 저장), 조회(본인 것만), 수정·삭제(소유자만 가능, 타인 403), 삭제 로그 기록, 팀장/매니저가 `instructorId` 지정으로 임의 강사 앞 등록·수정·삭제 가능(400/404 검증 포함), 삭제 로그의 `deletedByUserId`가 실제 행위자와 일치 |
| `schedules-calendar.test.ts` | `from`/`to` 필수 검증, 날짜 범위 필터링, `instructor=ALL`(전체 강사) vs `instructor=<id>`(단일 강사) 필터 |
| `personal-reason-masking.test.ts` | 팀장/매니저 조회·엑셀 다운로드 시 개인일정 `title`/`memo`가 실값 그대로 노출, 다른 강사 조회 시에는 여전히 플레이스홀더로 마스킹, 본인 조회 시에만 실값 노출, 쿼리 파라미터 조작으로 역할 사칭 불가 |
| `lecture-requests.test.ts` | 강의 신청 생성(권한/유형 자격/시간대 범위/슬롯 충돌 검증), `scope=mine`/`scope=pending` 조회 범위, 확정·거절 권한(대상 강사 본인 또는 팀장/매니저), 거절 시 점유 스케줄 삭제로 슬롯 재오픈 |
| `general-access.test.ts` | 회원가입(중복 이메일/비밀번호 불일치 거부), `PENDING` 계정 로그인 차단, 일반 사용자의 `/api/my/schedules` 직접 호출 차단, 강의 유형/강사 관리 권한(팀장/매니저 전용), 강사 등록·수정·삭제(스케줄/강의신청 이력 또는 연결 계정이 있으면 삭제 거부), 가입 승인 관리 권한, 블록 단위(시간 미입력) 개인일정 등록·겹침 규칙 |

테스트는 개발/운영용 `DATABASE_URL`과 분리된 `TEST_DATABASE_URL`(전용 Postgres DB)을
사용합니다(첫 실행 시 `vitest.config.ts`의 `globalSetup`이 자동으로 마이그레이션을
적용합니다). 모든 테스트 파일이 같은 DB를 공유하므로 `fileParallelism: false`로 순차
실행되도록 설정했습니다 — 그렇지 않으면 파일 간 `beforeEach`의 시드 초기화가 서로
경합합니다. 라우트 핸들러는 `getSessionFromRequest(request)`로 세션을 읽도록 작성되어
있어(암묵적 `next/headers` 컨텍스트에 의존하지 않음), 테스트에서 직접 만든 `NextRequest`에
세션 쿠키를 실어 호출할 수 있습니다.

### 반응형 디자인

강사가 현장(강의실 등)에서 휴대폰으로 스케줄을 등록하는 상황을 고려해 모바일 폭에서도
핵심 입력 화면이 동작하도록 조정했습니다.

- `/my-schedule`: 상단 이동 버튼과 목록 항목이 좁은 화면에서 세로로 쌓이고(`flex-col
  sm:flex-row`), 등록/수정 모달의 시작·종료 시각 입력란도 모바일에서는 세로로 배치됩니다.
- `/calendar`: 월간 그리드는 좁은 화면에서 찌그러지는 대신 `overflow-x-auto`로 가로
  스크롤되어 요일·날짜·일정이 읽을 수 있는 크기를 유지합니다. 상단 컨트롤(뷰 전환, 강사
  필터, 엑셀 다운로드, 역할 배지)은 `flex-wrap`으로 줄바꿈됩니다.
- 일정 상세 사이드 패널은 모바일 폭에서는 화면 전체를, 데스크톱에서는 `max-w-sm`만
  차지합니다.

### 배포 가이드 (Vercel + Prisma Postgres)

이 프로젝트는 Postgres 기반이라 별도 DB 전환 작업 없이 서버리스 플랫폼(Vercel 등)에
바로 배포할 수 있습니다. Prisma Postgres가 아닌 다른 Postgres 제공자(Neon, Supabase,
Vercel Postgres 등)를 쓰고 싶다면 3번의 `DATABASE_URL`만 해당 제공자의 연결 문자열로
바꾸면 되고, 나머지 절차는 동일합니다.

1. **GitHub에 푸시**: 아직 원격 저장소가 없다면 GitHub에 새 저장소를 만들고 푸시합니다.
   ```bash
   git remote add origin <저장소 URL>
   git push -u origin main
   ```

2. **Vercel 프로젝트 생성**: [vercel.com](https://vercel.com)에서 GitHub 저장소를 임포트합니다.
   Framework Preset은 Next.js가 자동 감지됩니다.

3. **환경 변수 설정** (Vercel 프로젝트 → Settings → Environment Variables):
   | 이름 | 값 |
   | --- | --- |
   | `DATABASE_URL` | Postgres 연결 문자열 (개발용과 같은 DB를 써도 되고, 운영 전용 DB를 새로 만들어도 됩니다) |
   | `AUTH_SECRET` | 새로 생성한 랜덤 값 — 개발용 `.env`의 값을 그대로 쓰지 마세요: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` |

   `TEST_DATABASE_URL`은 로컬 테스트 전용이므로 Vercel에는 설정할 필요가 없습니다.

4. **마이그레이션 적용**: Vercel은 빌드 시 `next build`만 실행하므로, 배포 전(또는
   최초 1회) 로컬에서 운영 DB를 대상으로 마이그레이션과 시드를 직접 실행합니다.
   ```bash
   DATABASE_URL="<운영 DB 연결 문자열>" npx prisma migrate deploy
   DATABASE_URL="<운영 DB 연결 문자열>" npm run db:seed   # 최초 1회만 — 이미 데이터가 있다면 생략
   ```
   (원한다면 `package.json`의 `build` 스크립트를 `prisma migrate deploy && next build`로
   바꿔 배포 파이프라인에 포함시킬 수도 있습니다.)

5. **Deploy** 클릭 — 이후 `main` 브랜치에 푸시할 때마다 자동 배포됩니다.

**운영 체크리스트**:
- `AUTH_SECRET`을 개발용 값과 다르게 설정했는지 확인
- `NODE_ENV=production`이면(Vercel은 자동으로 설정) 세션 쿠키에 `Secure` 속성이
  자동으로 붙습니다(`src/app/login/actions.ts`)
- 시드 스크립트의 데모 계정(`password123`)은 실제 서비스 오픈 전 반드시 삭제하거나
  비밀번호를 교체하세요
- Vercel은 HTTPS가 기본 적용되므로 쿠키의 `Secure` 속성 관련 별도 설정은 필요 없습니다

## 실행 방법

### 1. 의존성 설치

```bash
npm install
```

### 2. 환경 변수 확인

새로 클론한 경우 `.env.example`을 참고해 `.env`를 만드세요. `DATABASE_URL`(개발/운영용)과
`TEST_DATABASE_URL`(테스트 전용)에 각각 Postgres 연결 문자열을 넣어야 합니다 — 두 값을
같은 DB로 둬도 동작은 하지만, 테스트가 `beforeEach`마다 데이터를 지우므로 개발 중인
데이터가 날아가지 않도록 **서로 다른 DB**를 쓰는 것을 권장합니다(Prisma Postgres는
무료로 프로젝트를 여러 개 만들 수 있습니다 — console.prisma.io 참고).

```
DATABASE_URL="postgres://..."       # 개발/운영용 DB
TEST_DATABASE_URL="postgres://..."  # 테스트 전용 DB
AUTH_SECRET="..."                    # 세션 JWT 서명 키 — 운영 배포 시 반드시 새 값으로 교체
```

### 3. 데이터베이스 마이그레이션

```bash
npm run db:migrate
```

`DATABASE_URL`이 가리키는 Postgres DB에 테이블이 생성됩니다. 이미 생성된 마이그레이션이
있다면 이 명령은 변경 없이 스키마 동기화 상태만 확인합니다.

### 4. 시드 데이터 삽입

```bash
npm run db:seed
```

강사 5명(각기 다른 팀, 1명은 비활성 상태) + 이번 달 샘플 스케줄(강사별 3~5건, 강의/개인일정
혼합) + 로그인 계정 9개(강사 5 + 팀장 1 + 매니저 1 + 일반 사용자 2— 승인됨/승인대기 각 1개,
비밀번호 `password123`) + 강의 유형 2개(강사 배정 포함)가 삽입됩니다. 스크립트는 실행 전
기존 데이터를 삭제(`deleteMany`)하므로 반복 실행해도 안전합니다.

### 5. 개발 서버 실행

```bash
npm run dev
```

- http://localhost:3000 — 랜딩 페이지 (로그인 필요)
- http://localhost:3000/login — 로그인 (테스트 계정은 위 "테스트 계정" 표 참고)
- http://localhost:3000/calendar — 강사·팀장·매니저 공용 캘린더 (월/주/일 뷰, 강사 필터, 팀장/매니저는 전체 강사 등록/수정/삭제)
- http://localhost:3000/my-schedule — 강사 본인의 월별 스케줄 등록/수정/삭제 (INSTRUCTOR 전용)
- http://localhost:3000/api/instructors — 강사 목록 API
- http://localhost:3000/api/schedules?from=2026-07-01&to=2026-08-01&instructor=ALL — 캘린더 API (로그인 세션 기준으로 자동 마스킹, 팀장/매니저는 마스킹 없이 전체 열람)
- http://localhost:3000/api/schedules/export?from=2026-07-01&to=2026-08-01&instructor=ALL — 엑셀(.xlsx) 다운로드
- http://localhost:3000/api/my/schedules?year=2026&month=7 — 로그인한 강사 본인의 월별 스케줄 API
- http://localhost:3000/api/notifications — 로그인 계정 앞 알림 목록 (팀장 계정에 의미 있는 값이 쌓임)

모든 화면/API는 로그인이 필요합니다 — 로그인 전에는 `/login`으로 리다이렉트되거나
(API는) 401을 반환합니다.

### 기타 유용한 명령어

```bash
npm run lint       # ESLint
npx tsc --noEmit   # 타입 체크
npm test           # Vitest (스케줄 CRUD, 캘린더 필터, 개인일정 마스킹)
npm run db:studio  # Prisma Studio (DB GUI)
npm run db:reset   # 마이그레이션 재적용 + 시드까지 초기화
```

## 향후 작업 (다음 단계 후보)

- 회원가입/계정 관리 화면(현재는 계정을 시드로만 생성 가능), 비밀번호 재설정
- 세션 강제 무효화(로그아웃 즉시 서버에서 폐기) — 현재는 stateless JWT라 만료 전까지는
  쿠키 삭제로만 로그아웃되며, 필요 시 세션 테이블 기반의 revocation list 추가
- 강사 활성/비활성 상태에 따른 스케줄 등록 가능 여부 제어
- PostgreSQL 등 관리형 DB로 실제 전환 실행(현재는 전환 방법만 문서화된 상태)
- 알림을 폴링/배지 갱신이 아닌 실시간(웹소켓·SSE)으로 전달
- 이메일 발송(신규 일정 등록 시 팀장에게 메일도 함께 전송 등)
- E2E 테스트(Playwright 등)로 브라우저 단 흐름까지 커버 — 현재는 API 레벨 유닛 테스트만 존재
