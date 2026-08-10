import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";

type RouteParams = { params: Promise<{ id: string }> };

/** PATCH /api/lecture-brands/[id] — 브랜드 이름 수정, 활성/비활성 전환 (팀장/매니저 전용) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const data: { name?: string; isActive?: boolean } = {};
  if (typeof body?.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body?.isActive === "boolean") {
    data.isActive = body.isActive;
  }

  const updated = await prisma.lectureBrand.update({ where: { id }, data }).catch(() => null);
  if (!updated) {
    return NextResponse.json({ error: "브랜드를 찾을 수 없습니다." }, { status: 404 });
  }
  return NextResponse.json(updated);
}
