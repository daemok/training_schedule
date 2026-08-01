import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { resolveScheduleActor, canManageSchedule, type ScheduleActor } from "@/lib/schedule-actor";
import { parseScheduleInput } from "@/lib/schedule-input";
import { findOverlaps } from "@/lib/schedule-overlap";
import { toDateOnly, formatDateOnly } from "@/lib/date";

type RouteParams = { params: Promise<{ id: string }> };

/**
 * 대상 스케줄을 불러오고, 행위자가 관리 권한이 있는지 확인한다.
 * - INSTRUCTOR: 본인이 등록한 스케줄만 수정/삭제할 수 있다.
 * - TEAM_LEAD / MANAGER: 상급자로서 모든 강사의 스케줄을 수정/삭제할 수 있다.
 */
async function loadManagedSchedule(id: number, actor: ScheduleActor) {
  const schedule = await prisma.schedule.findUnique({ where: { id } });
  if (!schedule) {
    return { status: 404 as const, error: "스케줄을 찾을 수 없습니다." };
  }
  if (!canManageSchedule(actor, schedule.instructorId)) {
    return { status: 403 as const, error: "본인 일정만 수정/삭제할 수 있습니다." };
  }
  return { status: 200 as const, schedule };
}

/** PATCH /api/my/schedules/[id] — 스케줄 수정 (본인 또는 상급자) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const actor = await resolveScheduleActor(request);
  if (actor.status !== 200) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const owned = await loadManagedSchedule(id, actor);
  if (owned.status !== 200) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }
  const instructorId = owned.schedule.instructorId;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
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
      parsed.data.endTime,
      id
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

  const updated = await prisma.schedule.update({
    where: { id },
    data: {
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

  return NextResponse.json({ ...updated, date: formatDateOnly(updated.date) });
}

/** DELETE /api/my/schedules/[id] — 스케줄 삭제(본인 또는 상급자) + 삭제 이력 로그 기록 */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const actor = await resolveScheduleActor(request);
  if (actor.status !== 200) {
    return NextResponse.json({ error: actor.error }, { status: actor.status });
  }

  const { id: idParam } = await params;
  const id = Number(idParam);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const owned = await loadManagedSchedule(id, actor);
  if (owned.status !== 200) {
    return NextResponse.json({ error: owned.error }, { status: owned.status });
  }
  const schedule = owned.schedule;

  await prisma.$transaction([
    prisma.scheduleDeleteLog.create({
      data: {
        scheduleId: schedule.id,
        instructorId: schedule.instructorId,
        date: schedule.date,
        timeBlock: schedule.timeBlock,
        startTime: schedule.startTime,
        endTime: schedule.endTime,
        scheduleType: schedule.scheduleType,
        title: schedule.title,
        location: schedule.location,
        memo: schedule.memo,
        deletedByUserId: actor.userId,
      },
    }),
    prisma.schedule.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
