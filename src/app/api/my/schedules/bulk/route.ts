import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth/current-user";
import { toDateOnly } from "@/lib/date";
import { findOverlaps } from "@/lib/schedule-overlap";
import { ALL_DAY_BLOCKS } from "@/lib/schedule-all-day";
import { MAX_BULK_PERSONAL_DATES } from "@/lib/schedule-bulk";
import { PERSONAL_TITLE_PLACEHOLDER } from "@/lib/access-control";
import { notifyTeamLeadsOfBulkPersonalSchedule } from "@/lib/notifications";
import type { TimeBlock } from "@/lib/schedule-labels";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const PERSONAL_BLOCKS = ["ALL_DAY", "MORNING", "AFTERNOON", "EVENING"] as const;

/**
 * POST /api/my/schedules/bulk — 강사 본인의 개인일정을 여러 날짜에 한 번에 등록한다
 * (강사 전용 — 팀장/매니저의 대리 등록은 지원하지 않음). 모든 날짜는 동일한 시간대
 * (종일/오전/오후/저녁)와 사유를 공유한다. "종일"은 날짜마다 오전/오후/저녁 3개의
 * 독립된 Schedule row로 분해된다(시간 블록이 최소 등록 단위이기 때문).
 * 겹치는 일정이 있으면 force:true 없이는 아무것도 만들지 않고 409로 전체 충돌 목록을 반환한다.
 */
export async function POST(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (user.role !== "INSTRUCTOR" || !user.instructorId) {
    return NextResponse.json({ error: "강사 계정만 사용할 수 있습니다." }, { status: 403 });
  }
  const instructorId = user.instructorId;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) {
    return NextResponse.json({ error: "잘못된 요청입니다." }, { status: 400 });
  }

  const rawDates = Array.isArray(body.dates) ? body.dates : [];
  const dates = Array.from(
    new Set(rawDates.filter((d): d is string => typeof d === "string" && DATE_RE.test(d)))
  );
  if (dates.length === 0) {
    return NextResponse.json({ error: "날짜를 1개 이상 선택해주세요." }, { status: 400 });
  }
  if (dates.length > MAX_BULK_PERSONAL_DATES) {
    return NextResponse.json(
      { error: `날짜는 최대 ${MAX_BULK_PERSONAL_DATES}개까지 선택할 수 있습니다.` },
      { status: 400 }
    );
  }

  const personalBlock =
    typeof body.personalBlock === "string" &&
    (PERSONAL_BLOCKS as readonly string[]).includes(body.personalBlock)
      ? (body.personalBlock as (typeof PERSONAL_BLOCKS)[number])
      : undefined;
  if (!personalBlock) {
    return NextResponse.json(
      { error: "시간대(종일/오전/오후/저녁)를 선택해주세요." },
      { status: 400 }
    );
  }

  const title =
    typeof body.title === "string" && body.title.trim() ? body.title.trim() : PERSONAL_TITLE_PLACEHOLDER;
  const force = Boolean(body.force);

  const timeBlocks: TimeBlock[] = personalBlock === "ALL_DAY" ? ALL_DAY_BLOCKS : [personalBlock];
  const pairs = dates.flatMap((date) => timeBlocks.map((timeBlock) => ({ date, timeBlock })));

  if (!force) {
    const conflictLists = await Promise.all(
      pairs.map(async ({ date, timeBlock }) => {
        const conflicts = await findOverlaps(instructorId, toDateOnly(date), timeBlock, null, null);
        return conflicts.map((c) => ({ date, timeBlock, title: c.title }));
      })
    );
    const conflicts = conflictLists.flat();
    if (conflicts.length > 0) {
      const conflictingDateCount = new Set(conflicts.map((c) => c.date)).size;
      return NextResponse.json(
        {
          error: `${conflictingDateCount}개 날짜에 이미 겹치는 일정이 있습니다.`,
          overlap: true,
          conflicts,
        },
        { status: 409 }
      );
    }
  }

  const created = await prisma.$transaction(
    pairs.map(({ date, timeBlock }) =>
      prisma.schedule.create({
        data: {
          instructorId,
          date: toDateOnly(date),
          timeBlock,
          startTime: null,
          endTime: null,
          scheduleType: "PERSONAL",
          title,
          location: null,
          memo: null,
        },
      })
    )
  );

  try {
    const instructor = await prisma.instructor.findUnique({
      where: { id: instructorId },
      select: { name: true },
    });
    if (instructor) {
      await notifyTeamLeadsOfBulkPersonalSchedule(instructor.name, dates.length, created.length);
    }
  } catch (err) {
    console.error("Failed to notify team leads of bulk schedule:", err);
  }

  return NextResponse.json({ createdCount: created.length, dates: dates.slice().sort() }, { status: 201 });
}

/**
 * 대상 id 배열이 전부 요청 강사 본인 소유의 PERSONAL 스케줄인지 확인한다 — 하나라도 아니면
 * 전체를 거부한다(부분 성공 없음, POST의 "강사 전용" 규칙과 동일하게 대리 처리는 지원하지 않음).
 */
async function loadOwnedPersonalSchedules(instructorId: number, ids: number[]) {
  const schedules = await prisma.schedule.findMany({
    where: { id: { in: ids }, instructorId, scheduleType: "PERSONAL" },
  });
  if (schedules.length !== ids.length) {
    return null;
  }
  return schedules;
}

