export interface LectureType {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
}

export interface InstructorOption {
  id: number;
  name: string;
  brand: string;
  status: "ACTIVE" | "INACTIVE";
}

export type ApplyTimeBlock = "MORNING" | "AFTERNOON" | "EVENING";

export interface ScheduleRow {
  timeBlock: ApplyTimeBlock;
  instructorId: number;
  status: "CONFIRMED" | "PROVISIONAL";
}

export const APPLY_BLOCKS: ApplyTimeBlock[] = ["MORNING", "AFTERNOON", "EVENING"];
export const APPLY_BLOCK_LABEL: Record<ApplyTimeBlock, string> = {
  MORNING: "오전",
  AFTERNOON: "오후",
  EVENING: "저녁",
};
