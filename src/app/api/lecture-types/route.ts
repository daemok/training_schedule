import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";

/**
 * GET /api/lecture-types — 강의 유형 전체 목록.
 * 로그인한 모든 역할이 조회할 수 있다(일반 사용자는 강의 신청 시 유형을 선택해야 하고,
 * 팀장/매니저는 강사 관리 화면에서 사용한다). proxy.ts가 이미 로그인 여부를 검증한다.
 */
export async function GET() {
  const lectureTypes = await prisma.lectureType.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(lectureTypes);
}

/** POST /api/lecture-types — 강의 유형 생성 (팀장/매니저 전용, 강사 관리) */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  if (!name) {
    return NextResponse.json({ error: "강의 유형 이름을 입력해주세요." }, { status: 400 });
  }
  const description =
    typeof body?.description === "string" && body.description.trim()
      ? body.description.trim()
      : null;

  const existing = await prisma.lectureType.findUnique({ where: { name } });
  if (existing) {
    return NextResponse.json({ error: "이미 존재하는 강의 유형입니다." }, { status: 409 });
  }

  const created = await prisma.lectureType.create({ data: { name, description } });
  return NextResponse.json(created, { status: 201 });
}
