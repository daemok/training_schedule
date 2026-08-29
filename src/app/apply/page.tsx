import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logout } from "@/app/login/actions";
import { ApplyViewSwitcher } from "./ApplyViewSwitcher";
import { MonthlyAnnouncementBox } from "./MonthlyAnnouncementBox";

export default async function ApplyPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "GENERAL" && user.role !== "TEAM_LEAD" && user.role !== "MANAGER") {
    redirect("/calendar");
  }

  // 신청 가능 기간은 일반 사용자에게만 적용된다 — 팀장/매니저는 기간과 무관하게 모든 강의를
  // 볼 수 있다(상급자 예외, src/app/api/lecture-requests/route.ts와 동일한 규칙).
  const now = new Date();
  const [lectureTypes, announcement] = await Promise.all([
    prisma.lectureType.findMany({
      where: {
        isActive: true,
        ...(user.role === "GENERAL"
          ? {
              AND: [
                { OR: [{ applicationStartDate: null }, { applicationStartDate: { lte: now } }] },
                { OR: [{ applicationEndDate: null }, { applicationEndDate: { gte: now } }] },
              ],
            }
          : {}),
      },
      orderBy: { name: "asc" },
    }),
    prisma.monthlyAnnouncement.findFirst(),
  ]);
  const canManageAnnouncement = user.role === "TEAM_LEAD" || user.role === "MANAGER";

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/" className="text-sm text-zinc-500 hover:underline">
            ← 홈으로
          </Link>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">강의 신청</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            강의 유형과 날짜를 선택하면 신청 가능한 강사와 시간대가 표시됩니다.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/apply/my" className="text-sm text-zinc-500 hover:underline">
            내 신청 내역
          </Link>
          <Link href="/public-calendar" className="text-sm text-zinc-500 hover:underline">
            확정 강의 캘린더
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

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[280px_1fr]">
        <MonthlyAnnouncementBox
          initialContent={announcement?.content ?? ""}
          canManage={canManageAnnouncement}
        />
        <ApplyViewSwitcher lectureTypes={lectureTypes} />
      </div>
    </div>
  );
}
