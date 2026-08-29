import { prisma } from "@/lib/prisma";
import { maskSchedulesForViewer, ViewerContext } from "@/lib/access-control";
import { formatDateOnly } from "@/lib/date";
import { attachDailyPriority } from "@/lib/lecture-request-queue";
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
  /**
   * 그 날짜(오전/오후/저녁 구분 없이 전체)의 아직 처리되지 않은(PENDING) 요청들 사이에서
   * 몇 번째로 접수됐는지(1, 2, 3...) — src/lib/lecture-request-queue.ts의 attachDailyPriority와
   * 동일한 규칙. 이미 확정/거절된 요청이면 null.
   */
  dailyPriority: number | null;
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
  const withPriority = await attachDailyPriority(lectureRequestRows);
  const priorityById = new Map(withPriority.map((r) => [r.id, r.dailyPriority]));

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
          dailyPriority: priorityById.get(s.lectureRequest.id) ?? null,
        }
      : null,
  }));
}

/**
 * 공용 캘린더(모든 로그인 사용자, GENERAL 포함이 열람) 조회 — 확정된(CONFIRMED) 강의
 * (LECTURE)만 대상이며, 개인일정과 미확정(PROVISIONAL) 건은 애초에 DB 레벨에서 제외한다.
 * 요청자 정보(FC/LOS, 참석인원, 내용 등)는 민감정보이므로 lectureRequest는 항상 null로
 * 내려준다 — title에는 정식 강의유형명을 쓴다(강의 신청으로 생성된 건은 title에
 * "(신청)" 접미사가 붙어 있으므로 lectureType.name을 우선 사용하고, 팀장/매니저가 직접
 * 등록한 자유 텍스트 title은 그대로 사용).
 */
export async function fetchPublicLectureSchedules(params: {
  from: Date;
  to: Date;
  instructorId?: number;
}): Promise<MaskedScheduleRow[]> {
  const schedules = await prisma.schedule.findMany({
    where: {
      date: { gte: params.from, lt: params.to },
      scheduleType: "LECTURE",
      status: "CONFIRMED",
      ...(params.instructorId ? { instructorId: params.instructorId } : {}),
    },
    include: {
      instructor: { select: { name: true } },
      lectureRequest: { include: { lectureType: { select: { name: true } } } },
    },
    orderBy: [{ date: "asc" }, { startTime: "asc" }],
  });

  return schedules.map((s) => ({
    id: s.id,
    date: formatDateOnly(s.date),
    timeBlock: s.timeBlock,
    startTime: s.startTime,
    endTime: s.endTime,
    scheduleType: s.scheduleType,
    status: s.status,
    title: s.lectureRequest?.lectureType.name ?? s.title,
    location: s.location,
    memo: null,
    instructorId: s.instructorId,
    instructorName: s.instructor.name,
    lectureRequest: null,
  }));
}
