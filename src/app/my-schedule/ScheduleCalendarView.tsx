"use client";

import { useEffect, useState } from "react";
import { toDateOnly, formatDateOnly } from "@/lib/date";
import { submitAllDayPersonalSchedule } from "@/lib/schedule-all-day";
import type { CalendarScheduleDTO, TimeBlock, ViewMode } from "@/app/calendar/types";
import { VIEW_MODE_LABEL } from "@/app/calendar/types";
import {
  formatDayTitle,
  formatMonthTitle,
  formatWeekTitle,
  getViewRange,
  shiftAnchor,
} from "@/app/calendar/date-utils";
import { MonthGrid } from "@/app/calendar/MonthGrid";
import { WeekView } from "@/app/calendar/WeekView";
import { DayView } from "@/app/calendar/DayView";
import { DetailPanel } from "@/app/calendar/DetailPanel";
import { ScheduleFormModal, ScheduleFormPayload, SubmitResult } from "./ScheduleFormModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { Toast } from "@/components/Toast";
import type { ScheduleDTO } from "./types";

const TOAST_DURATION_MS = 3000;
const VIEW_MODES: ViewMode[] = ["month", "week", "day"];

interface Props {
  instructorId: number;
}

function toScheduleDTO(s: CalendarScheduleDTO): ScheduleDTO {
  return {
    id: s.id,
    date: s.date,
    timeBlock: s.timeBlock,
    startTime: s.startTime,
    endTime: s.endTime,
    scheduleType: s.scheduleType,
    status: s.status,
    title: s.title,
    location: s.location,
    memo: s.memo,
  };
}

/** 강사 본인 스케줄의 캘린더형 화면. /calendar의 월/주/일 뷰 컴포넌트를 그대로 재사용한다. */
export function ScheduleCalendarView({ instructorId }: Props) {
  const [view, setView] = useState<ViewMode>("month");
  const [anchorDateStr, setAnchorDateStr] = useState(formatDateOnly(new Date()));
  const [schedules, setSchedules] = useState<CalendarScheduleDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarScheduleDTO | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ScheduleDTO | null>(null);
  const [createPreset, setCreatePreset] = useState<{ date?: string; timeBlock?: TimeBlock } | null>(
    null
  );
  const [deleting, setDeleting] = useState<CalendarScheduleDTO | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const anchor = toDateOnly(anchorDateStr);
  const today = formatDateOnly(new Date());

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      const { start, end } = getViewRange(view, anchor);
      const params = new URLSearchParams({
        from: formatDateOnly(start),
        to: formatDateOnly(end),
        instructor: String(instructorId),
      });
      try {
        const res = await fetch(`/api/schedules?${params.toString()}`, {
          signal: controller.signal,
        });
        if (!res.ok) throw new Error("스케줄을 불러오지 못했습니다.");
        const data = (await res.json()) as CalendarScheduleDTO[];
        setSchedules(data);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError("스케줄을 불러오지 못했습니다.");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, anchorDateStr, instructorId, refreshKey]);

  const title =
    view === "month"
      ? formatMonthTitle(anchor)
      : view === "week"
        ? formatWeekTitle(anchor)
        : formatDayTitle(anchor);

  function goPrev() {
    setAnchorDateStr(formatDateOnly(shiftAnchor(view, anchor, -1)));
  }
  function goNext() {
    setAnchorDateStr(formatDateOnly(shiftAnchor(view, anchor, 1)));
  }
  function goToday() {
    setAnchorDateStr(today);
  }

  function openCreate() {
    setEditing(null);
    setCreatePreset(null);
    setFormOpen(true);
  }
  function openCreateAt(date: string, timeBlock?: TimeBlock) {
    setEditing(null);
    setCreatePreset({ date, timeBlock });
    setFormOpen(true);
  }
  function openEdit(schedule: CalendarScheduleDTO) {
    setSelected(null);
    setEditing(toScheduleDTO(schedule));
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditing(null);
    setCreatePreset(null);
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
        setRefreshKey((k) => k + 1);
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
        setRefreshKey((k) => k + 1);
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
      setRefreshKey((k) => k + 1);
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
      setSelected(null);
      setRefreshKey((k) => k + 1);
      setToast("일정이 삭제되었습니다.");
      return;
    }

    const data = await res.json().catch(() => ({}));
    setDeleteError(data.error ?? "삭제에 실패했습니다.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={goPrev}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
          >
            ← 이전
          </button>
          <button
            onClick={goToday}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
          >
            오늘
          </button>
          <button
            onClick={goNext}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
          >
            다음 →
          </button>
          <span className="ml-2 text-lg font-medium text-black dark:text-zinc-50">{title}</span>
          {loading && <span className="text-xs text-zinc-400">불러오는 중...</span>}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex overflow-hidden rounded-full border border-zinc-300 dark:border-zinc-700">
            {VIEW_MODES.map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 text-sm ${
                  view === v
                    ? "bg-black text-white dark:bg-zinc-50 dark:text-black"
                    : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
                }`}
              >
                {VIEW_MODE_LABEL[v]}
              </button>
            ))}
          </div>
          <button
            onClick={openCreate}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
          >
            + 새 일정 등록
          </button>
        </div>
      </div>

      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        빈 칸을 클릭하면 바로 새 일정을 등록할 수 있습니다.
      </p>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {view === "month" && (
        <MonthGrid
          anchor={anchor}
          today={today}
          schedules={schedules}
          orderedInstructorIds={[instructorId]}
          showInstructor={false}
          onSelect={setSelected}
          onSelectEmpty={(date) => openCreateAt(date)}
        />
      )}
      {view === "week" && (
        <WeekView
          anchor={anchor}
          today={today}
          schedules={schedules}
          orderedInstructorIds={[instructorId]}
          showInstructor={false}
          onSelect={setSelected}
          onSelectEmpty={openCreateAt}
        />
      )}
      {view === "day" && (
        <DayView
          date={anchorDateStr}
          schedules={schedules}
          orderedInstructorIds={[instructorId]}
          showInstructor={false}
          onSelect={setSelected}
          onSelectEmpty={openCreateAt}
        />
      )}

      {selected && (
        <DetailPanel
          schedule={selected}
          onClose={() => setSelected(null)}
          canManage
          onEdit={openEdit}
          onDelete={(schedule) => {
            setDeleteError(null);
            setDeleting(schedule);
          }}
        />
      )}

      {formOpen && (
        <ScheduleFormModal
          initial={editing}
          presetDate={createPreset?.date}
          presetTimeBlock={createPreset?.timeBlock}
          onCancel={closeForm}
          onSubmit={handleFormSubmit}
        />
      )}

      {deleting && (
        <ConfirmDeleteModal
          schedule={toScheduleDTO(deleting)}
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
