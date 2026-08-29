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

export type BulkEditResult =
  | { ok: true; updatedCount: number }
  | { ok: false; error: string; overlap?: boolean; conflicts?: BulkConflictInfo[] };

export type BulkDeleteResult = { ok: true; deletedCount: number } | { ok: false; error: string };

/** 선택한 여러 개인일정에 동일한 새 사유/장소/시간대를 한 번에 적용한다(강사 본인 전용). */
export async function submitBulkPersonalEdit(params: {
  ids: number[];
  title?: string;
  location?: string;
  personalBlock?: TimeBlock;
  force: boolean;
}): Promise<BulkEditResult> {
  const res = await fetch("/api/my/schedules/bulk", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(params),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    return { ok: true, updatedCount: data.updatedCount };
  }
  return {
    ok: false,
    error: data.error ?? "수정에 실패했습니다.",
    overlap: data.overlap,
    conflicts: data.conflicts,
  };
}

/** 선택한 여러 개인일정을 한 번에 삭제한다(강사 본인 전용). */
export async function submitBulkPersonalDelete(ids: number[]): Promise<BulkDeleteResult> {
  const res = await fetch("/api/my/schedules/bulk", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.ok) {
    return { ok: true, deletedCount: data.deletedCount };
  }
  return { ok: false, error: data.error ?? "삭제에 실패했습니다." };
}
