import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { formatDateOnly } from "@/lib/date";
import { logout } from "@/app/login/actions";
import { attachQueuePositions } from "@/lib/lecture-request-queue";
import { LectureRequestInbox } from "./LectureRequestInbox";

export default async function LectureRequestsPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }
  if (user.role !== "INSTRUCTOR" && user.role !== "TEAM_LEAD" && user.role !== "MANAGER") {
    redirect("/apply");
  }

  const pending = await prisma.lectureRequest.findMany({
    where: {
      status: "PENDING",
      ...(user.role === "INSTRUCTOR" ? { instructorId: user.instructorId ?? -1 } : {}),
    },
    include: {
      instructor: { select: { name: true } },
      lectureType: { select: { name: true } },
      requester: { select: { email: true, name: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const pendingWithPosition = await attachQueuePositions(pending);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/calendar" className="text-sm text-zinc-500 hover:underline">
            ← 캘린더로
          </Link>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">강의 신청 관리</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {user.role === "INSTRUCTOR"
              ? "본인 앞으로 접수된 강의 신청을 확정하거나 거절할 수 있습니다."
              : "모든 강사 앞으로 접수된 강의 신청을 확정하거나 거절할 수 있습니다."}
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

      <LectureRequestInbox
        initialRequests={pendingWithPosition.map((r) => ({
          id: r.id,
          instructorName: r.instructor.name,
          lectureTypeName: r.lectureType.name,
          requesterLabel: r.requester.name ?? r.requester.email,
          date: formatDateOnly(r.date),
          timeBlock: r.timeBlock,
          startTime: r.startTime,
          endTime: r.endTime,
          fcLos: r.fcLos,
          location: r.location,
          attendeeCount: r.attendeeCount,
          content: r.content,
          queuePosition: r.queuePosition,
        }))}
      />
    </div>
  );
}
