import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";

const VALID_STATUSES = ["ACTIVE", "INACTIVE"] as const;

export async function GET() {
  const instructors = await prisma.instructor.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(instructors);
}

/** POST /api/instructors — 새 강사 등록 (강사 관리 화면, 팀장/매니저 전용) */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const team = typeof body?.team === "string" ? body.team.trim() : "";
  const status =
    typeof body?.status === "string" && VALID_STATUSES.includes(body.status as never)
      ? (body.status as (typeof VALID_STATUSES)[number])
      : "ACTIVE";

  if (!name) {
    return NextResponse.json({ error: "강사 이름을 입력해주세요." }, { status: 400 });
  }
  if (!team) {
    return NextResponse.json({ error: "소속 팀을 입력해주세요." }, { status: 400 });
  }

  const created = await prisma.instructor.create({ data: { name, team, status } });
  return NextResponse.json(created, { status: 201 });
}
