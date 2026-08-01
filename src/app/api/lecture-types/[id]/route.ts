import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";

type RouteParams = { params: Promise<{ id: string }> };

/** PATCH /api/lecture-types/[id] — 강의 유형 활성/비활성 전환, 이름/설명 수정 (팀장/매니저 전용) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const data: { name?: string; description?: string | null; isActive?: boolean } = {};

  if (typeof body?.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body?.description === "string") {
    data.description = body.description.trim() || null;
  }
  if (typeof body?.isActive === "boolean") {
    data.isActive = body.isActive;
  }

  const updated = await prisma.lectureType
    .update({ where: { id }, data })
    .catch(() => null);
  if (!updated) {
    return NextResponse.json({ error: "강의 유형을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(updated);
}
