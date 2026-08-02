import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";

type RouteParams = { params: Promise<{ id: string }> };

const VALID_STATUSES = ["ACTIVE", "INACTIVE"] as const;

/** PATCH /api/instructors/[id] — 강사 정보 수정 (강사 관리 화면, 팀장/매니저 전용) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const data: { name?: string; team?: string; status?: (typeof VALID_STATUSES)[number] } = {};

  if (typeof body?.name === "string") {
    const name = body.name.trim();
    if (!name) {
      return NextResponse.json({ error: "강사 이름을 입력해주세요." }, { status: 400 });
    }
    data.name = name;
  }
  if (typeof body?.team === "string") {
    const team = body.team.trim();
    if (!team) {
      return NextResponse.json({ error: "소속 팀을 입력해주세요." }, { status: 400 });
    }
    data.team = team;
  }
  if (typeof body?.status === "string" && VALID_STATUSES.includes(body.status as never)) {
    data.status = body.status as (typeof VALID_STATUSES)[number];
  }

  const updated = await prisma.instructor.update({ where: { id }, data }).catch(() => null);
  if (!updated) {
    return NextResponse.json({ error: "강사를 찾을 수 없습니다." }, { status: 404 });
  }

  return NextResponse.json(updated);
}

/**
 * DELETE /api/instructors/[id] — 강사 삭제 (강사 관리 화면, 팀장/매니저 전용).
 * 스케줄·강의 신청 이력이 있거나 연결된 로그인 계정이 있으면 거부한다 — 실수로 등록한
 * 강사를 정리하는 용도이며, 실제 활동 이력이 있는 강사는 비활성화(status: INACTIVE)를
 * 대신 사용해야 한다(이력이 통째로 사라지는 것을 막기 위함).
 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const instructor = await prisma.instructor.findUnique({ where: { id } });
  if (!instructor) {
    return NextResponse.json({ error: "강사를 찾을 수 없습니다." }, { status: 404 });
  }

  const [scheduleCount, lectureRequestCount, linkedUser] = await Promise.all([
    prisma.schedule.count({ where: { instructorId: id } }),
    prisma.lectureRequest.count({ where: { instructorId: id } }),
    prisma.user.findUnique({ where: { instructorId: id } }),
  ]);

  if (scheduleCount > 0 || lectureRequestCount > 0) {
    return NextResponse.json(
      {
        error:
          "이 강사는 등록된 스케줄 또는 강의 신청 이력이 있어 삭제할 수 없습니다. 대신 비활성화를 사용해주세요.",
      },
      { status: 409 }
    );
  }
  if (linkedUser) {
    return NextResponse.json(
      { error: "이 강사는 연결된 로그인 계정이 있어 삭제할 수 없습니다." },
      { status: 409 }
    );
  }

  await prisma.instructor.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
