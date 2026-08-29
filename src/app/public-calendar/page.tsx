import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { formatDateOnly, toDateOnly } from "@/lib/date";
import { fetchPublicLectureSchedules } from "@/lib/schedule-query";
import { getViewRange, nextMonthAnchor } from "@/app/calendar/date-utils";
import { logout } from "@/app/login/actions";
import { PublicCalendarView } from "./PublicCalendarView";
import type { InstructorOption, ViewMode } from "@/app/calendar/types";

type SearchParams = Promise<{
  view?: string;
  date?: string;
  instructor?: string;
}>;

const VALID_VIEWS: ViewMode[] = ["month", "week", "day"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 공용 캘린더 — 확정된 강의만 오전/오후/저녁 + 강의유형 + 강사명으로 보여주는, 로그인한
 * 모든 역할(GENERAL 포함)이 열람 가능한 화면. 개인일정/미확정 건은 애초에 조회되지 않고,
 * 등록/수정/삭제 같은 관리 기능도 없다(순수 조회 전용) — src/app/calendar/(운영 캘린더)와
 * 달리 GENERAL이 proxy.ts에서 차단되지 않는다.
 */
export default async function PublicCalendarPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;

  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  const view: ViewMode = VALID_VIEWS.includes(params.view as ViewMode)
    ? (params.view as ViewMode)
    : "month";
  // ?date= 파라미터가 없으면 다음 달을 기본으로 보여준다.
  const dateStr =
    params.date && DATE_RE.test(params.date) ? params.date : formatDateOnly(nextMonthAnchor());
  const instructorFilter =
    params.instructor && params.instructor !== "ALL" ? params.instructor : "ALL";

  const anchor = toDateOnly(dateStr);
  const { start, end } = getViewRange(view, anchor);
  const instructorId = instructorFilter !== "ALL" ? Number(instructorFilter) : undefined;

  const [instructors, initialSchedules] = await Promise.all([
    prisma.instructor.findMany({ orderBy: { id: "asc" } }),
    fetchPublicLectureSchedules({ from: start, to: end, instructorId }),
  ]);

  const instructorOptions: InstructorOption[] = instructors.map((i) => ({
    id: i.id,
    name: i.name,
    brand: "",
    status: i.status,
  }));

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            ← 홈으로
          </Link>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            확정 강의 캘린더
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {user.email}님 — 확정된 강의만 오전/오후/저녁 시간대, 강의유형, 강사명으로
            표시됩니다.
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

      <PublicCalendarView
        instructors={instructorOptions}
        initialView={view}
        initialDate={dateStr}
        initialInstructorFilter={instructorFilter}
        initialSchedules={initialSchedules}
      />
    </div>
  );
}
