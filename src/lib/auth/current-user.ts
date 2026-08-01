import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "./constants";
import { verifySessionToken, SessionPayload } from "./session";

/** 서버 컴포넌트에서 로그인한 사용자의 세션을 읽는다 (암묵적 요청 컨텍스트에 의존). */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/**
 * Route Handler에서 로그인한 사용자의 세션을 읽는다. `NextRequest.cookies`를 직접 읽으므로
 * (next/headers의 암묵적 요청 컨텍스트에 의존하지 않음) 유닛 테스트에서 직접 생성한
 * NextRequest로도 동일하게 동작한다.
 */
export async function getSessionFromRequest(
  request: NextRequest
): Promise<SessionPayload | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}
