import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { toDateOnly } from "@/lib/date";

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
  const data: {
    name?: string;
    description?: string | null;
    isActive?: boolean;
    brandId?: number;
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
  if (body?.brandId !== undefined) {
    const brandId = Number(body.brandId);
    if (!Number.isInteger(brandId)) {
      return NextResponse.json({ error: "잘못된 브랜드입니다." }, { status: 400 });
    }
    const brand = await prisma.lectureBrand.findUnique({ where: { id: brandId } });
    if (!brand) {
      return NextResponse.json({ error: "브랜드를 찾을 수 없습니다." }, { status: 404 });
    }
    data.brandId = brandId;
  }
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (body?.applicationStartDate !== undefined) {
    const raw = body.applicationStartDate;
    if (raw === null || raw === "") {
      data.applicationStartDate = null;
    } else if (typeof raw === "string" && DATE_RE.test(raw)) {
      data.applicationStartDate = toDateOnly(raw);
    } else {
      return NextResponse.json({ error: "신청 시작일 형식이 올바르지 않습니다." }, { status: 400 });
    }
  }
  if (body?.applicationEndDate !== undefined) {
    const raw = body.applicationEndDate;
    if (raw === null || raw === "") {
      data.applicationEndDate = null;
    } else if (typeof raw === "string" && DATE_RE.test(raw)) {
      data.applicationEndDate = toDateOnly(raw);
    } else {
      return NextResponse.json({ error: "신청 종료일 형식이 올바르지 않습니다." }, { status: 400 });
    }
  }

  const updated = await prisma.lectureType
    .update({ where: { id }, data, include: { brand: { select: { id: true, name: true } } } })
    .catch(() => null);
  if (!updated) {
    return NextResponse.json({ error: "강의 유형을 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(updated);
}
