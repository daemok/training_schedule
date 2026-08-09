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
