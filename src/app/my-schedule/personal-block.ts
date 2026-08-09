import type { TimeBlock } from "./types";

export type PersonalBlockChoice = "ALL_DAY" | TimeBlock;

export const PERSONAL_BLOCK_LABEL: Record<PersonalBlockChoice, string> = {
  ALL_DAY: "종일",
  MORNING: "오전",
  AFTERNOON: "오후",
  EVENING: "저녁",
};
