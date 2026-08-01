import { prisma } from "@/lib/prisma";
import type { TimeBlock } from "@/lib/schedule-labels";

/**
 * 같은 강사, 같은 날짜, 같은 시간대(블록)에서 겹치는 기존 스케줄을 찾는다.
 * "HH:mm" 문자열은 0-padding 되어 있어 SQL 비교 연산자로도 시각 순서 비교가 가능하다.
 *
 * startTime/endTime이 null이면 "블록 전체를 점유하는" 개인일정(오전/오후/저녁/종일)이다 —
 * 이 경우 같은 블록의 기존 스케줄은 시각과 무관하게 전부 충돌로 간주하고, 반대로 새로
 * 등록하려는 스케줄에 시각이 있어도 같은 블록에 이미 시각 없는(블록 전체 점유) 스케줄이
 * 있으면 충돌로 간주한다.
 */
export function findOverlaps(
  instructorId: number,
  date: Date,
  timeBlock: TimeBlock,
  startTime: string | null,
  endTime: string | null,
  excludeId?: number
) {
  return prisma.schedule.findMany({
    where: {
      instructorId,
      date,
      timeBlock,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      ...(startTime && endTime
        ? { OR: [{ startTime: null }, { startTime: { lt: endTime }, endTime: { gt: startTime } }] }
        : {}),
    },
    orderBy: { startTime: "asc" },
  });
}
