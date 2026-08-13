"use client";

import { CalendarScheduleDTO, TimeBlock, TIME_BLOCK_LABEL } from "./types";
import { buildWeekDays, weekdayLabel } from "./date-utils";
import { formatDateOnly } from "@/lib/date";
import { EventPill } from "./EventPill";
import { isGrayCalendarDate, type HolidayMap } from "@/lib/korean-holidays";

const TIME_BLOCKS: TimeBlock[] = ["MORNING", "AFTERNOON", "EVENING"];

interface Props {
  anchor: Date;
  today: string;
  schedules: CalendarScheduleDTO[];
  orderedInstructorIds: number[];
  showInstructor: boolean;
  holidays?: HolidayMap;
  onSelect: (schedule: CalendarScheduleDTO) => void;
  /** 지정되면 빈 셀 클릭 시 (date, timeBlock)으로 새 일정 등록을 시작할 수 있다. */
  onSelectEmpty?: (date: string, timeBlock: TimeBlock) => void;
}

export function WeekView({
  anchor,
  today,
  schedules,
  orderedInstructorIds,
  showInstructor,
  holidays = {},
  onSelect,
  onSelectEmpty,
}: Props) {
  const days = buildWeekDays(anchor);

  const byDateAndBlock = new Map<string, CalendarScheduleDTO[]>();
  for (const s of schedules) {
    const key = `${s.date}__${s.timeBlock}`;
    const list = byDateAndBlock.get(key) ?? [];
    list.push(s);
    byDateAndBlock.set(key, list);
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
      <table className="w-full min-w-[720px] table-fixed border-collapse text-sm">
        <thead>
          <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
            <th className="w-16 border-r border-zinc-200 p-2 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
              시간대
            </th>
            {days.map((d) => {
              const dateStr = formatDateOnly(d);
              const isToday = dateStr === today;
              const isGrayDay = isGrayCalendarDate(dateStr, holidays);
              return (
                <th
                  key={dateStr}
                  className={`border-r border-zinc-200 p-2 text-xs font-medium dark:border-zinc-800 ${
                    isGrayDay ? "bg-zinc-200 dark:bg-zinc-800" : ""
                  } ${isToday ? "text-black dark:text-zinc-50" : "text-zinc-500 dark:text-zinc-400"}`}
                >
                  {d.getUTCMonth() + 1}/{d.getUTCDate()} ({weekdayLabel(d)})
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {TIME_BLOCKS.map((block) => (
            <tr key={block} className="border-b border-zinc-200 align-top dark:border-zinc-800">
              <td className="border-r border-zinc-200 p-2 text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                {TIME_BLOCK_LABEL[block]}
              </td>
              {days.map((d) => {
                const dateStr = formatDateOnly(d);
                const events = byDateAndBlock.get(`${dateStr}__${block}`) ?? [];
                const isGrayDay = isGrayCalendarDate(dateStr, holidays);
                return (
                  <td
                    key={dateStr}
                    onClick={
                      events.length === 0 && onSelectEmpty
                        ? () => onSelectEmpty(dateStr, block)
                        : undefined
                    }
                    className={`min-h-[72px] border-r border-zinc-200 p-1 align-top dark:border-zinc-800 ${
                      isGrayDay ? "bg-zinc-200 dark:bg-zinc-800" : ""
                    } ${
                      events.length === 0 && onSelectEmpty
                        ? isGrayDay
                          ? "cursor-pointer hover:bg-zinc-300 dark:hover:bg-zinc-700"
                          : "cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-900"
                        : ""
                    }`}
                  >
                    <div className="flex flex-col gap-0.5">
                      {events.map((s) => (
                        <EventPill
                          key={s.id}
                          schedule={s}
                          orderedInstructorIds={orderedInstructorIds}
                          showInstructor={showInstructor}
                          isGrayDay={isGrayDay}
                          onSelect={onSelect}
                        />
                      ))}
                    </div>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
