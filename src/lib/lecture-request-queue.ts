import { prisma } from "@/lib/prisma";

/**
 * 같은 날짜+시간대(블록)에 신청된 강의들 사이에서, 주어진 신청 건들이 몇 번째로
 * 접수됐는지(1, 2, 3...) 계산한다. 강의 지역(장소)별 수용 한계 때문에 어떤 순서로 접수됐는지
 * 확인이 필요하다는 요구사항에 따른 것 — 지역 구분 없이 날짜+블록 전체 기준으로 순번을 매긴다.
 * 상태와 무관하게(거절된 신청도 포함) 접수 순서(createdAt) 그대로 순번을 매긴다.
 */
export async function attachQueuePositions<
  T extends { id: number; date: Date; timeBlock: string; createdAt: Date },
>(rows: T[]): Promise<(T & { queuePosition: number })[]> {
  if (rows.length === 0) return [];

  const uniqueSlots = new Map<string, { date: Date; timeBlock: string }>();
  for (const row of rows) {
    const key = `${row.date.toISOString()}|${row.timeBlock}`;
    uniqueSlots.set(key, { date: row.date, timeBlock: row.timeBlock });
  }

  const positionById = new Map<number, number>();
  await Promise.all(
    Array.from(uniqueSlots.values()).map(async ({ date, timeBlock }) => {
      const siblings = await prisma.lectureRequest.findMany({
        where: { date, timeBlock: timeBlock as never },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      siblings.forEach((s, index) => positionById.set(s.id, index + 1));
    })
  );

  return rows.map((row) => ({ ...row, queuePosition: positionById.get(row.id) ?? 1 }));
}

/**
 * 캘린더(전체 스케줄 캘린더, 내 스케줄)에 표시할 "그 날짜에 아직 처리되지 않은 강의 요청들
 * 사이의 우선순위"를 계산한다. attachQueuePositions와는 두 가지가 다르다 — (1) 같은
 * 시간대(블록)뿐 아니라 오전/오후/저녁 구분 없이 그 날짜 전체를 기준으로 순위를 매기고,
 * (2) 아직 확정/거절되지 않은 PENDING 요청만 순위 매김 대상에 포함한다(처리된 건까지 포함하면
 * 남아있는 PENDING 건들의 번호에 구멍이 생겨 "지금 뭐부터 봐야 하는지"를 오히려 헷갈리게
 * 만들기 때문). 예: 저녁·오전·오후 순으로 신청이 들어왔다면 저녁=1, 오전=2, 오후=3.
 * CONFIRMED/REJECTED인 요청에는 null을 돌려준다(더 이상 처리 대상이 아니므로 표시하지 않음).
 */
export async function attachDailyPriority<
  T extends { id: number; date: Date; status: string; createdAt: Date },
>(rows: T[]): Promise<(T & { dailyPriority: number | null })[]> {
  const pendingRows = rows.filter((r) => r.status === "PENDING");
  if (pendingRows.length === 0) {
    return rows.map((row) => ({ ...row, dailyPriority: null }));
  }

  const uniqueDates = new Map<string, Date>();
  for (const row of pendingRows) {
    uniqueDates.set(row.date.toISOString(), row.date);
  }

  const positionById = new Map<number, number>();
  await Promise.all(
    Array.from(uniqueDates.values()).map(async (date) => {
      const siblings = await prisma.lectureRequest.findMany({
        where: { date, status: "PENDING" },
        select: { id: true },
        orderBy: { createdAt: "asc" },
      });
      siblings.forEach((s, index) => positionById.set(s.id, index + 1));
    })
  );

  return rows.map((row) => ({
    ...row,
    dailyPriority: row.status === "PENDING" ? positionById.get(row.id) ?? 1 : null,
  }));
}
