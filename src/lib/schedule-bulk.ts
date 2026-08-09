import type { TimeBlock } from "@/lib/schedule-labels";

/** 개인일정 일괄 등록 시 한 번에 선택할 수 있는 최대 날짜 수. */
export const MAX_BULK_PERSONAL_DATES = 30;

export interface BulkConflictInfo {
  date: string;
  timeBlock: TimeBlock;
  title: string;
}

export type BulkSubmitResult =
  | { ok: true; createdCount: number }
  | { ok: false; error: string; overlap?: boolean; conflicts?: BulkConflictInfo[] };

/**
 * POST /api/my/schedules/bulk — 여러 날짜에 동일한 시간대/사유의 개인일정을 한 번에 등록한다.
 * "종일"은 서버에서 날짜별로 오전/오후/저녁 3개 row로 분해된다.
 */
export async function submitBulkPersonalSchedule(params: {
  dates: string[];
  personalBlock: "ALL_DAY" | TimeBlock;
  title: string;
  force: boolean;
}): Promise<BulkSubmitResult> {
  const res = await fetch("/api/my/schedules/bulk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    return { ok: true, createdCount: data.createdCount };
  }
  return {
    ok: false,
    error: data.error ?? "저장에 실패했습니다.",
    overlap: data.overlap,
    conflicts: data.conflicts,
  };
}
