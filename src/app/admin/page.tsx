import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logout } from "@/app/login/actions";

/**
 * 관리자 페이지 — 팀장/매니저 전용 관리 화면(강사 및 강의 관리, 가입 승인)으로 이동하는 허브.
 * 각 카드에 대기 중인 항목 수를 함께 보여줘 어디부터 처리해야 할지 한눈에 파악할 수 있다.
 */
export default async function AdminHomePage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "TEAM_LEAD" && user.role !== "MANAGER")) {
    redirect("/login");
  }

  const [instructorCount, pendingSignupCount, pendingLectureRequestCount] = await Promise.all([
    prisma.instructor.count(),
    prisma.user.count({ where: { role: "GENERAL", status: "PENDING" } }),
    prisma.lectureRequest.count({ where: { status: "PENDING" } }),
  ]);

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/calendar" className="text-sm text-zinc-500 hover:underline">
            ← 캘린더로
          </Link>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">관리자 페이지</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            강사 등록·강의 프로그램 관리와 일반 사용자 가입 승인을 이곳에서 처리합니다.
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

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Link
          href="/admin/instructors"
          className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-5 transition-colors hover:border-black dark:border-zinc-800 dark:hover:border-zinc-50"
        >
          <span className="text-lg font-semibold text-black dark:text-zinc-50">
            강사 및 강의 관리
          </span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            강사 등록·수정·삭제, 강의 프로그램 생성 및 강사별 배정
          </span>
          <span className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            등록된 강사 {instructorCount}명
          </span>
        </Link>

        <Link
          href="/admin/signups"
          className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-5 transition-colors hover:border-black dark:border-zinc-800 dark:hover:border-zinc-50"
        >
          <span className="text-lg font-semibold text-black dark:text-zinc-50">가입 승인</span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            강의를 신청하려는 일반 사용자의 가입을 승인·거절
          </span>
          <span className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {pendingSignupCount > 0 ? (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                승인 대기 {pendingSignupCount}건
              </span>
            ) : (
              "승인 대기 없음"
            )}
          </span>
        </Link>

        <Link
          href="/lecture-requests"
          className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-5 transition-colors hover:border-black dark:border-zinc-800 dark:hover:border-zinc-50"
        >
          <span className="text-lg font-semibold text-black dark:text-zinc-50">강의 신청 관리</span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            접수된 강의 신청을 확정하거나 거절
          </span>
          <span className="mt-2 text-xs text-zinc-500 dark:text-zinc-400">
            {pendingLectureRequestCount > 0 ? (
              <span className="font-medium text-amber-600 dark:text-amber-400">
                확정 대기 {pendingLectureRequestCount}건
              </span>
            ) : (
              "확정 대기 없음"
            )}
          </span>
        </Link>

        <Link
          href="/apply"
          className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-5 transition-colors hover:border-black dark:border-zinc-800 dark:hover:border-zinc-50"
        >
          <span className="text-lg font-semibold text-black dark:text-zinc-50">강의 신청하기</span>
          <span className="text-sm text-zinc-500 dark:text-zinc-400">
            일반 사용자와 동일하게 강사의 강의 가능 일정을 확인하고 직접 신청
          </span>
        </Link>

        {user.role === "MANAGER" && (
          <Link
            href="/admin/users"
            className="flex flex-col gap-2 rounded-xl border border-zinc-200 p-5 transition-colors hover:border-black dark:border-zinc-800 dark:hover:border-zinc-50"
          >
            <span className="text-lg font-semibold text-black dark:text-zinc-50">사용자 관리</span>
            <span className="text-sm text-zinc-500 dark:text-zinc-400">
              로그인 계정의 이메일·이름 수정, 비밀번호 재설정, 삭제 (매니저 전용)
            </span>
          </Link>
        )}
      </div>
    </div>
  );
}
