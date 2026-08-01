import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/signups/[id]/approve — 일반 사용자 가입 승인 (팀장/매니저 전용) */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target || target.role !== "GENERAL") {
    return NextResponse.json({ error: "대상을 찾을 수 없습니다." }, { status: 404 });
  }
  if (target.status !== "PENDING") {
    return NextResponse.json({ error: "이미 처리된 가입입니다." }, { status: 409 });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: { status: "APPROVED" },
  });

  return NextResponse.json({ id: updated.id, status: updated.status });
}
