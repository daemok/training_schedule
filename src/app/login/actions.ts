"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { SESSION_COOKIE_NAME, SESSION_MAX_AGE_SECONDS } from "@/lib/auth/constants";
import { createSessionToken } from "@/lib/auth/session";

export interface LoginState {
  error?: string;
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

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "이메일 또는 비밀번호가 올바르지 않습니다." };
  }
  if (user.status === "PENDING") {
    return { error: "가입 승인 대기 중입니다. 팀장/매니저의 승인 후 로그인할 수 있습니다." };
  }
  if (user.status === "REJECTED") {
    return { error: "가입이 거절된 계정입니다. 관리자에게 문의해주세요." };
  }

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
