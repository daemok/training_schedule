export type { TimeBlock, ScheduleType } from "@/lib/schedule-labels";
export { TIME_BLOCK_LABEL, SCHEDULE_TYPE_LABEL } from "@/lib/schedule-labels";
import type { TimeBlock, ScheduleType } from "@/lib/schedule-labels";

export type ViewMode = "month" | "week" | "day";

export interface InstructorOption {
  id: number;
  name: string;
  team: string;
  status: "ACTIVE" | "INACTIVE";
}

export type ScheduleStatus = "CONFIRMED" | "PROVISIONAL";

export interface CalendarScheduleDTO {
  id: number;
  date: string; // yyyy-MM-dd
  timeBlock: TimeBlock;
  startTime: string | null; // HH:mm, null이면 블록 전체 점유(개인일정)
  endTime: string | null; // HH:mm
  scheduleType: ScheduleType;
  status: ScheduleStatus;
  title: string;
  location: string | null;
  memo: string | null;
  instructorId: number;
  instructorName: string;
}

/** 시간대는 항상 텍스트 라벨과 함께 노출되므로 색상만으로 구분에 의존하지 않는다. */
export const TIME_BLOCK_BADGE_CLASS: Record<TimeBlock, string> = {
  MORNING: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
  AFTERNOON: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  EVENING: "bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300",
};

export const VIEW_MODE_LABEL: Record<ViewMode, string> = {
  month: "월간",
  week: "주간",
  day: "일간",
};
