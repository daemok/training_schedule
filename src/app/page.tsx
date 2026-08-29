import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logout } from "@/app/login/actions";

const ROLE_LABEL: Record<string, string> = {
  INSTRUCTOR: "강사",
  TEAM_LEAD: "팀장",
  MANAGER: "매니저",
  GENERAL: "일반 사용자",
};

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-2xl flex-col items-center gap-6 px-6 py-24 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-black dark:text-zinc-50">
          강사 스케줄 관리
        </h1>
        <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          {user.email}님, {ROLE_LABEL[user.role]}로 로그인되어 있습니다.{" "}
          {user.role === "GENERAL"
            ? "강의 유형과 날짜를 선택해 강사의 강의 가능 일정을 확인하고 강의를 신청할 수 있습니다."
            : user.role === "INSTRUCTOR"
              ? "본인의 강의/개인일정을 오전·오후·저녁 블록 단위로 등록·관리할 수 있습니다."
              : "팀장·매니저는 상급자로서 모든 강사의 스케줄을 캘린더에서 조회·등록·수정·삭제하고, 강사·가입 승인 등 관리자 기능과 일반 사용자의 강의 신청 기능까지 모두 사용할 수 있습니다."}
        </p>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
          {user.role === "GENERAL" && (
            <>
              <Link
                href="/apply"
                className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
              >
                강의 신청하기
              </Link>
              <Link
                href="/apply/my"
                className="flex h-12 items-center justify-center rounded-full border border-black/[.15] px-6 text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.06]"
              >
                내 신청 내역
              </Link>
              <Link
                href="/public-calendar"
                className="flex h-12 items-center justify-center rounded-full border border-black/[.15] px-6 text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.06]"
              >
                확정 강의 캘린더
              </Link>
            </>
          )}
          {user.role === "INSTRUCTOR" && (
            <>
              <Link
                href="/calendar"
                className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
              >
                운영 캘린더 보기
              </Link>
              <Link
                href="/my-schedule"
                className="flex h-12 items-center justify-center rounded-full border border-black/[.15] px-6 text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.06]"
              >
                내 스케줄 관리
              </Link>
              <Link
                href="/public-calendar"
                className="flex h-12 items-center justify-center rounded-full border border-black/[.15] px-6 text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.06]"
              >
                확정 강의 캘린더
              </Link>
            </>
          )}
          {(user.role === "TEAM_LEAD" || user.role === "MANAGER") && (
            <>
              <Link
                href="/calendar"
                className="flex h-12 items-center justify-center rounded-full bg-foreground px-6 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc]"
              >
                운영 캘린더 보기
              </Link>
              <Link
                href="/admin"
                className="flex h-12 items-center justify-center rounded-full border border-black/[.15] px-6 text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.06]"
              >
                관리자 페이지
              </Link>
              <Link
                href="/apply"
                className="flex h-12 items-center justify-center rounded-full border border-black/[.15] px-6 text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.06]"
              >
                강의 신청하기
              </Link>
              <Link
                href="/public-calendar"
                className="flex h-12 items-center justify-center rounded-full border border-black/[.15] px-6 text-black transition-colors hover:bg-black/[.04] dark:border-white/[.2] dark:text-zinc-50 dark:hover:bg-white/[.06]"
              >
                확정 강의 캘린더
              </Link>
            </>
          )}
        </div>
        <div className="flex items-center gap-4">
          <Link href="/account" className="text-sm text-zinc-500 hover:underline dark:text-zinc-400">
            비밀번호 변경
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
      </main>
    </div>
  );
}
