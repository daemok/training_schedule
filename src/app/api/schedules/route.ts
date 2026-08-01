import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/current-user";
import { toDateOnly } from "@/lib/date";
import { fetchMaskedSchedules } from "@/lib/schedule-query";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * GET /api/schedules?from=2026-07-01&to=2026-08-01&instructor=ALL
 * GET /api/schedules?from=2026-07-01&to=2026-08-01&instructor=3
 *
 * 캘린더(월/주/일 뷰) 조회 API. 강사·팀장·매니저 모두 호출할 수 있는 조회 전용
 * 엔드포인트이며, 쓰기 작업은 없다(등록/수정/삭제는 /api/my/schedules 에서만 가능).
 *
 * 뷰어의 역할/본인 강사 id는 절대 쿼리 파라미터로 받지 않고 로그인 세션에서만 가져온다.
 * 그래야 팀장/매니저 계정, 혹은 다른 강사 계정으로 로그인한 사용자가 쿼리 파라미터
 * 조작만으로 타인의 개인일정 사유를 열람하는 권한 상승을 막을 수 있다.
 * from/to는 선택된 기간만, instructor는 조회 대상(어떤 강사를 볼지) 필터일 뿐이다.
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

  const rows = await fetchMaskedSchedules({
    from: toDateOnly(from),
    to: toDateOnly(to),
    instructorId,
    viewer: { role: user.role, instructorId: user.instructorId ?? undefined },
  });

  return NextResponse.json(rows);
}
