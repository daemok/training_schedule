import type { TimeBlock } from "@/lib/schedule-labels";

export type MyRequestStatus = "PENDING" | "CONFIRMED" | "REJECTED";

export interface MyRequestRow {
  id: number;
  date: string; // yyyy-MM-dd
  timeBlock: TimeBlock;
  startTime: string;
  endTime: string;
  status: MyRequestStatus;
  lectureTypeName: string;
  instructorName: string;
  location: string;
  attendeeCount: number;
  fcLos: string;
  content: string;
  rejectionReason: string | null;
  /** 같은 날짜+블록 요청들 사이의 접수 순번(1부터) — src/lib/lecture-request-queue.ts. */
  queuePosition: number;
}

export const STATUS_LABEL: Record<MyRequestStatus, string> = {
  PENDING: "미확정 (확정 대기)",
  CONFIRMED: "확정됨",
  REJECTED: "거절됨",
};

export const STATUS_BADGE_CLASS: Record<MyRequestStatus, string> = {
  PENDING: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
  CONFIRMED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  REJECTED: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400",
};
