"use client";

import { useState, type FormEvent } from "react";

export interface InstructorOption {
  id: number;
  name: string;
  team: string;
  status: "ACTIVE" | "INACTIVE";
}

export type SubmitResult =
  | { ok: true; email?: string; temporaryPassword?: string }
  | { ok: false; error: string };

interface Props {
  initial: InstructorOption | null;
  onCancel: () => void;
  onSubmit: (payload: {
    name: string;
    team: string;
    status: "ACTIVE" | "INACTIVE";
    email?: string;
  }) => Promise<SubmitResult>;
}

/** 강사 등록·수정 모달 (강사 관리 화면, 팀장/매니저 전용). */
export function InstructorFormModal({ initial, onCancel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [team, setTeam] = useState(initial?.team ?? "");
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(initial?.status ?? "ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [created, setCreated] = useState<{ email: string; temporaryPassword: string } | null>(
    null
  );
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("강사 이름을 입력해주세요.");
      return;
    }
    if (!team.trim()) {
      setError("소속 팀을 입력해주세요.");
      return;
    }
    if (!initial && !email.trim()) {
      setError("로그인에 사용할 이메일을 입력해주세요.");
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await onSubmit({
      name: name.trim(),
      team: team.trim(),
      status,
      ...(initial ? {} : { email: email.trim() }),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    if (result.email && result.temporaryPassword) {
      setCreated({ email: result.email, temporaryPassword: result.temporaryPassword });
    }
  }

  async function handleCopy() {
    if (!created) return;
    await navigator.clipboard.writeText(
      `이메일: ${created.email}\n임시 비밀번호: ${created.temporaryPassword}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (created) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
          <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">
            강사가 등록되었습니다
          </h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            아래 로그인 정보를 강사에게 전달해주세요. 이 창을 닫으면 비밀번호는 다시 확인할 수
            없습니다.
          </p>
          <div className="mb-4 flex flex-col gap-2 rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">이메일 </span>
              <span className="font-mono text-black dark:text-zinc-50">{created.email}</span>
            </div>
            <div>
              <span className="text-zinc-500 dark:text-zinc-400">임시 비밀번호 </span>
              <span className="font-mono font-semibold text-black dark:text-zinc-50">
                {created.temporaryPassword}
              </span>
            </div>
          </div>
          <p className="mb-4 text-xs text-zinc-500">
            강사는 로그인 후 &quot;비밀번호 변경&quot;(/account) 화면에서 직접 새 비밀번호로
            바꿀 수 있습니다.
          </p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              {copied ? "복사됨" : "복사"}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="mb-4 text-lg font-semibold text-black dark:text-zinc-50">
          {initial ? "강사 정보 수정" : "새 강사 등록"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              이름
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              소속 팀
            </label>
            <input
              type="text"
              value={team}
              onChange={(e) => setTeam(e.target.value)}
              placeholder="예: A팀"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          {!initial && (
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                로그인 이메일
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="instructor@example.com"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <p className="mt-1 text-xs text-zinc-500">
                이 강사가 로그인할 때 사용할 이메일입니다. 임시 비밀번호가 자동 생성되어
                등록 직후 한 번만 표시됩니다.
              </p>
            </div>
          )}
          <div>
            <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              상태
            </span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                <input
                  type="radio"
                  name="status"
                  checked={status === "ACTIVE"}
                  onChange={() => setStatus("ACTIVE")}
                />
                활성
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                <input
                  type="radio"
                  name="status"
                  checked={status === "INACTIVE"}
                  onChange={() => setStatus("INACTIVE")}
                />
                비활성
              </label>
            </div>
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {error}
            </p>
          )}

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
            >
              {submitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
