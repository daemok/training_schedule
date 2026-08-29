import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { toDateTimeKst } from "@/lib/date";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * PATCH /api/lecture-types/[id] — 강의 프로그램 활성/비활성 전환, 이름/설명/신청 기간 수정
 * (팀장/매니저 전용). 신청 기간은 시스템 시각 기준으로 강의 신청 가능 여부를 결정하므로
 * 변경이 필요할 때 언제든 다시 수정할 수 있다.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const data: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
    applicationStartDate?: Date | null;
    applicationEndDate?: Date | null;
  } = {};

  if (typeof body?.name === "string" && body.name.trim()) {
    data.name = body.name.trim();
  }
  if (typeof body?.description === "string") {
    data.description = body.description.trim() || null;
  }
  if (typeof body?.isActive === "boolean") {
    data.isActive = body.isActive;
  }
  const DATETIME_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
  if (body?.applicationStartDate !== undefined) {
    const raw = body.applicationStartDate;
    if (raw === null || raw === "") {
      data.applicationStartDate = null;
    } else if (typeof raw === "string" && DATETIME_RE.test(raw)) {
      data.applicationStartDate = toDateTimeKst(raw);
    } else {
      return NextResponse.json(
        { error: "신청 시작 일시 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }
  }
  if (body?.applicationEndDate !== undefined) {
    const raw = body.applicationEndDate;
    if (raw === null || raw === "") {
      data.applicationEndDate = null;
    } else if (typeof raw === "string" && DATETIME_RE.test(raw)) {
      data.applicationEndDate = toDateTimeKst(raw);
    } else {
      return NextResponse.json(
        { error: "신청 종료 일시 형식이 올바르지 않습니다." },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.lectureType.update({ where: { id }, data }).catch(() => null);
  if (!updated) {
    return NextResponse.json({ error: "강의 유형을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(updated);
}
