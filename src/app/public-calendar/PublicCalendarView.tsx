"use client";

import { useEffect, useRef, useState } from "react";
import { toDateOnly, formatDateOnly } from "@/lib/date";
import {
  CalendarScheduleDTO,
  InstructorOption,
  ViewMode,
  VIEW_MODE_LABEL,
} from "@/app/calendar/types";
import {
  buildMonthGridDays,
  buildWeekDays,
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
import { useKoreanHolidays } from "@/lib/korean-holidays";
import { LoadingOverlay } from "@/components/LoadingOverlay";

interface Props {
  instructors: InstructorOption[];
  initialView: ViewMode;
  initialDate: string;
  initialInstructorFilter: string; // "ALL" | "<id>"
  initialSchedules: CalendarScheduleDTO[];
}

const VIEW_MODES: ViewMode[] = ["month", "week", "day"];

/**
 * 공용 캘린더 화면 — src/app/calendar/CalendarView.tsx와 동일한 그리드 컴포넌트
 * (MonthGrid/WeekView/DayView/DetailPanel)를 그대로 재사용하되, 등록/수정/삭제/확정/거절/
 * 엑셀 다운로드/알림벨 같은 관리 기능은 전혀 없는 순수 조회 전용 화면이다. DetailPanel에
 * canManage/canDecideLectureRequest를 넘기지 않으므로 읽기 전용으로 동작한다.
 */
export function PublicCalendarView({
  instructors,
  initialView,
  initialDate,
  initialInstructorFilter,
  initialSchedules,
}: Props) {
  const [view, setView] = useState<ViewMode>(initialView);
  const [anchorDateStr, setAnchorDateStr] = useState(initialDate);
  const [instructorFilter, setInstructorFilter] = useState(initialInstructorFilter);
  const [schedules, setSchedules] = useState<CalendarScheduleDTO[]>(initialSchedules);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<CalendarScheduleDTO | null>(null);

  const isFirstRun = useRef(true);
  const anchor = toDateOnly(anchorDateStr);
  const today = formatDateOnly(new Date());
  const orderedInstructorIds = instructors.map((i) => i.id);

  const gridDates =
    view === "month" ? buildMonthGridDays(anchor) : view === "week" ? buildWeekDays(anchor) : [anchor];
  const holidayYears = Array.from(new Set(gridDates.map((d) => d.getUTCFullYear())));
  const holidays = useKoreanHolidays(holidayYears);

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
        const res = await fetch(`/api/public-calendar?${params.toString()}`, {
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
  }, [view, anchorDateStr, instructorFilter]);

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
          <span className="ml-2 text-xl font-semibold text-black dark:text-zinc-50">
            {title}
          </span>
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
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <div className="relative">
      {loading && <LoadingOverlay />}
      {view === "month" && (
        <MonthGrid
          anchor={anchor}
          today={today}
          schedules={schedules}
          orderedInstructorIds={orderedInstructorIds}
          showInstructor={showInstructorBadge}
          holidays={holidays}
          onSelect={setSelected}
        />
      )}
      {view === "week" && (
        <WeekView
          anchor={anchor}
          today={today}
          schedules={schedules}
          orderedInstructorIds={orderedInstructorIds}
          showInstructor={showInstructorBadge}
          holidays={holidays}
          onSelect={setSelected}
        />
      )}
      {view === "day" && (
        <DayView
          date={anchorDateStr}
          schedules={schedules}
          orderedInstructorIds={orderedInstructorIds}
          showInstructor={showInstructorBadge}
          holidays={holidays}
          onSelect={setSelected}
        />
      )}
      </div>

      {selected && <DetailPanel schedule={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
