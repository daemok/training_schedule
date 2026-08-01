import { prisma } from "@/lib/prisma";
import { maskSchedulesForViewer, ViewerContext } from "@/lib/access-control";
import { formatDateOnly } from "@/lib/date";
import type { TimeBlock, ScheduleType } from "@/lib/schedule-labels";
import type { ScheduleStatus } from "@/generated/prisma";

export interface MaskedScheduleRow {
  id: number;
  date: string; // yyyy-MM-dd
  timeBlock: TimeBlock;
  startTime: string | null;
  endTime: string | null;
  scheduleType: ScheduleType;
  status: ScheduleStatus;
  title: string;
  location: string | null;
  memo: string | null;
  instructorId: number;
  instructorName: string;
}

/**
 * 선택된 기간(+선택된 강사) 스케줄을 조회하고, 뷰어 기준으로 마스킹까지 적용한
 * 응답용 배열을 만든다. `/api/schedules`(캘린더 조회)와 `/api/schedules/export`
 * (엑셀 다운로드)가 동일한 조회+마스킹 로직을 공유한다.
 */
export async function fetchMaskedSchedules(params: {
  from: Date;
  to: Date;
  instructorId?: number;
  viewer: ViewerContext;
}): Promise<MaskedScheduleRow[]> {
  const schedules = await prisma.schedule.findMany({
    where: {
      date: { gte: params.from, lt: params.to },
      ...(params.instructorId ? { instructorId: params.instructorId } : {}),
    },
    include: { instructor: { select: { name: true } } },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const masked = maskSchedulesForViewer(schedules, params.viewer);

  return masked.map((s) => ({
    id: s.id,
    date: formatDateOnly(s.date),
    timeBlock: s.timeBlock,
    startTime: s.startTime,
    endTime: s.endTime,
    scheduleType: s.scheduleType,
    status: s.status,
    title: s.title,
    location: s.location,
    memo: s.memo,
    instructorId: s.instructorId,
    instructorName: s.instructor.name,
  }));
}
