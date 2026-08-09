"use server";

import bcrypt from "bcryptjs";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/constants";
import { createSessionToken } from "@/lib/auth/session";
import {
  checkLoginThrottle,
  recordLoginAttempt,
  LOGIN_THROTTLE_MESSAGE,
} from "@/lib/login-throttle";

export interface LoginState {
  error?: string;
}

/**
 * 클라이언트 IP를 읽는다. Vercel 등 프록시 뒤에서는 x-forwarded-for(맨 앞 값이 실제
 * 클라이언트)를 우선 쓴다. 테스트 환경처럼 요청 컨텍스트 밖에서 호출되면 headers()가
 * 예외를 던지므로 "unknown"으로 대체한다(IP 단위 제한만 느슨해질 뿐 계정 단위 제한은
 * 그대로 동작한다).
 */
async function getClientIp(): Promise<string> {
  try {
    const h = await headers();
    const forwarded = h.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0].trim();
    return h.get("x-real-ip") ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function login(
  _prevState: LoginState,
  formData: FormData
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return { error: "이메일과 비밀번호를 모두 입력해주세요." };
  }

  const ip = await getClientIp();
  const throttle = await checkLoginThrottle(ip, email);
  if (throttle.blocked) {
    return { error: LOGIN_THROTTLE_MESSAGE };
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    await recordLoginAttempt(ip, email, false);
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }
  if (user.status === "PENDING") {
    return { error: "가입 승인 대기 중입니다. 팀장/매니저의 승인 후 로그인할 수 있습니다." };
  }
  if (user.status === "REJECTED") {
    return { error: "가입이 거절된 계정입니다. 관리자에게 문의해주세요." };
  }

  await recordLoginAttempt(ip, email, true);

  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    instructorId: user.instructorId,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  redirect(
    user.role === "INSTRUCTOR" ? "/my-schedule" : user.role === "GENERAL" ? "/apply" : "/calendar"
  );
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
