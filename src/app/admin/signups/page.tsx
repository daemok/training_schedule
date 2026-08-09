import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logout } from "@/app/login/actions";
import { SignupApprovalList } from "./SignupApprovalList";

export default async function AdminSignupsPage() {
  const user = await getCurrentUser();
  if (!user || (user.role !== "TEAM_LEAD" && user.role !== "MANAGER")) {
    redirect("/login");
  }

  const pending = await prisma.user.findMany({
    where: { role: "GENERAL", status: "PENDING" },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
            ← 관리자 페이지로
          </Link>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">가입 승인 관리</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            강의를 신청하려는 일반 사용자의 가입을 승인하거나 거절합니다.
          </p>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/admin/instructors" className="text-sm text-zinc-500 hover:underline">
            강사 관리
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

      <SignupApprovalList
        initialPending={pending.map((p) => ({
          id: p.id,
          email: p.email,
          name: p.name,
          createdAt: p.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
