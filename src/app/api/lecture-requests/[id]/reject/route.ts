import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveScheduleActor, canManageSchedule } from "@/lib/schedule-actor";
import { notifyLectureRequestResolved } from "@/lib/notifications";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * POST /api/lecture-requests/[id]/reject — 강의 신청 거절.
 * 점유했던 PROVISIONAL 스케줄을 삭제해 해당 시간 슬롯을 다시 연다.
 * 대상 강사 본인 또는 팀장/매니저만 처리할 수 있다.
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
    return NextResponse.json({ error: "거절 권한이 없습니다." }, { status: 403 });
  }
  if (lectureRequest.status !== "PENDING") {
    return NextResponse.json({ error: "이미 처리된 신청입니다." }, { status: 409 });
  }

  await prisma.$transaction([
    prisma.lectureRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        confirmedById: actor.userId,
        confirmedAt: new Date(),
        scheduleId: null,
      },
    }),
    ...(lectureRequest.scheduleId
      ? [prisma.schedule.delete({ where: { id: lectureRequest.scheduleId } })]
      : []),
  ]);

  try {
    await notifyLectureRequestResolved({
      requesterUserId: lectureRequest.requesterId,
      lectureTypeName: lectureRequest.lectureType.name,
      instructorName: lectureRequest.instructor.name,
      date: lectureRequest.date,
      timeBlock: lectureRequest.timeBlock,
      confirmed: false,
    });
  } catch (err) {
    console.error("Failed to notify requester of rejection:", err);
  }

  return NextResponse.json({ ok: true });
}
