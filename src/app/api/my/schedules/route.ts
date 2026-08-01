import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth/current-user";
import { resolveScheduleActor } from "@/lib/schedule-actor";
import { parseScheduleInput } from "@/lib/schedule-input";
import { findOverlaps } from "@/lib/schedule-overlap";
import { toDateOnly, formatDateOnly, resolveYearMonth, monthRange } from "@/lib/date";
import { notifyTeamLeadsOfNewSchedule } from "@/lib/notifications";

/** GET /api/my/schedules?year=&month= — 로그인한 강사 본인의 월별 스케줄 목록 */
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (user.role !== "INSTRUCTOR" || !user.instructorId) {
    return NextResponse.json(
      { error: "강사 계정만 사용할 수 있습니다." },
      { status: 403 }
    );
  }
  const instructorId = user.instructorId;

  const { searchParams } = new URL(request.url);
  const { year, month } = resolveYearMonth({
    year: searchParams.get("year") ?? undefined,
    month: searchParams.get("month") ?? undefined,
  });
  const { start, end } = monthRange(year, month);

  const schedules = await prisma.schedule.findMany({
    where: { instructorId, date: { gte: start, lt: end } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return NextResponse.json(
    schedules.map((s) => ({ ...s, date: formatDateOnly(s.date) }))
  );
}

/**
 * POST /api/my/schedules — 스케줄 등록 (겹침 발생 시 force:true 없으면 409 반환)
 * - INSTRUCTOR: 본인 강사로 고정 등록됨 (body의 instructorId는 무시)
 * - TEAM_LEAD / MANAGER: 상급자로서 body.instructorId로 지정한 강사 앞으로 등록 가능
 */
export async function POST(request: NextRequest) {
  const actor = await resolveScheduleActor(request);
  if (actor.status !== 200) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;

  let instructorId: number;
  if (actor.fixedInstructorId !== null) {
    instructorId = actor.fixedInstructorId;
  } else {
    const requested = Number(body?.instructorId);
    if (!Number.isInteger(requested)) {
      return NextResponse.json({ error: "등록할 강사를 선택해주세요." }, { status: 400 });
    }
    const instructor = await prisma.instructor.findUnique({
      where: { id: requested },
      select: { id: true },
    });
    if (!instructor) {
      return NextResponse.json({ error: "강사를 찾을 수 없습니다." }, { status: 404 });
    }
    instructorId = instructor.id;
  }

  const parsed = parseScheduleInput(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const force = Boolean(body?.force);
  const dateOnly = toDateOnly(parsed.data.date);

  if (!force) {
    const conflicts = await findOverlaps(
      instructorId,
      dateOnly,
      parsed.data.timeBlock,
      parsed.data.startTime,
      parsed.data.endTime
    );
    if (conflicts.length > 0) {
      return NextResponse.json(
        {
          error: "같은 날짜에 시간이 겹치는 일정이 있습니다.",
          overlap: true,
          conflicts: conflicts.map((c) => ({
            title: c.title,
            startTime: c.startTime,
            endTime: c.endTime,
          })),
        },
        { status: 409 }
      );
    }
  }

  const created = await prisma.schedule.create({
    data: {
      instructorId,
      date: dateOnly,
      timeBlock: parsed.data.timeBlock,
      startTime: parsed.data.startTime,
      endTime: parsed.data.endTime,
      scheduleType: parsed.data.scheduleType,
      title: parsed.data.title,
      location: parsed.data.location,
      memo: parsed.data.memo,
    },
  });

  // 팀장에게 신규 일정 등록 알림 (실패해도 등록 자체는 성공 처리 — 알림은 부가 기능)
  // 등록을 수행한 사람이 팀장 본인이면 스스로에게 알릴 필요는 없으므로 제외한다.
  try {
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { name: true },
    });
    if (instructor) {
      await notifyTeamLeadsOfNewSchedule(
        created,
        instructor.name,
        actor.role === "TEAM_LEAD" ? actor.userId : undefined
      );
    }
  } catch (err) {
    console.error("Failed to notify team leads of new schedule:", err);
  }

  return NextResponse.json(
    { ...created, date: formatDateOnly(created.date) },
    { status: 201 }
  );
}
