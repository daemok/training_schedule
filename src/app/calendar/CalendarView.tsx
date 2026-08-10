"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { ViewerRole } from "@/lib/access-control";
import { toDateOnly, formatDateOnly } from "@/lib/date";
import {
  CalendarScheduleDTO,
  InstructorOption,
  TimeBlock,
  ViewMode,
  VIEW_MODE_LABEL,
} from "./types";
import {
  formatDayTitle,
  formatMonthTitle,
  formatWeekTitle,
  getViewRange,
  shiftAnchor,
} from "./date-utils";
import { MonthGrid } from "./MonthGrid";
import { WeekView } from "./WeekView";
import { DayView } from "./DayView";
import { DetailPanel } from "./DetailPanel";
import { NotificationBell } from "./NotificationBell";
import { ScheduleAdminFormModal, AdminScheduleFormPayload, SubmitResult } from "./ScheduleAdminFormModal";
import { ConfirmDeleteModal } from "./ConfirmDeleteModal";
import { Toast } from "@/components/Toast";
import { submitAllDayPersonalSchedule } from "@/lib/schedule-all-day";

const TOAST_DURATION_MS = 3000;

interface Props {
  instructors: InstructorOption[];
  initialView: ViewMode;
  initialDate: string;
  initialInstructorFilter: string; // "ALL" | "<id>"
  /** 로그인 세션에서 확정된 뷰어 정보 — 사용자가 UI에서 바꿀 수 없다(역할 사칭 방지). */
  viewerRole: ViewerRole;
  viewerInstructorId: number | null;
  initialSchedules: CalendarScheduleDTO[];
}

const VIEW_MODES: ViewMode[] = ["month", "week", "day"];

