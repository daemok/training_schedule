import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/require-role";
import { toDateOnly, formatDateOnly } from "@/lib/date";
import {
  acquireRequestLock,
  releaseRequestLock,
  listActiveLocks,
  LOCK_CONFLICT_MESSAGE,
  LOCK_DURATION_MS,
} from "@/lib/request-lock";
import type { TimeBlock } from "@/lib/schedule-labels";

const TIME_BLOCKS: TimeBlock[] = ["MORNING", "AFTERNOON", "EVENING"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseSlotBody(body: unknown): { instructorId: number; date: string; timeBlock: TimeBlock } | null {
  if (typeof body !== "object" || body === null) return null;
  const b = body as Record<string, unknown>;
  const instructorId = Number(b.instructorId);
  const date = typeof b.date === "string" ? b.date : "";
  const timeBlock = typeof b.timeBlock === "string" ? (b.timeBlock as TimeBlock) : undefined;
  if (!Number.isInteger(instructorId) || !DATE_RE.test(date) || !timeBlock || !TIME_BLOCKS.includes(timeBlock)) {
    return null;
  }
  return { instructorId, date, timeBlock };
}

/**
 * GET /api/lecture-requests/locks?from=&to= — 기간 내 현재 유효한 신청서 작성 잠금 목록.
 * 강의 신청 화면(리스트형/캘린더형)에서 "다른 사용자가 입력 중" 상태를 미리 표시하는 데 쓰인다.
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["GENERAL", "TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json({ error: "from, to (yyyy-MM-dd) 쿼리 파라미터가 필요합니다." }, { status: 400 });
  }

  const locks = await listActiveLocks(toDateOnly(from), toDateOnly(to));
  return NextResponse.json(
    locks.map((l) => ({
      instructorId: l.instructorId,
      date: formatDateOnly(l.date),
      timeBlock: l.timeBlock,
      mine: l.lockedByUserId === auth.user.userId,
    }))
  );
}

/**
 * POST /api/lecture-requests/locks — 신청서 작성 시작(RequestFormModal이 열릴 때 호출).
 * 10분간 해당 강사/날짜/블록을 선점해 다른 사용자가 동시에 같은 슬롯을 신청하지 못하게 막는다.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["GENERAL", "TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const slot = parseSlotBody(body);
  if (!slot) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const acquired = await acquireRequestLock(
    slot.instructorId,
    toDateOnly(slot.date),
    slot.timeBlock,
    auth.user.userId
  );
  if (!acquired) {
    return NextResponse.json({ error: LOCK_CONFLICT_MESSAGE }, { status: 409 });
  }

  return NextResponse.json({ ok: true, expiresInMs: LOCK_DURATION_MS });
}

/** DELETE /api/lecture-requests/locks — 취소 버튼 또는 제출 완료 시 잠금을 해제한다. 본인 소유가 아니면 아무 일도 하지 않는다(idempotent). */
export async function DELETE(request: NextRequest) {
  const auth = await requireRole(request, ["GENERAL", "TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const body = await request.json().catch(() => null);
  const slot = parseSlotBody(body);
  if (!slot) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  await releaseRequestLock(slot.instructorId, toDateOnly(slot.date), slot.timeBlock, auth.user.userId);
  return NextResponse.json({ ok: true });
}
