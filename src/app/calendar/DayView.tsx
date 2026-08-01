"use client";

import {
  CalendarScheduleDTO,
  TimeBlock,
  TIME_BLOCK_LABEL,
  TIME_BLOCK_BADGE_CLASS,
  SCHEDULE_TYPE_LABEL,
} from "./types";
import { instructorColorVars } from "./colors";

const TIME_BLOCKS: TimeBlock[] = ["MORNING", "AFTERNOON", "EVENING"];

interface Props {
  date: string; // yyyy-MM-dd, 빈 블록 클릭 시 onSelectEmpty로 전달된다
  schedules: CalendarScheduleDTO[];
  orderedInstructorIds: number[];
  showInstructor: boolean;
  onSelect: (schedule: CalendarScheduleDTO) => void;
  /** 지정되면 빈 블록도 렌더링되며 클릭 시 (date, timeBlock)으로 새 일정 등록을 시작할 수 있다. */
  onSelectEmpty?: (date: string, timeBlock: TimeBlock) => void;
}

export function DayView({
  date,
  schedules,
  orderedInstructorIds,
  showInstructor,
  onSelect,
  onSelectEmpty,
}: Props) {
  const byBlock = new Map<TimeBlock, CalendarScheduleDTO[]>();
  for (const s of schedules) {
    const list = byBlock.get(s.timeBlock) ?? [];
    list.push(s);
    byBlock.set(s.timeBlock, list);
  }

  const hasAny = schedules.length > 0;

  return (
    <div className="flex flex-col gap-4">
      {!hasAny && !onSelectEmpty && (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          이 날짜에 등록된 스케줄이 없습니다.
        </p>
      )}

      {TIME_BLOCKS.map((block) => {
        const events = byBlock.get(block) ?? [];
        if (events.length === 0 && !onSelectEmpty) return null;
        return (
          <div
            key={block}
            className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800"
          >
            <div
              className={`border-b border-zinc-200 px-4 py-2 text-sm font-medium dark:border-zinc-800 ${TIME_BLOCK_BADGE_CLASS[block]}`}
            >
              {TIME_BLOCK_LABEL[block]}
            </div>
            {events.length === 0 ? (
              <button
                onClick={() => onSelectEmpty?.(date, block)}
                className="w-full px-4 py-3 text-left text-sm text-zinc-400 hover:bg-zinc-50 dark:text-zinc-600 dark:hover:bg-zinc-800"
              >
                빈 일정 — 클릭하여 등록
              </button>
            ) : (
              <ul className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {events.map((s) => (
                  <li key={s.id}>
                    <button
                      onClick={() => onSelect(s)}
                      className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800"
                    >
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
                          <span>
                            {s.startTime && s.endTime ? `${s.startTime} ~ ${s.endTime}` : "종일"}
                          </span>
                          <span className="rounded bg-zinc-100 px-1.5 py-0.5 dark:bg-zinc-800">
                            {SCHEDULE_TYPE_LABEL[s.scheduleType]}
                          </span>
                          {s.status === "PROVISIONAL" && (
                            <span className="rounded bg-rose-100 px-1.5 py-0.5 text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                              가신청
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {showInstructor && (
                            <span
                              className="instructor-dot h-2.5 w-2.5 shrink-0 rounded-full"
                              style={instructorColorVars(s.instructorId, orderedInstructorIds)}
                            />
                          )}
                          <span className="font-medium text-black dark:text-zinc-50">
                            {showInstructor ? `${s.instructorName} · ${s.title}` : s.title}
                          </span>
                        </div>
                        {s.location && (
                          <div className="text-sm text-zinc-500 dark:text-zinc-400">
                            {s.location}
                          </div>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })}
    </div>
  );
}