export function CalendarView({
  instructors,
  initialView,
  initialDate,
  initialInstructorFilter,
  viewerRole,
  viewerInstructorId,
  initialSchedules,
}: Props) {
  const [view, setView] = useState<ViewMode>(initialView);
  const [anchorDateStr, setAnchorDateStr] = useState(initialDate);
  const [instructorFilter, setInstructorFilter] = useState(initialInstructorFilter);
  const [schedules, setSchedules] = useState<CalendarScheduleDTO[]>(initialSchedules);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarScheduleDTO | null>(null);
  const [exporting, setExporting] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  const canManage = viewerRole === "TEAM_LEAD" || viewerRole === "MANAGER";
  const [formOpen, setFormOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState<CalendarScheduleDTO | null>(null);
  const [createPreset, setCreatePreset] = useState<{
    instructorId?: number;
    date?: string;
    timeBlock?: TimeBlock;
  } | null>(null);
  const [deleting, setDeleting] = useState<CalendarScheduleDTO | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isFirstRun = useRef(true);
  const anchor = toDateOnly(anchorDateStr);
  const today = formatDateOnly(new Date());
  const orderedInstructorIds = instructors.map((i) => i.id);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (isFirstRun.current) {
      isFirstRun.current = false;
      return;
    }

    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setError(null);
      const { start, end } = getViewRange(view, anchor);
      const params = new URLSearchParams({
        from: formatDateOnly(start),
        to: formatDateOnly(end),
        instructor: instructorFilter,
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
  }, [view, anchorDateStr, instructorFilter, refreshKey]);

  const title =
    view === "month"
      ? formatMonthTitle(anchor)
      : view === "week"
        ? formatWeekTitle(anchor)
        : formatDayTitle(anchor);

  const showInstructorBadge = instructorFilter === "ALL";

  function goPrev() {
    setAnchorDateStr(formatDateOnly(shiftAnchor(view, anchor, -1)));
  }
  function goNext() {
    setAnchorDateStr(formatDateOnly(shiftAnchor(view, anchor, 1)));
  }
  function goToday() {
    setAnchorDateStr(today);
  }

  async function handleExport() {
    setExporting(true);
    setError(null);
    try {
      const { start, end } = getViewRange(view, anchor);
      const params = new URLSearchParams({
        from: formatDateOnly(start),
        to: formatDateOnly(end),
        instructor: instructorFilter,
      });
      const res = await fetch(`/api/schedules/export?${params.toString()}`);
      if (!res.ok) throw new Error("다운로드에 실패했습니다.");

      const blob = await res.blob();
      const disposition = res.headers.get("Content-Disposition") ?? "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : "schedules.xlsx";

      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("엑셀 다운로드에 실패했습니다.");
    } finally {
      setExporting(false);
    }
  }

  const roleLabel =
    viewerRole === "INSTRUCTOR"
      ? instructors.find((i) => i.id === viewerInstructorId)?.name
        ? `강사 · ${instructors.find((i) => i.id === viewerInstructorId)?.name}`
        : "강사"
      : viewerRole === "TEAM_LEAD"
        ? "팀장"
        : "매니저";

  function openCreate() {
    setEditingSchedule(null);
    setCreatePreset(null);
    setFormOpen(true);
  }

  const emptyClickEnabled = canManage && instructorFilter !== "ALL";

  function openCreateAt(date: string, timeBlock?: TimeBlock) {
    if (!emptyClickEnabled) return;
    setEditingSchedule(null);
    setCreatePreset({ instructorId: Number(instructorFilter), date, timeBlock });
    setFormOpen(true);
  }

  function openEdit(schedule: CalendarScheduleDTO) {
    setSelected(null);
    setEditingSchedule(schedule);
    setFormOpen(true);
  }

  function closeForm() {
    setFormOpen(false);
    setEditingSchedule(null);
    setCreatePreset(null);
  }

  async function handleFormSubmit(
    payload: AdminScheduleFormPayload,
    force: boolean
  ): Promise<SubmitResult> {
    if (editingSchedule) {
      const res = await fetch(`/api/my/schedules/${editingSchedule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          instructorId: payload.instructorId,
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
          instructorId: payload.instructorId,
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
        instructorId: payload.instructorId,
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

  const canDecideLectureRequest =
    !!selected &&
    selected.status === "PROVISIONAL" &&
    selected.scheduleType === "LECTURE" &&
    !!selected.lectureRequest &&
    (canManage || (viewerRole === "INSTRUCTOR" && viewerInstructorId === selected.instructorId));

  async function handleLectureRequestDecision(
    schedule: CalendarScheduleDTO,
    decision: "confirm" | "reject"
  ) {
    if (!schedule.lectureRequest) return;
    setDecisionSubmitting(true);
    const res = await fetch(`/api/lecture-requests/${schedule.lectureRequest.id}/${decision}`, {
      method: "POST",
    });
    setDecisionSubmitting(false);
    if (res.ok) {
      setSelected(null);
      setRefreshKey((k) => k + 1);
      setToast(decision === "confirm" ? "강의 신청을 확정했습니다." : "강의 신청을 거절했습니다.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setToast(data.error ?? "처리에 실패했습니다.");
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
          <span className="ml-2 text-lg font-medium text-black dark:text-zinc-50">
            {title}
          </span>
          {loading && (
            <span className="text-xs text-zinc-400">불러오는 중...</span>
          )}
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

          <select
            value={instructorFilter}
            onChange={(e) => setInstructorFilter(e.target.value)}
            className="rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <option value="ALL">전체 강사</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
                {i.status === "INACTIVE" ? " (비활성)" : ""}
              </option>
            ))}
          </select>

          <button
            onClick={handleExport}
            disabled={exporting}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black disabled:opacity-50 dark:border-zinc-700 dark:hover:border-zinc-50"
          >
            {exporting ? "다운로드 중..." : "엑셀 다운로드"}
          </button>

          {canManage && (
            <button
              onClick={openCreate}
              className="rounded-full bg-black px-3 py-1.5 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
            >
              + 새 일정 등록
            </button>
          )}

          {canManage && (
            <>
              <Link
                href="/lecture-requests"
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
              >
                강의 신청 관리
              </Link>
              <Link
                href="/apply"
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
              >
                강의 신청하기
              </Link>
              <Link
                href="/admin"
                className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
              >
                관리자 페이지
              </Link>
            </>
          )}

          {viewerRole === "TEAM_LEAD" && <NotificationBell />}

          <span className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1.5 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300">
            {roleLabel}
          </span>
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {emptyClickEnabled && (
        <p className="text-xs text-zinc-500 dark:text-zinc-400">
          빈 칸을 클릭하면 해당 강사의 새 일정을 바로 등록할 수 있습니다.
        </p>
      )}

      {view === "month" && (
        <MonthGrid
          anchor={anchor}
          today={today}
          schedules={schedules}
          orderedInstructorIds={orderedInstructorIds}
          showInstructor={showInstructorBadge}
          onSelect={setSelected}
          onSelectEmpty={emptyClickEnabled ? (date) => openCreateAt(date) : undefined}
        />
      )}
      {view === "week" && (
        <WeekView
          anchor={anchor}
          today={today}
          schedules={schedules}
          orderedInstructorIds={orderedInstructorIds}
          showInstructor={showInstructorBadge}
          onSelect={setSelected}
          onSelectEmpty={emptyClickEnabled ? openCreateAt : undefined}
        />
      )}
      {view === "day" && (
        <DayView
          date={anchorDateStr}
          schedules={schedules}
          orderedInstructorIds={orderedInstructorIds}
          showInstructor={showInstructorBadge}
          onSelect={setSelected}
          onSelectEmpty={emptyClickEnabled ? openCreateAt : undefined}
        />
      )}

      {selected && (
        <DetailPanel
          schedule={selected}
          onClose={() => setSelected(null)}
          canManage={canManage}
          onEdit={openEdit}
          onDelete={(schedule) => {
            setDeleteError(null);
            setDeleting(schedule);
          }}
          canDecideLectureRequest={canDecideLectureRequest}
          decisionSubmitting={decisionSubmitting}
          onConfirmLectureRequest={(schedule) => handleLectureRequestDecision(schedule, "confirm")}
          onRejectLectureRequest={(schedule) => handleLectureRequestDecision(schedule, "reject")}
        />
      )}

      {formOpen && (
        <ScheduleAdminFormModal
          instructors={instructors}
          initial={editingSchedule}
          presetInstructorId={createPreset?.instructorId}
          presetDate={createPreset?.date}
          presetTimeBlock={createPreset?.timeBlock}
          onCancel={closeForm}
          onSubmit={handleFormSubmit}
        />
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
