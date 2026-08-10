import { prisma } from "@/lib/prisma";
import type { TimeBlock } from "@/lib/schedule-labels";

/** 신청서 작성 잠금 지속 시간 — 이 시간 내에 제출/취소하지 않으면 다른 사용자가 이어받을 수 있다. */
export const LOCK_DURATION_MS = 10 * 60 * 1000;

const CLEANUP_RETENTION_HOURS = 24;
const CLEANUP_PROBABILITY = 0.05;

export const LOCK_CONFLICT_MESSAGE =
  "다른 사용자가 이 시간에 신청서를 작성 중입니다. 잠시 후 다시 시도해주세요.";

function isUniqueConstraintError(err: unknown): boolean {
  return (
    typeof err === "object" &&
    err !== null &&
    "code" in err &&
    (err as { code?: string }).code === "P2002"
  );
}

/**
 * 특정 강사/날짜/블록에 대한 신청서 작성 잠금을 시도한다.
 * - 잠긴 slot이 없으면 새로 만든다.
 * - 이미 있지만 만료됐거나(expiresAt <= now) 본인 소유면 그대로 이어받는다(reclaim).
 * - 다른 사용자가 아직 유효하게 점유 중이면 실패한다.
 * unique 제약(instructorId, date, timeBlock) 덕분에 동시에 두 create가 들어와도 하나만
 * 성공하고, 나머지는 조건부 updateMany(그 시점에 조건을 다시 확인하는 단일 UPDATE문)로
 * 안전하게 재확인된다.
 */
export async function acquireRequestLock(
  instructorId: number,
  date: Date,
  timeBlock: TimeBlock,
  userId: number
): Promise<boolean> {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + LOCK_DURATION_MS);

  try {
    await prisma.requestLock.create({
      data: { instructorId, date, timeBlock, lockedByUserId: userId, expiresAt },
    });
  } catch (err) {
    if (!isUniqueConstraintError(err)) throw err;
    const result = await prisma.requestLock.updateMany({
      where: {
        instructorId,
        date,
        timeBlock,
        OR: [{ expiresAt: { lte: now } }, { lockedByUserId: userId }],
      },
      data: { lockedByUserId: userId, expiresAt },
    });
    if (result.count === 0) return false;
  }

  if (Math.random() < CLEANUP_PROBABILITY) {
    const cutoff = new Date(Date.now() - CLEANUP_RETENTION_HOURS * 60 * 60 * 1000);
    await prisma.requestLock.deleteMany({ where: { expiresAt: { lt: cutoff } } }).catch(() => {});
  }

  return true;
}

/** 본인이 보유한 잠금만 해제한다(취소 버튼, 제출 완료 시). 이미 없거나 남의 것이면 아무 일도 하지 않는다. */
export async function releaseRequestLock(
  instructorId: number,
  date: Date,
  timeBlock: TimeBlock,
  userId: number
): Promise<void> {
  await prisma.requestLock.deleteMany({
    where: { instructorId, date, timeBlock, lockedByUserId: userId },
  });
}

/** 주어진 기간 내에서 현재 유효한(만료되지 않은) 잠금 목록을 반환한다 — 신청 화면의 가용성 표시용. */
export async function listActiveLocks(from: Date, to: Date) {
  const now = new Date();
  return prisma.requestLock.findMany({
    where: { date: { gte: from, lt: to }, expiresAt: { gt: now } },
    select: { instructorId: true, date: true, timeBlock: true, lockedByUserId: true },
  });
}
