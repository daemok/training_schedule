import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveScheduleActor, canManageSchedule } from "@/lib/schedule-actor";
import { notifyLectureRequestResolved } from "@/lib/notifications";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/lecture-requests/[id]/confirm — 강의 신청 확정.
 * 대상 강사 본인 또는 팀장/매니저만 처리할 수 있다(canManageSchedule과 동일한 권한 규칙).
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const actor = await resolveScheduleActor(request);
  if (actor.status !== 200) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const lectureRequest = await prisma.lectureRequest.findUnique({
    where: { id },
    include: { instructor: { select: { name: true } }, lectureType: { select: { name: true } } },
  });
  if (!lectureRequest) {
    return NextResponse.json({ error: "신청 내역을 찾을 수 없습니다." }, { status: 404 });
  }
  if (!canManageSchedule(actor, lectureRequest.instructorId)) {
    return NextResponse.json({ error: "확정 권한이 없습니다." }, { status: 403 });
  }
  if (lectureRequest.status !== "PENDING") {
    return NextResponse.json({ error: "이미 처리된 신청입니다." }, { status: 409 });
  }

  await prisma.$transaction([
    ...(lectureRequest.scheduleId
      ? [
          prisma.schedule.update({
            where: { id: lectureRequest.scheduleId },
            data: { status: "CONFIRMED" },
          }),
        ]
      : []),
    prisma.lectureRequest.update({
      where: { id },
      data: { status: "CONFIRMED", confirmedById: actor.userId, confirmedAt: new Date() },
    }),
  ]);

  try {
    await notifyLectureRequestResolved({
      requesterUserId: lectureRequest.requesterId,
      lectureTypeName: lectureRequest.lectureType.name,
      instructorName: lectureRequest.instructor.name,
      date: lectureRequest.date,
      timeBlock: lectureRequest.timeBlock,
      confirmed: true,
    });
  } catch (err) {
    console.error("Failed to notify requester of confirmation:", err);
  }

  return NextResponse.json({ ok: true });
}
