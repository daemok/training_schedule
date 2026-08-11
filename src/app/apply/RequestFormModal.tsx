"use client";

import { useEffect, useState, type FormEvent } from "react";
import { TIME_BLOCK_LABEL, TIME_BLOCK_RANGE, type TimeBlock } from "@/lib/schedule-labels";

export interface RequestFormPayload {
  instructorId: number;
  lectureTypeId: number;
  date: string;
  timeBlock: TimeBlock;
  startTime: string;
  endTime: string;
  fcLos: string;
  location: string;
  attendeeCount: number;
  content: string;
}

export type SubmitResult = { ok: true } | { ok: false; error: string };

interface Props {
  instructorId: number;
  instructorName: string;
  lectureTypeId: number;
  date: string;
  timeBlock: TimeBlock;
  /** 신청서 작성 잠금 만료 시각(ms epoch) — 이 시각이 지나면 자동으로 닫힌다(다른 사용자가 입력할 수 있도록). */
  lockExpiresAt: number;
  onCancel: () => void;
  onTimeout: () => void;
  onSubmit: (payload: RequestFormPayload) => Promise<SubmitResult>;
}

function formatRemaining(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function RequestFormModal({
  instructorId,
  instructorName,
  lectureTypeId,
  date,
  timeBlock,
  lockExpiresAt,
  onCancel,
  onTimeout,
  onSubmit,
}: Props) {
  const range = TIME_BLOCK_RANGE[timeBlock];
  const [startTime, setStartTime] = useState(range.start);
  const [endTime, setEndTime] = useState(range.end);
  const [fcLos, setFcLos] = useState("");
  const [location, setLocation] = useState("");
  const [attendeeCount, setAttendeeCount] = useState("");
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remainingMs, setRemainingMs] = useState(() => lockExpiresAt - Date.now());

  useEffect(() => {
    const timer = setInterval(() => {
      const remaining = lockExpiresAt - Date.now();
      setRemainingMs(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
        onTimeout();
      }
    }, 1000);
    return () => clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lockExpiresAt]);

  function validate(): string | null {
    if (!startTime || !endTime || endTime <= startTime) {
      return "요청 시간이 올바르지 않습니다.";
    }
    if (startTime < range.start || endTime > range.end) {
      return `요청 시간은 ${TIME_BLOCK_LABEL[timeBlock]} 범위(${range.start}~${range.end}) 내여야 합니다.`;
    }
    if (!fcLos.trim()) return "FC/LOS를 입력해주세요.";
    if (!location.trim()) return "장소를 입력해주세요.";
    const count = Number(attendeeCount);
    if (!Number.isInteger(count) || count <= 0) return "참석 인원을 올바르게 입력해주세요.";
    if (!content.trim()) return "강의 요청 목적을 입력해주세요.";
    return null;
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const clientError = validate();
    if (clientError) {
      setError(clientError);
      return;
    }
    setError(null);
    setSubmitting(true);
    const result = await onSubmit({
      instructorId,
      lectureTypeId,
      date,
      timeBlock,
      startTime,
      endTime,
      fcLos: fcLos.trim(),
      location: location.trim(),
      attendeeCount: Number(attendeeCount),
      content: content.trim(),
    });
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <div className="mb-1 flex items-center justify-between gap-2">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">강의 신청</h2>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
              remainingMs < 60_000
                ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
            }`}
          >
            남은 시간 {formatRemaining(remainingMs)}
          </span>
        </div>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          {instructorName} 강사 · {date} · {TIME_BLOCK_LABEL[timeBlock]} ({range.start}~{range.end})
        </p>
        <p className="mb-4 text-xs text-zinc-500 dark:text-zinc-400">
          이 시간 동안 다른 사용자는 같은 강사·시간대에 신청서를 작성할 수 없습니다. 10분 내에
          제출하지 않으면 자동으로 닫힙니다.
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                시작 시각
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                종료 시각
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              FC/LOS
            </label>
            <input
              type="text"
              value={fcLos}
              onChange={(e) => setFcLos(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              장소
            </label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              참석 인원
            </label>
            <input
              type="number"
              min={1}
              value={attendeeCount}
              onChange={(e) => setAttendeeCount(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              강의 요청 목적
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={3}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
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
              {submitting ? "신청 중..." : "신청하기"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
