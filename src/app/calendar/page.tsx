import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { toDateOnly, formatDateOnly } from "@/lib/date";
import { fetchMaskedSchedules } from "@/lib/schedule-query";
import { getViewRange } from "./date-utils";
import { CalendarView } from "./CalendarView";
import { logout } from "@/app/login/actions";
import type { InstructorOption, ViewMode } from "./types";

type SearchParams = Promise<{
  view?: string;
  date?: string;
  instructor?: string;
}>;

const VALID_VIEWS: ViewMode[] = ["month", "week", "day"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  // 뷰어의 역할/본인 강사 id는 반드시 서버가 검증한 세션에서만 가져온다.
  // (클라이언트가 role/viewerId 쿼리 파라미터로 다른 역할·강사를 사칭할 수 없어야 한다)
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const view: ViewMode = VALID_VIEWS.includes(params.view as ViewMode)
    ? (params.view as ViewMode)
    : "month";
  const dateStr =
    params.date && DATE_RE.test(params.date) ? params.date : formatDateOnly(new Date());
  const instructorFilter =
    params.instructor && params.instructor !== "ALL" ? params.instructor : "ALL";

  const anchor = toDateOnly(dateStr);
  const { start, end } = getViewRange(view, anchor);
  const instructorId = instructorFilter !== "ALL" ? Number(instructorFilter) : undefined;

  const [instructors, initialSchedules] = await Promise.all([
    prisma.instructor.findMany({ orderBy: { id: "asc" } }),
    fetchMaskedSchedules({
      from: start,
      to: end,
      instructorId,
      viewer: { role: user.role, instructorId: user.instructorId ?? undefined },
    }),
  ]);

  const instructorOptions: InstructorOption[] = instructors.map((i) => ({
    id: i.id,
    name: i.name,
    team: i.team,
    status: i.status,
  }));

  const ROLE_LABEL: Record<string, string> = {
    INSTRUCTOR: "강사",
    TEAM_LEAD: "팀장",
    MANAGER: "매니저",
  };

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            ← 홈으로
          </Link>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            전체 스케줄 캘린더
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {user.email} · {ROLE_LABEL[user.role]}로 로그인됨 — &quot;전체 강사&quot; 선택 시
            강사별로 색상이 구분되며, 개인일정 상세는 본인 또는 팀장/매니저만 열람할 수
            있습니다. 팀장/매니저는 모든 강사의 일정을 등록·수정·삭제할 수 있습니다.
          </p>
        </div>
        <form action={logout}>
          <button
            type="submit"
            className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            로그아웃
          </button>
        </form>
      </div>

      <CalendarView
        instructors={instructorOptions}
        initialView={view}
        initialDate={dateStr}
        initialInstructorFilter={instructorFilter}
        viewerRole={user.role}
        viewerInstructorId={user.instructorId}
        initialSchedules={initialSchedules}
      />
    </div>
  );
}
