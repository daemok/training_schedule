import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/instructors/[id]/lecture-types — 강사의 현재 강의 유형 배정 목록 (팀장/매니저 전용) */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const { id: idParam } = await params;
  const instructorId = Number(idParam);
  if (!Number.isInteger(instructorId)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const links = await prisma.instructorLectureType.findMany({
    where: { instructorId },
    include: { lectureType: true },
    orderBy: { lectureType: { name: "asc" } },
  });

  return NextResponse.json(links.map((l) => l.lectureType));
}

/**
 * PUT /api/instructors/[id]/lecture-types — 강사의 강의 유형 배정을 전체 교체한다
 * (body: { lectureTypeIds: number[] }). 팀장/매니저만 "강사 Pool"을 관리할 수 있다.
 */
export async function PUT(request: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const { id: idParam } = await params;
  const instructorId = Number(idParam);
  if (!Number.isInteger(instructorId)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const instructor = await prisma.instructor.findUnique({ where: { id: instructorId } });
  if (!instructor) {
    return NextResponse.json({ error: "강사를 찾을 수 없습니다." }, { status: 404 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const lectureTypeIds = Array.isArray(body?.lectureTypeIds)
    ? body.lectureTypeIds.filter((v): v is number => Number.isInteger(v))
    : null;
  if (!lectureTypeIds) {
    return NextResponse.json({ error: "lectureTypeIds 배열이 필요합니다." }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.instructorLectureType.deleteMany({ where: { instructorId } }),
    ...(lectureTypeIds.length > 0
      ? [
          prisma.instructorLectureType.createMany({
            data: lectureTypeIds.map((lectureTypeId) => ({ instructorId, lectureTypeId })),
          }),
        ]
      : []),
  ]);

  const links = await prisma.instructorLectureType.findMany({
    where: { instructorId },
    include: { lectureType: true },
    orderBy: { lectureType: { name: "asc" } },
  });

  return NextResponse.json(links.map((l) => l.lectureType));
}
