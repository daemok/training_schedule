import { prisma } from "@/lib/prisma";
import { maskSchedulesForViewer, ViewerContext } from "@/lib/access-control";
import { formatDateOnly } from "@/lib/date";
import { attachQueuePositions } from "@/lib/lecture-request-queue";
import type { TimeBlock, ScheduleType } from "@/lib/schedule-labels";
import type { ScheduleStatus } from "@/generated/prisma";

export interface MaskedScheduleLectureRequest {
  id: number;
  lectureTypeName: string;
  requesterName: string;
  requesterEmail: string;
  fcLos: string;
  attendeeCount: number;
  content: string;
  /** 같은 날짜+시간대에 접수된 순서(1, 2, 3...) — src/lib/lecture-request-queue.ts와 동일한 규칙. */
  queuePosition: number;
}

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
  // PROVISIONAL(미확정) 상태의 LECTURE 스케줄에만 채워진다 — 캘린더에서 미확정 항목을
  // 클릭했을 때 상세 내용(FC/LOS, 참석인원, 요청 내용, 접수 순서 등)과 확정/거절 버튼을
  // 보여주기 위함.
  lectureRequest: MaskedScheduleLectureRequest | null;
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
    include: {
      instructor: { select: { name: true } },
      lectureRequest: {
        include: { lectureType: { select: { name: true } }, requester: { select: { name: true, email: true } } },
      },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  const masked = maskSchedulesForViewer(schedules, params.viewer);

  const lectureRequestRows = masked
    .map((s) => s.lectureRequest)
    .filter((lr): lr is NonNullable<typeof lr> => lr !== null);
  const withPositions = await attachQueuePositions(lectureRequestRows);
  const positionById = new Map(withPositions.map((r) => [r.id, r.queuePosition]));

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
    lectureRequest: s.lectureRequest
      ? {
          id: s.lectureRequest.id,
          lectureTypeName: s.lectureRequest.lectureType.name,
          requesterName: s.lectureRequest.requester.name ?? s.lectureRequest.requester.email,
          requesterEmail: s.lectureRequest.requester.email,
          fcLos: s.lectureRequest.fcLos,
          attendeeCount: s.lectureRequest.attendeeCount,
          content: s.lectureRequest.content,
          queuePosition: positionById.get(s.lectureRequest.id) ?? 1,
        }
      : null,
  }));
}
