import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth/current-user";
import { ChangePasswordForm } from "./ChangePasswordForm";

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) {
    redirect("/login");
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2">
        <Link href="/" className="text-sm text-zinc-500 hover:underline">
          ← 홈으로
        </Link>
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">비밀번호 변경</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">{user.email} 계정의 비밀번호를 변경합니다.</p>
      </div>

      <ChangePasswordForm />
    </div>
  );
}
