"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ScheduleDTO, TIME_BLOCK_LABEL, SCHEDULE_TYPE_LABEL } from "./types";
import { ScheduleFormModal, ScheduleFormPayload, SubmitResult } from "./ScheduleFormModal";
import { BulkPersonalScheduleModal, BulkSchedulePayload } from "./BulkPersonalScheduleModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { Toast } from "@/components/Toast";
import { submitAllDayPersonalSchedule } from "@/lib/schedule-all-day";
import { submitBulkPersonalSchedule, type BulkSubmitResult } from "@/lib/schedule-bulk";

const TOAST_DURATION_MS = 3000;

interface Props {
  year: number;
  month: number;
  prevHref: string;
  nextHref: string;
  schedules: ScheduleDTO[];
}

function groupByDate(schedules: ScheduleDTO[]) {
  const map = new Map<string, ScheduleDTO[]>();
  for (const s of schedules) {
    const list = map.get(s.date) ?? [];
    list.push(s);
    map.set(s.date, list);
  }
  return Array.from(map.entries()).sort(([a], [b]) => (a < b ? -1 : 1));
}

function formatDateLabel(dateStr: string) {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  const weekday = ["일", "월", "화", "수", "목", "금", "토"][d.getUTCDay()];
  return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${weekday})`;
}

export function ScheduleManager({ year, month, prevHref, nextHref, schedules }: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleDTO | null>(null);
  const [bulkFormOpen, setBulkFormOpen] = useState(false);
  const [deleting, setDeleting] = useState<ScheduleDTO | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  function openCreate() {
    setEditing(null);
    setFormOpen(true);
  }

  function openEdit(schedule: ScheduleDTO) {
    setEditing(schedule);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditing(null);
  }

  async function handleBulkSubmit(
    payload: BulkSchedulePayload,
    force: boolean
  ): Promise<BulkSubmitResult> {
    const result = await submitBulkPersonalSchedule({
      dates: payload.dates,
      personalBlock: payload.personalBlock,
      title: payload.title,
      force,
    });
    if (result.ok) {
      router.refresh();
    }
    return result;
  }

  function openBulk() {
    setBulkFormOpen(true);
  }
  function closeBulk() {
    setBulkFormOpen(false);
  }

  async function handleFormSubmit(
    payload: ScheduleFormPayload,
    force: boolean
  ): Promise<SubmitResult> {
    if (editing) {
      const res = await fetch(`/api/my/schedules/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheduleType: payload.scheduleType,
          date: payload.date,
          timeBlock: payload.timeBlocks[0],
          startTime: payload.startTime,
          endTime: payload.endTime,
          title: payload.title,
          location: payload.location,
          force,
        }),
      });
      if (res.ok) {
        closeForm();
        router.refresh();
        setToast("일정이 수정되었습니다.");
        return { ok: true };
      }
      const data = await res.json().catch(() => ({}));
      return {
        ok: false,
        error: data.error ?? "저장에 실패했습니다.",
        overlap: data.overlap,
        conflicts: data.conflicts,
      };
    }

    if (payload.timeBlocks.length > 1) {
      const result = await submitAllDayPersonalSchedule({
        createUrl: "/api/my/schedules",
        deleteUrlFor: (id) => `/api/my/schedules/${id}`,
        basePayload: {
          scheduleType: payload.scheduleType,
          date: payload.date,
          title: payload.title,
          location: payload.location,
        },
        force,
      });
      if (result.ok) {
        closeForm();
        router.refresh();
        setToast("일정이 등록되었습니다.");
        return { ok: true };
      }
      return result;
    }

    const res = await fetch("/api/my/schedules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        scheduleType: payload.scheduleType,
        date: payload.date,
        timeBlock: payload.timeBlocks[0],
        startTime: payload.startTime,
        endTime: payload.endTime,
        title: payload.title,
        location: payload.location,
        force,
      }),
    });
    if (res.ok) {
      closeForm();
      router.refresh();
      setToast("일정이 등록되었습니다.");
      return { ok: true };
    }
    const data = await res.json().catch(() => ({}));
    return {
      ok: false,
      error: data.error ?? "저장에 실패했습니다.",
      overlap: data.overlap,
      conflicts: data.conflicts,
    };
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    setDeleteSubmitting(true);
    setDeleteError(null);

    const res = await fetch(`/api/my/schedules/${deleting.id}`, { method: "DELETE" });
    setDeleteSubmitting(false);

    if (res.ok) {
      setDeleting(null);
      router.refresh();
      setToast("일정이 삭제되었습니다.");
      return;
    }

    const data = await res.json().catch(() => ({}));
    setDeleteError(data.error ?? "삭제에 실패했습니다.");
  }

  const grouped = groupByDate(schedules);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href={prevHref}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
          >
            ← 이전 달
          </Link>
          <span className="text-lg font-medium text-black dark:text-zinc-50">
            {year}년 {month}월
          </span>
          <Link
            href={nextHref}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
          >
            다음 달 →
          </Link>
        </div>
        <div className="flex gap-2">
          <button
            onClick={openBulk}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
          >
            + 개인일정 일괄 등록
          </button>
          <button
            onClick={openCreate}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
          >
            + 새 일정 등록
          </button>
        </div>
      </div>

      {grouped.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          이번 달 등록된 스케줄이 없습니다.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {grouped.map(([date, items]) => (
            <div
              key={date}
              className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
            >
              <div className="border-b border-zinc-200 bg-zinc-50 px-4 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
                {formatDateLabel(date)}
              </div>
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {items.map((s) => (
                  <li
                    key={s.id}
                    className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="rounded bg-zinc-100 px-2 py-0.5 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                          {TIME_BLOCK_LABEL[s.timeBlock]}
                        </span>
                        <span className="text-zinc-500">
                          {s.startTime && s.endTime ? `${s.startTime} ~ ${s.endTime}` : "종일"}
                        </span>
                        <span
                          className={`rounded px-2 py-0.5 ${
                            s.scheduleType === "LECTURE"
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
                          }`}
                        >
                          {SCHEDULE_TYPE_LABEL[s.scheduleType]}
                        </span>
                        {s.status === "PROVISIONAL" && (
                          <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                            미확정
                          </span>
                        )}
                      </div>
                      <div className="font-medium text-black dark:text-zinc-50">
                        {s.title}
                      </div>
                      {s.location && (
                        <div className="text-sm text-zinc-500">{s.location}</div>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-4 text-sm">
                      <button
                        onClick={() => openEdit(s)}
                        className="text-zinc-600 hover:underline dark:text-zinc-300"
                      >
                        수정
                      </button>
                      <button
                        onClick={() => {
                          setDeleteError(null);
                          setDeleting(s);
                        }}
                        className="text-red-600 hover:underline"
                      >
                        삭제
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {formOpen && (
        <ScheduleFormModal
          initial={editing}
          onCancel={closeForm}
          onSubmit={handleFormSubmit}
        />
      )}

      {bulkFormOpen && (
        <BulkPersonalScheduleModal onCancel={closeBulk} onSubmit={handleBulkSubmit} />
      )}

      {deleting && (
        <ConfirmDeleteModal
          schedule={deleting}
          submitting={deleteSubmitting}
          error={deleteError}
          onCancel={() => setDeleting(null)}
          onConfirm={handleDeleteConfirm}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
