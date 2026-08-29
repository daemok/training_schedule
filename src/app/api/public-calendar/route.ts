import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/current-user";
import { toDateOnly } from "@/lib/date";
import { fetchPublicLectureSchedules } from "@/lib/schedule-query";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/public-calendar?from=2026-09-01&to=2026-10-01&instructor=ALL
 *
 * 공용 캘린더 조회 API — 로그인한 모든 역할(GENERAL 포함)이 호출할 수 있는 조회 전용
 * 엔드포인트다. `/api/schedules`와 달리 역할별 마스킹이 필요 없다 — 확정된 강의만
 * DB 레벨에서 걸러 내려주므로(개인일정/미확정 건은 애초에 포함되지 않음) 누가 봐도
 * 안전하다.
 */
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);

  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json(
      { error: "from, to (yyyy-MM-dd) 쿼리 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const instructorParam = searchParams.get("instructor") ?? "ALL";
  const instructorId =
    instructorParam !== "ALL" && Number.isInteger(Number(instructorParam))
      ? Number(instructorParam)
      : undefined;

  const rows = await fetchPublicLectureSchedules({
    from: toDateOnly(from),
    to: toDateOnly(to),
    instructorId,
  });

  return NextResponse.json(rows);
}
