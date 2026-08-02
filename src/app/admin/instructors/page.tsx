import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logout } from "@/app/login/actions";
import { InstructorManager } from "./InstructorManager";

export default async function AdminInstructorsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "TEAM_LEAD" && user.role !== "MANAGER")) {
    redirect("/login");
  }

  const [instructors, lectureTypes, links] = await Promise.all([
    prisma.instructor.findMany({ orderBy: { name: "asc" } }),
    prisma.lectureType.findMany({ orderBy: { name: "asc" } }),
    prisma.instructorLectureType.findMany(),
  ]);

  const assignmentsByInstructor = new Map<number, number[]>();
  for (const link of links) {
    const list = assignmentsByInstructor.get(link.instructorId) ?? [];
    list.push(link.lectureTypeId);
    assignmentsByInstructor.set(link.instructorId, list);
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/calendar" className="text-sm text-zinc-500 hover:underline">
            ← 캘린더로
          </Link>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">강사 관리</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            강사를 등록·수정·삭제하고, 강의 유형을 만들어 강사별로 배정합니다.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/signups" className="text-sm text-zinc-500 hover:underline">
            가입 승인 관리
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

      <InstructorManager
        instructors={instructors.map((i) => ({ id: i.id, name: i.name, team: i.team, status: i.status }))}
        lectureTypes={lectureTypes}
        assignmentsByInstructor={Object.fromEntries(assignmentsByInstructor)}
      />
    </div>
  );
}
