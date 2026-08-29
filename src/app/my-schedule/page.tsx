import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { resolveYearMonth, monthRange, shiftMonth, formatDateOnly } from "@/lib/date";
import { logout } from "@/app/login/actions";
import { ScheduleViewSwitcher } from "./ScheduleViewSwitcher";

type SearchParams = Promise<{ year?: string; month?: string }>;

export default async function MySchedulePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const user = await getCurrentUser();
  // 프록시가 이미 인증/역할을 검사하지만, 서버 컴포넌트 자체에서도 방어적으로 재확인한다.
  if (!user || user.role !== "INSTRUCTOR" || !user.instructorId) {
    redirect("/login");
  }
  const instructorId = user.instructorId;

  const instructor = await prisma.instructor.findUnique({
    where: { id: instructorId },
    include: { brands: { include: { brand: { select: { name: true } } } } },
  });
  if (!instructor) {
    redirect("/login");
  }

  const { year, month } = resolveYearMonth(params);
  const { start, end } = monthRange(year, month);

  const [schedules, pendingRequestCount] = await Promise.all([
    prisma.schedule.findMany({
      where: { instructorId, date: { gte: start, lt: end } },
      orderBy: [{ date: "asc" }, { startTime: "asc" }],
    }),
    prisma.lectureRequest.count({ where: { instructorId, status: "PENDING" } }),
  ]);

  const prev = shiftMonth(year, month, -1);
  const next = shiftMonth(year, month, 1);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-1">
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            ← 홈으로
          </Link>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">
            {instructor.name}님의 스케줄
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {instructor.brands.map((b) => b.brand.name).join(", ")} · 본인이 등록한 스케줄만
            수정/삭제할 수 있습니다.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/lecture-requests" className="text-sm text-zinc-500 hover:underline">
            강의 신청 관리{pendingRequestCount > 0 ? ` (${pendingRequestCount})` : ""}
          </Link>
          <form action={logout}>
            <button
              type="submit"
              className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
            >
              로그아웃
            </button>
          </form>
        </div>
      </div>

      <ScheduleViewSwitcher
        instructorId={instructorId}
        year={year}
        month={month}
        prevHref={`/my-schedule?year=${prev.year}&month=${prev.month}`}
        nextHref={`/my-schedule?year=${next.year}&month=${next.month}`}
        schedules={schedules.map((s) => ({
          id: s.id,
          date: formatDateOnly(s.date),
          timeBlock: s.timeBlock,
          startTime: s.startTime,
          endTime: s.endTime,
          scheduleType: s.scheduleType,
          status: s.status,
          title: s.title,
          location: s.location,
          memo: s.memo,
        }))}
      />
    </div>
  );
}
