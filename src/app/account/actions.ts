"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/current-user";
import { validatePassword } from "@/lib/password-policy";

export interface ChangePasswordState {
  error?: string;
  success?: boolean;
}

/** 로그인한 본인 계정의 비밀번호를 변경한다. 현재 비밀번호 확인이 필요하다. */
export async function changePassword(
  _prevState: ChangePasswordState,
  formData: FormData
): Promise<ChangePasswordState> {
  const session = await getCurrentUser();
  if (!session) {
    return { error: "로그인이 필요합니다." };
  }

  const currentPassword = String(formData.get("currentPassword") ?? "");
  const newPassword = String(formData.get("newPassword") ?? "");
  const newPasswordConfirm = String(formData.get("newPasswordConfirm") ?? "");

  if (!currentPassword || !newPassword || !newPasswordConfirm) {
    return { error: "모든 항목을 입력해주세요." };
  }
  const passwordError = validatePassword(newPassword);
  if (passwordError) {
    return { error: passwordError };
  }
  if (newPassword !== newPasswordConfirm) {
    return { error: "새 비밀번호가 일치하지 않습니다." };
  }

  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) {
    return { error: "계정을 찾을 수 없습니다." };
  }

  const matches = await bcrypt.compare(currentPassword, user.passwordHash);
  if (!matches) {
    return { error: "현재 비밀번호가 올바르지 않습니다." };
  }
  if (currentPassword === newPassword) {
    return { error: "새 비밀번호는 현재 비밀번호와 달라야 합니다." };
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  await prisma.user.update({ where: { id: session.userId }, data: { passwordHash } });

  return { success: true };
}
