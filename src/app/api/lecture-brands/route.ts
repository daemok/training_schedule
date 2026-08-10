import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { getSessionFromRequest } from "@/lib/auth/current-user";

/** GET /api/lecture-brands — 브랜드 전체 목록. 로그인한 모든 역할이 조회할 수 있다. */
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const brands = await prisma.lectureBrand.findMany({ orderBy: { name: "asc" } });
  return NextResponse.json(brands);
}

/** POST /api/lecture-brands — 브랜드 생성 (팀장/매니저 전용, 강사 및 강의 관리 화면) */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "브랜드 이름을 입력해주세요." }, { status: 400 });
  }

  const existing = await prisma.lectureBrand.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "이미 존재하는 브랜드입니다." }, { status: 409 });
  }

  const created = await prisma.lectureBrand.create({ data: { name } });
  return NextResponse.json(created, { status: 201 });
}
