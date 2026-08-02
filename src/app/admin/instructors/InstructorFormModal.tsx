"use client";

import { useState, type FormEvent } from "react";

export interface InstructorOption {
  id: number;
  name: string;
  team: string;
  status: "ACTIVE" | "INACTIVE";
}

export type SubmitResult = { ok: true } | { ok: false; error: string };

interface Props {
  initial: InstructorOption | null;
  onCancel: () => void;
  onSubmit: (payload: { name: string; team: string; status: "ACTIVE" | "INACTIVE" }) => Promise<SubmitResult>;
}

/** 강사 등록·수정 모달 (강사 관리 화면, 팀장/매니저 전용). */
export function InstructorFormModal({ initial, onCancel, onSubmit }: Props) {
  const [name, setName] = useState(initial?.name ?? "");
  const [team, setTeam] = useState(initial?.team ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE">(initial?.status ?? "ACTIVE");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    setError(null);
    setSubmitting(true);
    const result = await onSubmit({ name: name.trim(), team: team.trim(), status });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
    }
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
