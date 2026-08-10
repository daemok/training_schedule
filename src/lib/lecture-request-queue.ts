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
