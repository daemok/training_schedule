import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { logout } from "@/app/login/actions";
import { UserManager } from "./UserManager";

export default async function AdminUsersPage() {
  const user = await getCurrentUser();
  if (!user || user.role !== "MANAGER") {
    redirect("/login");
  }

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      instructor: { select: { name: true } },
      createdAt: true,
    },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-4xl flex-col gap-6 px-4 py-6 sm:px-6 sm:py-10">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link href="/admin" className="text-sm text-zinc-500 hover:underline">
            ← 관리자 페이지로
          </Link>
          <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">사용자 관리</h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            로그인 가능한 모든 계정(강사·팀장·매니저·일반 사용자)의 이메일·이름을 수정하고,
            비밀번호를 재설정하거나 계정을 삭제할 수 있습니다. 매니저 전용 화면입니다.
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

      <UserManager
        currentUserId={user.userId}
        initialUsers={users.map((u) => ({
          id: u.id,
          email: u.email,
          name: u.name,
          role: u.role,
          status: u.status,
          instructorName: u.instructor?.name ?? null,
          createdAt: u.createdAt.toISOString(),
        }))}
      />
    </div>
  );
}
