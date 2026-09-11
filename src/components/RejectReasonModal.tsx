"use client";

import { useState, type FormEvent } from "react";
import { LoadingOverlay } from "@/components/LoadingOverlay";

interface Props {
  onCancel: () => void;
  onSubmit: (reason: string) => void;
  submitting?: boolean;
}

/** 강의 신청 거절 시 사유 입력을 강제하는 모달. */
export function RejectReasonModal({ onCancel, onSubmit, submitting }: Props) {
  const [reason, setReason] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!reason.trim()) return;
    onSubmit(reason.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="relative w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        {submitting && <LoadingOverlay label="거절 처리 중..." />}
        <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">
          강의 신청을 거절할까요?
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              거절 사유
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              autoFocus
              placeholder="신청자에게 전달될 거절 사유를 입력해주세요."
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div className="mt-1 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting || !reason.trim()}
              className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {submitting ? "거절 처리 중..." : "거절 확정"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
