import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { formatDateOnly } from "@/lib/date";
import { logout } from "@/app/login/actions";
import { attachQueuePositions } from "@/lib/lecture-request-queue";
import { MyRequestsViewSwitcher } from "./MyRequestsViewSwitcher";
import type { MyRequestRow } from "./types";

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

  const rows: MyRequestRow[] = requestsWithPosition.map((r) => ({
    id: r.id,
    date: formatDateOnly(r.date),
    timeBlock: r.timeBlock,
    startTime: r.startTime,
    endTime: r.endTime,
    status: r.status,
    lectureTypeName: r.lectureType.name,
    instructorName: r.instructor.name,
    location: r.location,
    attendeeCount: r.attendeeCount,
    fcLos: r.fcLos,
    content: r.content,
    rejectionReason: r.rejectionReason,
    queuePosition: r.queuePosition,
  }));

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

      <MyRequestsViewSwitcher requests={rows} />
    </div>
  );
}
