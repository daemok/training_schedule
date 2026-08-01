import { NextRequest, NextResponse } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/current-user";
import type { SessionPayload, SessionRole } from "@/lib/auth/session";

type RoleCheckResult =
  | { ok: true; user: SessionPayload }
  | { ok: false; response: NextResponse };

/** 로그인 여부와 역할을 함께 검사하는 라우트 핸들러 공용 가드. */
export async function requireRole(
  request: NextRequest,
  roles: SessionRole[]
): Promise<RoleCheckResult> {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 }),
    };
  }
  if (!roles.includes(user.role)) {
    return {
      ok: false,
      response: NextResponse.json({ error: "권한이 없습니다." }, { status: 403 }),
    };
  }
  return { ok: true, user };
}
