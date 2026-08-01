import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * GET /api/lecture-types/[id]/instructors — 해당 강의 유형을 가르칠 수 있다고 등록된
 * 활성 강사 목록. 일반 사용자가 강의를 신청할 때 "이 강의 유형이 가능한 강사"를 보여주는
 * 용도로 쓰인다(proxy.ts가 이미 로그인 여부를 검증하므로 역할 제한은 없다).
 */
export async function GET(_request: Request, { params }: RouteParams) {
  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const links = await prisma.instructorLectureType.findMany({
    where: { lectureTypeId: id, instructor: { status: "ACTIVE" } },
    include: { instructor: { select: { id: true, name: true, team: true, status: true } } },
    orderBy: { instructor: { name: "asc" } },
  });

  return NextResponse.json(links.map((l) => l.instructor));
}