function parseIds(body: Record<string, unknown> | null): number[] | null {
  const raw = Array.isArray(body?.ids) ? body.ids : [];
  const ids = Array.from(new Set(raw.filter((v): v is number => Number.isInteger(v))));
  if (ids.length === 0 || ids.length > MAX_BULK_PERSONAL_DATES) {
    return null;
  }
  return ids;
}

/**
 * PATCH /api/my/schedules/bulk — 선택한 여러 개인일정에 동일한 새 사유/장소/시간대를
 * 한 번에 적용한다(강사 본인 전용). 시간대를 바꾸는 경우 각 행마다 날짜가 다르므로
 * 새 시간대 기준으로 각각 충돌 여부를 확인하고, 하나라도 겹치면 force:true 없이는
 * 아무것도 바꾸지 않는다(bulk-create와 동일한 충돌 응답 형식).
 */
export async function PATCH(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (user.role !== "INSTRUCTOR" || !user.instructorId) {
    return NextResponse.json({ error: "강사 계정만 사용할 수 있습니다." }, { status: 403 });
  }
  const instructorId = user.instructorId;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const ids = parseIds(body);
  if (!ids) {
    return NextResponse.json(
      { error: `수정할 일정을 1개 이상 ${MAX_BULK_PERSONAL_DATES}개 이하로 선택해주세요.` },
      { status: 400 }
    );
  }

  const schedules = await loadOwnedPersonalSchedules(instructorId, ids);
  if (!schedules) {
    return NextResponse.json(
      { error: "본인의 개인일정만 일괄 수정할 수 있습니다." },
      { status: 403 }
    );
  }

  const title = typeof body?.title === "string" && body.title.trim() ? body.title.trim() : undefined;
  const location = typeof body?.location === "string" ? body.location.trim() || null : undefined;
  const personalBlock =
    typeof body?.personalBlock === "string" &&
    (["MORNING", "AFTERNOON", "EVENING"] as readonly string[]).includes(body.personalBlock)
      ? (body.personalBlock as TimeBlock)
      : undefined;
  const force = Boolean(body?.force);

  if (title === undefined && location === undefined && personalBlock === undefined) {
    return NextResponse.json({ error: "변경할 값이 없습니다." }, { status: 400 });
  }

  if (personalBlock && !force) {
    const conflictLists = await Promise.all(
      schedules.map(async (s) => {
        const conflicts = await findOverlaps(instructorId, s.date, personalBlock, null, null, s.id);
        return conflicts.map((c) => ({
          date: s.date.toISOString().slice(0, 10),
          timeBlock: personalBlock,
          title: c.title,
        }));
      })
    );
    const conflicts = conflictLists.flat();
    if (conflicts.length > 0) {
      const conflictingCount = new Set(conflicts.map((c) => c.date)).size;
      return NextResponse.json(
        {
          error: `${conflictingCount}개 날짜에 이미 겹치는 일정이 있습니다.`,
          overlap: true,
          conflicts,
        },
        { status: 409 }
      );
    }
  }

  await prisma.schedule.updateMany({
    where: { id: { in: ids } },
    data: {
      ...(title !== undefined ? { title } : {}),
      ...(location !== undefined ? { location } : {}),
      ...(personalBlock ? { timeBlock: personalBlock } : {}),
    },
  });

  return NextResponse.json({ updatedCount: ids.length });
}

/**
 * DELETE /api/my/schedules/bulk — 선택한 여러 개인일정을 한 번에 삭제한다(강사 본인 전용).
 * 단건 삭제(src/app/api/my/schedules/[id]/route.ts)와 동일하게 삭제 전 스냅샷을
 * ScheduleDeleteLog에 남기되, N개의 create 대신 createMany + deleteMany로 배치 처리한다
 * (ScheduleDeleteLog는 Schedule에 FK가 없어 안전 — schema.prisma 모델 주석 참고).
 */
export async function DELETE(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  if (user.role !== "INSTRUCTOR" || !user.instructorId) {
    return NextResponse.json({ error: "강사 계정만 사용할 수 있습니다." }, { status: 403 });
  }
  const instructorId = user.instructorId;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const ids = parseIds(body);
  if (!ids) {
    return NextResponse.json(
      { error: `삭제할 일정을 1개 이상 ${MAX_BULK_PERSONAL_DATES}개 이하로 선택해주세요.` },
      { status: 400 }
    );
  }

  const schedules = await loadOwnedPersonalSchedules(instructorId, ids);
  if (!schedules) {
    return NextResponse.json(
      { error: "본인의 개인일정만 일괄 삭제할 수 있습니다." },
      { status: 403 }
    );
  }

  await prisma.$transaction([
    prisma.scheduleDeleteLog.createMany({
      data: schedules.map((s) => ({
        scheduleId: s.id,
        instructorId: s.instructorId,
        date: s.date,
        timeBlock: s.timeBlock,
        startTime: s.startTime,
        endTime: s.endTime,
        scheduleType: s.scheduleType,
        title: s.title,
        location: s.location,
        memo: s.memo,
        deletedByUserId: user.userId,
      })),
    }),
    prisma.schedule.deleteMany({ where: { id: { in: ids } } }),
  ]);

  return NextResponse.json({ deletedCount: schedules.length });
}
