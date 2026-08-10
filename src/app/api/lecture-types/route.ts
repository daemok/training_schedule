import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { getSessionFromRequest } from "@/lib/auth/current-user";
import { toDateOnly, formatDateOnly } from "@/lib/date";

/**
 * GET /api/lecture-types — 강의(유형) 목록.
 * 로그인한 모든 역할이 조회할 수 있다. 일반 사용자(GENERAL)에게는 활성 + 신청 가능
 * 기간 내인 강의만 내려준다(팀장/매니저는 강사 관리 화면 등에서 전체를 봐야 하므로
 * 기간과 무관하게 전체 반환 — src/app/api/lecture-requests/route.ts와 동일한 예외 규칙).
 */
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const lectureTypes = await prisma.lectureType.findMany({
    include: { brand: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  if (user.role !== "GENERAL") {
    return NextResponse.json(lectureTypes);
  }

  const today = toDateOnly(formatDateOnly(new Date()));
  const open = lectureTypes.filter(
    (t) =>
      t.isActive &&
      (!t.applicationStartDate || t.applicationStartDate <= today) &&
      (!t.applicationEndDate || t.applicationEndDate >= today)
  );
  return NextResponse.json(open);
}

/** POST /api/lecture-types — 강의 개설 (팀장/매니저 전용, 강사 관리 화면). 브랜드 선택 필수. */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "강의 이름을 입력해주세요." }, { status: 400 });
  }
  const brandId = Number(body?.brandId);
  if (!Number.isInteger(brandId)) {
    return NextResponse.json({ error: "강의 브랜드를 선택해주세요." }, { status: 400 });
  }
  const brand = await prisma.lectureBrand.findUnique({ where: { id: brandId } });
  if (!brand) {
    return NextResponse.json({ error: "브랜드를 찾을 수 없습니다." }, { status: 404 });
  }

  const description =
    typeof body?.description === "string" && body.description.trim()
      ? body.description.trim()
      : null;

  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  const startRaw = typeof body?.applicationStartDate === "string" ? body.applicationStartDate : "";
  const endRaw = typeof body?.applicationEndDate === "string" ? body.applicationEndDate : "";
  if (startRaw && !DATE_RE.test(startRaw)) {
    return NextResponse.json({ error: "신청 시작일 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (endRaw && !DATE_RE.test(endRaw)) {
    return NextResponse.json({ error: "신청 종료일 형식이 올바르지 않습니다." }, { status: 400 });
  }
  if (startRaw && endRaw && endRaw < startRaw) {
    return NextResponse.json(
      { error: "신청 종료일은 시작일보다 빠를 수 없습니다." },
      { status: 400 }
    );
  }
  const applicationStartDate = startRaw ? toDateOnly(startRaw) : null;
  const applicationEndDate = endRaw ? toDateOnly(endRaw) : null;

  const existing = await prisma.lectureType.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "이미 존재하는 강의 이름입니다." }, { status: 409 });
  }

  const created = await prisma.lectureType.create({
    data: { name, description, brandId, applicationStartDate, applicationEndDate },
    include: { brand: { select: { id: true, name: true } } },
  });
  return NextResponse.json(created, { status: 201 });
}
