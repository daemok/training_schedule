import { prisma } from "@/lib/prisma";

const EMAIL_WINDOW_MINUTES = 15;
const EMAIL_MAX_FAILURES = 5;
const IP_WINDOW_MINUTES = 15;
const IP_MAX_FAILURES = 20;
const CLEANUP_RETENTION_HOURS = 24;
const CLEANUP_PROBABILITY = 0.05;

export const LOGIN_THROTTLE_MESSAGE =
  "너무 많은 로그인 시도가 있었습니다. 잠시 후 다시 시도해주세요.";

export interface ThrottleCheck {
  blocked: boolean;
}

/**
 * 무차별 대입(brute-force) 로그인 공격 방어. 두 단계로 검사한다:
 * - 계정 단위: 같은 이메일로 최근 EMAIL_WINDOW_MINUTES분 동안 EMAIL_MAX_FAILURES회
 *   이상 실패했으면 그 계정으로의 로그인을 일시적으로 막는다(비밀번호가 맞아도 막는다 —
 *   시도 자체를 봉쇄).
 * - IP 단위: 같은 IP에서 최근 IP_WINDOW_MINUTES분 동안 여러 이메일에 걸쳐
 *   IP_MAX_FAILURES회 이상 실패했으면(자격증명 스터핑 등) 해당 IP의 로그인 시도를 막는다.
 *
 * 계정 존재 여부에 따라 동작이 달라지지 않는다(가입되지 않은 이메일이어도 동일한 방식으로
 * 집계되므로, 이 검사만으로 계정 존재 여부가 노출되지 않는다).
 * 실패만 집계하고 성공은 집계하지 않는다 — 정상적으로 자주 로그인하는 사용자가 잠기지
 * 않도록 하기 위함이다.
 */
export async function checkLoginThrottle(ip: string, email: string): Promise<ThrottleCheck> {
  const now = Date.now();
  const emailSince = new Date(now - EMAIL_WINDOW_MINUTES * 60_000);
  const ipSince = new Date(now - IP_WINDOW_MINUTES * 60_000);

  const [emailFailures, ipFailures] = await Promise.all([
    prisma.loginAttempt.count({
      where: { email, succeeded: false, createdAt: { gte: emailSince } },
    }),
    prisma.loginAttempt.count({
      where: { ipAddress: ip, succeeded: false, createdAt: { gte: ipSince } },
    }),
  ]);

  return { blocked: emailFailures >= EMAIL_MAX_FAILURES || ipFailures >= IP_MAX_FAILURES };
}

/**
 * 로그인 시도 결과를 감사 로그에 남긴다(위 checkLoginThrottle이 이 로그를 근거로 판단한다).
 * 매번은 아니고 가끔(CLEANUP_PROBABILITY 확률로) 오래된 기록을 정리해 테이블이
 * 무한정 커지지 않게 한다 — 별도 스케줄러 없이 요청 경로에서 자연스럽게 청소한다.
 */
export async function recordLoginAttempt(
  ip: string,
  email: string,
  succeeded: boolean
): Promise<void> {
  await prisma.loginAttempt.create({ data: { ipAddress: ip, email, succeeded } });

  if (Math.random() < CLEANUP_PROBABILITY) {
    const cutoff = new Date(Date.now() - CLEANUP_RETENTION_HOURS * 60 * 60_000);
    await prisma.loginAttempt.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {});
  }
}
