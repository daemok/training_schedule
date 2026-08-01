"use client";

import { useState } from "react";
import { Toast } from "@/components/Toast";

interface PendingSignup {
  id: number;
  email: string;
  name: string | null;
  createdAt: string;
}

const TOAST_DURATION_MS = 3000;

export function SignupApprovalList({ initialPending }: { initialPending: PendingSignup[] }) {
  const [pending, setPending] = useState(initialPending);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }

  async function handleDecision(id: number, decision: "approve" | "reject") {
    setProcessingId(id);
    setError(null);
    const res = await fetch(`/api/signups/${id}/${decision}`, { method: "POST" });
    setProcessingId(null);
    if (res.ok) {
      setPending((prev) => prev.filter((p) => p.id !== id));
      showToast(decision === "approve" ? "가입을 승인했습니다." : "가입을 거절했습니다.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "처리에 실패했습니다.");
  }

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {pending.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          승인 대기 중인 가입이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {pending.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-lg border border-zinc-200 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800"
            >
              <div>
                <div className="font-medium text-black dark:text-zinc-50">{p.name ?? "(이름 없음)"}</div>
                <div className="text-sm text-zinc-500">{p.email}</div>
                <div className="text-xs text-zinc-400">
                  신청일: {new Date(p.createdAt).toLocaleString("ko-KR")}
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleDecision(p.id, "reject")}
                  disabled={processingId === p.id}
                  className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:border-black disabled:opacity-50 dark:border-zinc-700 dark:hover:border-zinc-50"
                >
                  거절
                </button>
                <button
                  onClick={() => handleDecision(p.id, "approve")}
                  disabled={processingId === p.id}
                  className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
                >
                  승인
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
