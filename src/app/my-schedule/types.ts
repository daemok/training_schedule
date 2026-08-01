export type { TimeBlock, ScheduleType } from "@/lib/schedule-labels";
export { TIME_BLOCK_LABEL, SCHEDULE_TYPE_LABEL } from "@/lib/schedule-labels";
import type { TimeBlock, ScheduleType } from "@/lib/schedule-labels";

export type ScheduleStatus = "CONFIRMED" | "PROVISIONAL";

export interface ScheduleDTO {
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
}
