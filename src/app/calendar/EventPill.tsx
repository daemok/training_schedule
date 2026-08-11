"use client";

import { CalendarScheduleDTO, TIME_BLOCK_BADGE_CLASS, TIME_BLOCK_LABEL } from "./types";
import { instructorColorVars } from "./colors";

interface Props {
  schedule: CalendarScheduleDTO;
  orderedInstructorIds: number[];
  showInstructor: boolean;
  onSelect: (schedule: CalendarScheduleDTO) => void;
}

export function EventPill({ schedule, orderedInstructorIds, showInstructor, onSelect }: Props) {
  const timeLabel =
    schedule.startTime && schedule.endTime ? `${schedule.startTime}~${schedule.endTime}` : "종일";

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onSelect(schedule);
      }}
      title={`${schedule.instructorName} · ${schedule.title} (${timeLabel})`}
      className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800"
    >
      {schedule.lectureRequest?.dailyPriority != null && (
        <span
          className="shrink-0 rounded-full bg-zinc-900 px-1 py-px text-[10px] font-semibold text-white dark:bg-zinc-50 dark:text-black"
          title="그 날짜의 미확정 요청 중 접수 순서"
        >
          {schedule.lectureRequest.dailyPriority}
        </span>
      )}
      <span
        className={`shrink-0 rounded px-1 py-px text-[10px] font-medium ${TIME_BLOCK_BADGE_CLASS[schedule.timeBlock]}`}
      >
        {TIME_BLOCK_LABEL[schedule.timeBlock]}
      </span>
      {schedule.status === "PROVISIONAL" && (
        <span className="shrink-0 rounded bg-rose-100 px-1 py-px text-[10px] font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
          미확정
        </span>
      )}
      {showInstructor && (
        <span
          className="instructor-dot h-2 w-2 shrink-0 rounded-full"
          style={instructorColorVars(schedule.instructorId, orderedInstructorIds)}
        />
      )}
      <span className="truncate text-zinc-700 dark:text-zinc-200">
        {showInstructor ? `${schedule.instructorName} · ${schedule.title}` : schedule.title}
      </span>
    </button>
  );
}
