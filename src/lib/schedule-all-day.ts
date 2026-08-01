import type { TimeBlock } from "@/lib/schedule-labels";

export const ALL_DAY_BLOCKS: TimeBlock[] = ["MORNING", "AFTERNOON", "EVENING"];

export interface ConflictInfo {
  title: string;
  startTime: string | null;
  endTime: string | null;
}

export type AllDaySubmitResult =
  | { ok: true; ids: number[] }
  | { ok: false; error: string; overlap?: boolean; conflicts?: ConflictInfo[] };

/**
 * "종일" 개인일정은 오전/오후/저녁 3개의 독립된 Schedule row로 저장된다(시간 블록이 각각의
 * 최소 단위이기 때문). 셋 중 하나라도 실패하면 이미 만들어진 row는 롤백(삭제)해
 * 전부-혹은-전무를 보장한다.
 */
export async function submitAllDayPersonalSchedule(params: {
  createUrl: string;
  deleteUrlFor: (id: number) => string;
  basePayload: Record<string, unknown>;
  force: boolean;
}): Promise<AllDaySubmitResult> {
  const createdIds: number[] = [];

  for (const timeBlock of ALL_DAY_BLOCKS) {
    const res = await fetch(params.createUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...params.basePayload, timeBlock, force: params.force }),
    });

    if (res.ok) {
      const data = await res.json();
      createdIds.push(data.id);
      continue;
    }

    for (const id of createdIds) {
      await fetch(params.deleteUrlFor(id), { method: "DELETE" }).catch(() => {});
    }
    const data = await res.json().catch(() => ({}));
    return {
      ok: false,
      error: data.error ?? "저장에 실패했습니다.",
      overlap: data.overlap,
      conflicts: data.conflicts,
    };
  }

  return { ok: true, ids: createdIds };
}
