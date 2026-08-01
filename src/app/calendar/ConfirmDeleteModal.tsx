"use client";

import { CalendarScheduleDTO, TIME_BLOCK_LABEL, SCHEDULE_TYPE_LABEL } from "./types";

interface Props {
  schedule: CalendarScheduleDTO;
  submitting: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmDeleteModal({
  schedule,
  submitting,
  error,
  onCancel,
  onConfirm,
}: Props) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">
          일정을 삭제할까요?
        </h2>
        <p className="mb-1 text-sm text-zinc-600 dark:text-zinc-400">
          {schedule.instructorName} · {schedule.date} · {TIME_BLOCK_LABEL[schedule.timeBlock]} ·{" "}
          {schedule.startTime && schedule.endTime
            ? `${schedule.startTime}~${schedule.endTime}`
            : "종일"}
        </p>
        <p className="mb-4 text-sm font-medium text-black dark:text-zinc-50">
          [{SCHEDULE_TYPE_LABEL[schedule.scheduleType]}] {schedule.title}
        </p>
        <p className="mb-4 text-xs text-zinc-500">
          삭제된 일정은 복구할 수 없으며, 삭제 이력은 별도 로그로 보관됩니다.
        </p>

        {error && (
          <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            취소
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={onConfirm}
            className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {submitting ? "삭제 중..." : "삭제"}
          </button>
        </div>
      </div>
    </div>
  );
}
