import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { generateTemporaryPassword } from "@/lib/temporary-password";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/users/[id]/reset-password — 임시 비밀번호로 강제 재설정 (매니저 전용).
 * 새 비밀번호는 이 응답에서만 한 번 노출된다(해시만 저장하므로 이후에는 다시 볼 수 없음) —
 * 계정 소유자에게 전달하면 본인이 로그인 후 /account에서 원하는 비밀번호로 바꿀 수 있다.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(request, ["MANAGER"]);
  if (!auth.ok) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const updated = await prisma.user
    .update({ where: { id }, data: { passwordHash }, select: { id: true, email: true } })
    .catch(() => null);
  if (!updated) {
    return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({ email: updated.email, temporaryPassword });
}
