"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { validatePassword } from "@/lib/password-policy";

export interface SignupState {
  error?: string;
  success?: boolean;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * 일반 사용자 회원가입. 이메일을 로그인 아이디로 그대로 사용하며(별도 아이디 필드 없음),
 * 계정은 항상 status: PENDING으로 생성되어 팀장/매니저가 승인해야 로그인할 수 있다.
 */
export async function signup(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();
  const name = String(formData.get("name") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const passwordConfirm = String(formData.get("passwordConfirm") ?? "");

  if (!email || !EMAIL_RE.test(email)) {
    return { error: "올바른 이메일을 입력해주세요." };
  }
  if (!name) {
    return { error: "이름을 입력해주세요." };
  }
  const passwordError = validatePassword(password);
  if (passwordError) {
    return { error: passwordError };
  }
  if (password !== passwordConfirm) {
    return { error: "비밀번호가 일치하지 않습니다." };
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return { error: "이미 가입된 이메일입니다." };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  await prisma.user.create({
    data: { email, name, passwordHash, role: "GENERAL", status: "PENDING" },
  });

  return { success: true };
}
