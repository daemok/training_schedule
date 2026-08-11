import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { formatDateOnly } from "@/lib/date";
import { TIME_BLOCK_LABEL } from "@/lib/schedule-labels";
import { logout } from "@/app/login/actions";
import { attachQueuePositions } from "@/lib/lecture-request-queue";

const STATUS_LABEL: Record<string, string> = {
  PENDING: "미확정 (확정 대기)",
  CONFIRMED: "확정됨",
  REJECTED: "거절됨",
};

const STATUS_CLASS: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  CONFIRMED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};

export default async function MyLectureRequestsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "GENERAL" && user.role !== "TEAM_LEAD" && user.role !== "MANAGER") {
    redirect("/calendar");
  }

  const requests = await prisma.lectureRequest.findMany({
    where: { requesterId: user.userId },
    include: { instructor: { select: { name: true } }, lectureType: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
  const requestsWithPosition = await attachQueuePositions(requests);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/apply" className="text-sm text-zinc-500 hover:underline">
            ← 강의 신청으로
          </Link>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">내 신청 내역</h1>
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

      {requestsWithPosition.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          신청한 강의가 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requestsWithPosition.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium text-black dark:text-zinc-50">
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-zinc-50 dark:text-black">
                    {formatDateOnly(r.date)} {TIME_BLOCK_LABEL[r.timeBlock]} {r.queuePosition}번째
                  </span>
                  {r.lectureType.name} · {r.instructor.name} 강사
                </span>
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_CLASS[r.status]}`}>
                  {STATUS_LABEL[r.status]}
                </span>
              </div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {formatDateOnly(r.date)} · {TIME_BLOCK_LABEL[r.timeBlock]} · {r.startTime}~
                {r.endTime}
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                장소: {r.location} · 참석인원: {r.attendeeCount}명 · FC/LOS: {r.fcLos}
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-300">{r.content}</div>
              {r.status === "REJECTED" && r.rejectionReason && (
                <div className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                  거절 사유: {r.rejectionReason}
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
