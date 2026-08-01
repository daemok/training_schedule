"use client";

import { CalendarScheduleDTO } from "./types";
import { buildMonthGridDays } from "./date-utils";
import { formatDateOnly } from "@/lib/date";
import { EventPill } from "./EventPill";

const WEEKDAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];

interface Props {
  anchor: Date;
  today: string;
  schedules: CalendarScheduleDTO[];
  orderedInstructorIds: number[];
  showInstructor: boolean;
  onSelect: (schedule: CalendarScheduleDTO) => void;
  /** 지정되면 날짜 칸의 빈 영역 클릭 시 해당 날짜로 새 일정 등록을 시작할 수 있다(블록은 폼에서 선택). */
  onSelectEmpty?: (date: string) => void;
}

export function MonthGrid({
  anchor,
  today,
  schedules,
  orderedInstructorIds,
  showInstructor,
  onSelect,
  onSelectEmpty,
}: Props) {
  const days = buildMonthGridDays(anchor);
  const currentMonth = anchor.getUTCMonth();

  const byDate = new Map<string, CalendarScheduleDTO[]>();
  for (const s of schedules) {
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <div className="min-w-[640px]">
        <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {WEEKDAY_HEADERS.map((w) => (
            <div key={w} className="py-2">
              {w}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7">
          {days.map((d) => {
            const dateStr = formatDateOnly(d);
            const inMonth = d.getUTCMonth() === currentMonth;
            const isToday = dateStr === today;
            const dayEvents = byDate.get(dateStr) ?? [];

            return (
              <div
                key={dateStr}
                onClick={onSelectEmpty ? () => onSelectEmpty(dateStr) : undefined}
                className={`min-h-[104px] border-b border-r border-zinc-200 p-1.5 dark:border-zinc-800 ${
                  inMonth ? "" : "bg-zinc-50/60 dark:bg-zinc-950/40"
                } ${onSelectEmpty ? "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900" : ""}`}
              >
                <div
                  className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                    isToday
                      ? "bg-black font-semibold text-white dark:bg-zinc-50 dark:text-black"
                      : inMonth
                        ? "text-zinc-700 dark:text-zinc-300"
                        : "text-zinc-400 dark:text-zinc-600"
                  }`}
                >
                  {d.getUTCDate()}
                </div>
                <div className="flex flex-col gap-0.5">
                  {dayEvents.map((s) => (
                    <EventPill
                      key={s.id}
                      schedule={s}
                      orderedInstructorIds={orderedInstructorIds}
                      showInstructor={showInstructor}
                      onSelect={onSelect}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
