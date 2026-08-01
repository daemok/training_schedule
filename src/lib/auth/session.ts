import { SignJWT, jwtVerify } from "jose";
import { SESSION_MAX_AGE_SECONDS } from "./constants";

/**
 * 세션은 상태를 서버에 저장하지 않는 서명된 JWT 쿠키다(edge/node 런타임 어디서나
 * DB 조회 없이 검증 가능해야 하므로 — 라우트 가드(proxy.ts)는 Edge 런타임에서 실행되고
 * pg(Prisma 어댑터가 쓰는 Postgres 드라이버)는 Edge에서 사용할 수 없다).
 * 로그아웃은 쿠키 삭제로만 처리되며, 만료 전 강제 무효화는 지원하지 않는다(짧은 만료시간으로 완화).
 */

export type SessionRole = "INSTRUCTOR" | "TEAM_LEAD" | "MANAGER" | "GENERAL";

export interface SessionPayload {
  userId: number;
  email: string;
  role: SessionRole;
  instructorId: number | null;
}

const VALID_ROLES: SessionRole[] = ["INSTRUCTOR", "TEAM_LEAD", "MANAGER", "GENERAL"];

function getSecretKey(): Uint8Array {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET 환경 변수가 설정되어 있지 않습니다.");
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey());
    if (
      typeof payload.userId !== "number" ||
      typeof payload.email !== "string" ||
      typeof payload.role !== "string" ||
      !VALID_ROLES.includes(payload.role as SessionRole)
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      email: payload.email,
      role: payload.role as SessionRole,
      instructorId:
        typeof payload.instructorId === "number" ? payload.instructorId : null,
    };
  } catch {
    return null;
  }
}
