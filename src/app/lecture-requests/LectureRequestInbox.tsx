"use client";

import { useState } from "react";
import { TIME_BLOCK_LABEL } from "@/lib/schedule-labels";
import { Toast } from "@/components/Toast";

interface PendingRequest {
  id: number;
  instructorName: string;
  lectureTypeName: string;
  requesterLabel: string;
  date: string;
  timeBlock: "MORNING" | "AFTERNOON" | "EVENING";
  startTime: string;
  endTime: string;
  fcLos: string;
  location: string;
  attendeeCount: number;
  content: string;
  /** 같은 날짜+시간대에 접수된 순서(1, 2, 3...) — 강의 지역 수용 한계 때문에 확인이 필요하다. */
  queuePosition: number;
}

const TOAST_DURATION_MS = 3000;

export function LectureRequestInbox({ initialRequests }: { initialRequests: PendingRequest[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [processingId, setProcessingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }

  async function handleDecision(id: number, decision: "confirm" | "reject") {
    setProcessingId(id);
    setError(null);
    const res = await fetch(`/api/lecture-requests/${id}/${decision}`, { method: "POST" });
    setProcessingId(null);
    if (res.ok) {
      setRequests((prev) => prev.filter((r) => r.id !== id));
      showToast(decision === "confirm" ? "강의 신청을 확정했습니다." : "강의 신청을 거절했습니다.");
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

      {requests.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          확정 대기 중인 강의 신청이 없습니다.
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {requests.map((r) => (
            <li
              key={r.id}
              className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-2 font-medium text-black dark:text-zinc-50">
                  <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-zinc-50 dark:text-black">
                    {r.date} {TIME_BLOCK_LABEL[r.timeBlock]} {r.queuePosition}번째
                  </span>
                  {r.lectureTypeName} · {r.instructorName} 강사
                </span>
                <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                  가신청
                </span>
              </div>
              <div className="text-sm text-zinc-500 dark:text-zinc-400">
                {r.date} · {TIME_BLOCK_LABEL[r.timeBlock]} · {r.startTime}~{r.endTime}
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                신청자: {r.requesterLabel} · 장소: {r.location} · 참석인원: {r.attendeeCount}명 ·
                FC/LOS: {r.fcLos}
              </div>
              <div className="text-sm text-zinc-600 dark:text-zinc-300">{r.content}</div>

              <div className="mt-2 flex justify-end gap-2">
                <button
                  onClick={() => handleDecision(r.id, "reject")}
                  disabled={processingId === r.id}
                  className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:border-black disabled:opacity-50 dark:border-zinc-700 dark:hover:border-zinc-50"
                >
                  거절
                </button>
                <button
                  onClick={() => handleDecision(r.id, "confirm")}
                  disabled={processingId === r.id}
                  className="rounded-full bg-black px-4 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
                >
                  확정
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
