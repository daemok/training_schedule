import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { toDateOnly, formatDateOnly } from "@/lib/date";
import { findOverlaps } from "@/lib/schedule-overlap";
import { TIME_BLOCK_RANGE, type TimeBlock } from "@/lib/schedule-labels";
import { notifyLectureRequestCreated } from "@/lib/notifications";
import { attachQueuePositions } from "@/lib/lecture-request-queue";
import { releaseRequestLock } from "@/lib/request-lock";

const TIME_BLOCKS: TimeBlock[] = ["MORNING", "AFTERNOON", "EVENING"];
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function serialize<T extends { date: Date }>(row: T) {
  return { ...row, date: formatDateOnly(row.date) };
}

/**
 * GET /api/lecture-requests?scope=mine|pending
 * - scope=mine: 본인(일반 사용자 또는 강의를 신청한 팀장/매니저)이 신청한 요청 전체(상태 무관)
 * - scope=pending: 확정 대기 목록 — 강사 본인은 자신 앞으로 온 것만, 팀장/매니저는 전체
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["GENERAL", "INSTRUCTOR", "TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope");

  if (scope === "mine") {
    if (user.role !== "GENERAL" && user.role !== "TEAM_LEAD" && user.role !== "MANAGER") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const rows = await prisma.lectureRequest.findMany({
      where: { requesterId: user.userId },
      include: { instructor: { select: { name: true } }, lectureType: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
    });
    const withPosition = await attachQueuePositions(rows);
    return NextResponse.json(withPosition.map(serialize));
  }

  if (scope === "pending") {
    if (user.role === "GENERAL") {
      return NextResponse.json({ error: "권한이 없습니다." }, { status: 403 });
    }
    const where =
      user.role === "INSTRUCTOR"
        ? { status: "PENDING" as const, instructorId: user.instructorId ?? -1 }
        : { status: "PENDING" as const };
    const rows = await prisma.lectureRequest.findMany({
      where,
      include: {
        instructor: { select: { name: true } },
        lectureType: { select: { name: true } },
        requester: { select: { email: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    const withPosition = await attachQueuePositions(rows);
    return NextResponse.json(withPosition.map(serialize));
  }

  return NextResponse.json({ error: "scope=mine 또는 scope=pending 이 필요합니다." }, { status: 400 });
}

/**
 * POST /api/lecture-requests — 강의 신청. 일반 사용자뿐 아니라 팀장/매니저도 상급자
 * 권한으로 동일한 신청 기능을 사용할 수 있다(관리자 역할 확장).
 * 신청 즉시 대상 강사의 스케줄을 PROVISIONAL(가신청)로 점유한다(같은 블록에 다른 스케줄이
 * 있으면 409). 확정/거절은 /api/lecture-requests/[id]/confirm|reject 에서 처리한다.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["GENERAL", "TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;
  const user = auth.user;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const instructorId = Number(body.instructorId);
  const lectureTypeId = Number(body.lectureTypeId);
  const date = typeof body.date === "string" ? body.date : "";
  const timeBlock = typeof body.timeBlock === "string" ? (body.timeBlock as TimeBlock) : undefined;
  const startTime = typeof body.startTime === "string" ? body.startTime : "";
  const endTime = typeof body.endTime === "string" ? body.endTime : "";
  const fcLos = typeof body.fcLos === "string" ? body.fcLos.trim() : "";
  const location = typeof body.location === "string" ? body.location.trim() : "";
  const attendeeCount = Number(body.attendeeCount);
  const content = typeof body.content === "string" ? body.content.trim() : "";

  if (!Number.isInteger(instructorId)) {
    return NextResponse.json({ error: "강사를 선택해주세요." }, { status: 400 });
  }
  if (!Number.isInteger(lectureTypeId)) {
    return NextResponse.json({ error: "강의 유형을 선택해주세요." }, { status: 400 });
  }
  if (!DATE_RE.test(date)) {
    return NextResponse.json({ error: "날짜를 선택해주세요." }, { status: 400 });
  }
  if (!timeBlock || !TIME_BLOCKS.includes(timeBlock)) {
    return NextResponse.json({ error: "시간대(오전/오후/저녁)를 선택해주세요." }, { status: 400 });
  }
  if (!TIME_RE.test(startTime) || !TIME_RE.test(endTime) || endTime <= startTime) {
    return NextResponse.json({ error: "요청 시간이 올바르지 않습니다." }, { status: 400 });
  }
  const range = TIME_BLOCK_RANGE[timeBlock];
  if (startTime < range.start || endTime > range.end) {
    return NextResponse.json(
      { error: `요청 시간은 선택한 시간대 범위(${range.start}~${range.end}) 내여야 합니다.` },
      { status: 400 }
    );
  }
  if (!fcLos) {
    return NextResponse.json({ error: "FC/LOS를 입력해주세요." }, { status: 400 });
  }
  if (!location) {
    return NextResponse.json({ error: "장소를 입력해주세요." }, { status: 400 });
  }
  if (!Number.isInteger(attendeeCount) || attendeeCount <= 0) {
    return NextResponse.json({ error: "참석 인원을 올바르게 입력해주세요." }, { status: 400 });
  }
  if (!content) {
    return NextResponse.json({ error: "강의 요청 목적을 입력해주세요." }, { status: 400 });
  }

  const instructor = await prisma.instructor.findUnique({ where: { id: instructorId } });
  if (!instructor || instructor.status !== "ACTIVE") {
    return NextResponse.json({ error: "신청할 수 없는 강사입니다." }, { status: 404 });
  }

  const lectureType = await prisma.lectureType.findUnique({ where: { id: lectureTypeId } });
  if (!lectureType || !lectureType.isActive) {
    return NextResponse.json({ error: "신청할 수 없는 강의 유형입니다." }, { status: 404 });
  }
  // 신청 가능 기간은 일반 사용자에게만 적용된다 — 팀장/매니저는 상급자로서 기간과 무관하게
  // 신청할 수 있다(위 POST 주석 참고).
  if (user.role === "GENERAL") {
    // 신청 기간은 이제 날짜+시각까지 관리자가 직접 지정하므로(예: 종료일 18:00까지),
    // 시각까지 포함한 현재 시각을 그대로 비교한다.
    const now = new Date();
    if (lectureType.applicationStartDate && now < lectureType.applicationStartDate) {
      return NextResponse.json(
        { error: "아직 신청 기간이 시작되지 않은 강의입니다." },
        { status: 400 }
      );
    }
    if (lectureType.applicationEndDate && now > lectureType.applicationEndDate) {
      return NextResponse.json({ error: "신청 기간이 종료된 강의입니다." }, { status: 400 });
    }
  }

  const qualified = await prisma.instructorLectureType.findUnique({
    where: { instructorId_lectureTypeId: { instructorId, lectureTypeId } },
  });
  if (!qualified) {
    return NextResponse.json(
      { error: "해당 강사는 이 강의 유형을 가르칠 수 없습니다." },
      { status: 400 }
    );
  }

  const dateOnly = toDateOnly(date);
  const conflicts = await findOverlaps(instructorId, dateOnly, timeBlock, startTime, endTime);
  if (conflicts.length > 0) {
    return NextResponse.json(
      { error: "이미 예약되었거나 겹치는 시간입니다. 다른 시간을 선택해주세요.", overlap: true },
      { status: 409 }
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const schedule = await tx.schedule.create({
      data: {
        instructorId,
        date: dateOnly,
        timeBlock,
        startTime,
        endTime,
        scheduleType: "LECTURE",
        status: "PROVISIONAL",
        title: `${lectureType.name} (신청)`,
        location,
      },
    });
    const lectureRequest = await tx.lectureRequest.create({
      data: {
        requesterId: user.userId,
        instructorId,
        lectureTypeId,
        date: dateOnly,
        timeBlock,
        startTime,
        endTime,
        fcLos,
        location,
        attendeeCount,
        content,
        scheduleId: schedule.id,
      },
    });
    return lectureRequest;
  });

  await releaseRequestLock(instructorId, dateOnly, timeBlock, user.userId).catch(() => {});

  try {
    await notifyLectureRequestCreated({
      scheduleId: result.scheduleId!,
      instructorId,
      instructorName: instructor.name,
      lectureTypeName: lectureType.name,
      date: dateOnly,
      timeBlock,
    });
  } catch (err) {
    console.error("Failed to notify of new lecture request:", err);
  }

  return NextResponse.json(serialize(result), { status: 201 });
}
