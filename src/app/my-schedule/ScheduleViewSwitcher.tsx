"use client";

import { useState } from "react";
import { ScheduleDTO } from "./types";
import { ScheduleManager } from "./ScheduleManager";
import { ScheduleCalendarView } from "./ScheduleCalendarView";

type ViewMode = "list" | "calendar";

interface Props {
  instructorId: number;
  year: number;
  month: number;
  prevHref: string;
  nextHref: string;
  schedules: ScheduleDTO[];
}

/** 강사 본인 스케줄을 리스트형(월별 목록) 또는 캘린더형(월/주/일)으로 전환해서 볼 수 있다. */
export function ScheduleViewSwitcher({
  instructorId,
  year,
  month,
  prevHref,
  nextHref,
  schedules,
}: Props) {
  const [view, setView] = useState<ViewMode>("list");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex overflow-hidden self-start rounded-full border border-zinc-300 dark:border-zinc-700">
        <button
          onClick={() => setView("list")}
          className={`px-3 py-1.5 text-sm ${
            view === "list"
              ? "bg-black text-white dark:bg-zinc-50 dark:text-black"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          리스트형
        </button>
        <button
          onClick={() => setView("calendar")}
          className={`px-3 py-1.5 text-sm ${
            view === "calendar"
              ? "bg-black text-white dark:bg-zinc-50 dark:text-black"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          캘린더형
        </button>
      </div>

      {view === "list" ? (
        <ScheduleManager
          year={year}
          month={month}
          prevHref={prevHref}
          nextHref={nextHref}
          schedules={schedules}
        />
      ) : (
        <ScheduleCalendarView instructorId={instructorId} />
      )}
    </div>
  );
}
