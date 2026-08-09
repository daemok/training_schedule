"use client";

import { useActionState } from "react";
import { signup, SignupState } from "./actions";

const initialState: SignupState = {};

export default function SignupPage() {
  const [state, formAction, pending] = useActionState(signup, initialState);

  if (state.success) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">가입 신청 완료</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          가입 신청이 접수되었습니다. 팀장 또는 매니저의 승인 후 로그인할 수 있습니다.
        </p>
        <a href="/login" className="text-sm font-medium text-black underline dark:text-zinc-50">
          로그인 화면으로 이동
        </a>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-sm flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">회원가입</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          강의 신청을 위한 일반 사용자 계정을 만듭니다. 가입 후 팀장/매니저 승인이 필요합니다.
        </p>
      </div>

      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            이메일
          </label>
          <input
            name="email"
            type="email"
            required
            autoComplete="username"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            이름
          </label>
          <input
            name="name"
            type="text"
            required
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            비밀번호
          </label>
          <input
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <p className="mt-1 text-xs text-zinc-500">
            8자 이상, 특수문자(!@#$%^&* 등)를 1개 이상 포함해주세요.
          </p>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            비밀번호 확인
          </label>
          <input
            name="passwordConfirm"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>

        {state.error && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {state.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
        >
          {pending ? "가입 신청 중..." : "가입 신청"}
        </button>
      </form>

      <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
        이미 계정이 있으신가요?{" "}
        <a href="/login" className="text-black underline dark:text-zinc-50">
          로그인
        </a>
      </p>
    </div>
  );
}
