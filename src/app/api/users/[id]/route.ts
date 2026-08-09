import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";

type RouteParams = { params: Promise<{ id: string }> };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** PATCH /api/users/[id] — 계정 이메일/이름 수정 (매니저 전용, 사용자 관리 화면). */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(request, ["MANAGER"]);
  if (!auth.ok) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const data: { email?: string; name?: string | null } = {};

  if (typeof body?.email === "string") {
    const email = body.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "올바른 이메일을 입력해주세요." }, { status: 400 });
    }
    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing && existing.id !== id) {
      return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
    }
    data.email = email;
  }
  if (typeof body?.name === "string") {
    data.name = body.name.trim() || null;
  }

  const updated = await prisma.user.update({ where: { id }, data }).catch(() => null);
  if (!updated) {
    return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json({
    id: updated.id,
    email: updated.email,
    name: updated.name,
    role: updated.role,
    status: updated.status,
  });
}

/**
 * DELETE /api/users/[id] — 계정 삭제 (매니저 전용, 사용자 관리 화면).
 * 본인 계정은 삭제할 수 없다(실수로 자신을 잠그는 것을 방지). 강의 신청(신청자 또는
 * 확정 처리자)이 하나라도 있으면 외래키 제약 때문에 거부한다 — 이력을 보존하기 위해
 * 삭제 대신 비밀번호 재설정으로 로그인만 막는 것을 안내한다.
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(request, ["MANAGER"]);
  if (!auth.ok) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  if (id === auth.user.userId) {
    return NextResponse.json({ error: "본인 계정은 삭제할 수 없습니다." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return NextResponse.json({ error: "계정을 찾을 수 없습니다." }, { status: 404 });
  }

  const [madeCount, confirmedCount] = await Promise.all([
    prisma.lectureRequest.count({ where: { requesterId: id } }),
    prisma.lectureRequest.count({ where: { confirmedById: id } }),
  ]);
  if (madeCount > 0 || confirmedCount > 0) {
    return NextResponse.json(
      {
        error:
          "이 계정은 강의 신청 이력이 있어 삭제할 수 없습니다. 로그인만 막으려면 비밀번호 재설정을 이용해주세요.",
      },
      { status: 409 }
    );
  }

  await prisma.user.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
