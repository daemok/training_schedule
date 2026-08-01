import type { Schedule } from "@/generated/prisma";

/**
 * 스케줄 조회 화면에서의 뷰어(보는 사람) 역할.
 * - INSTRUCTOR: 강사 본인 화면 — 본인 외 강사의 개인일정 상세는 볼 수 없다.
 * - TEAM_LEAD / MANAGER: 상급자 화면 — 모든 강사의 스케줄을 조회·등록·수정·삭제할 수 있고,
 *   개인일정 상세(title/memo)도 마스킹 없이 열람할 수 있다.
 * - GENERAL: 일반 사용자(강의 신청자) — 개인일정 상세를 볼 권한이 없다(항상 마스킹).
 */
export type ViewerRole = "INSTRUCTOR" | "TEAM_LEAD" | "MANAGER" | "GENERAL";

export interface ViewerContext {
  role: ViewerRole;
  /** role === "INSTRUCTOR" 일 때, 로그인한 강사 본인의 instructor_id */
  instructorId?: number;
}

export const PERSONAL_TITLE_PLACEHOLDER = "개인 일정";

/**
 * scheduleType이 PERSONAL(개인일정)인 스케줄의 상세(title/memo)를
 * 열람할 권한이 있는지 판단한다.
 * 권한 규칙: 본인(instructor 본인) 또는 팀장/매니저(상급자 — 모든 강사의 스케줄에 대한
 * 전체 권한을 가짐)만 상세를 볼 수 있다. 그 외 강사가 다른 강사의 개인일정을 보는 경우만 마스킹된다.
 */
export function canViewPersonalDetail(
  schedule: Pick<Schedule, "scheduleType" | "instructorId">,
  viewer: ViewerContext
): boolean {
  if (schedule.scheduleType !== "PERSONAL") return true;
  if (viewer.role === "TEAM_LEAD" || viewer.role === "MANAGER") return true;
  return viewer.role === "INSTRUCTOR" && viewer.instructorId === schedule.instructorId;
}

/** 목록/상세 API·화면에 내려주기 전, 뷰어 권한에 맞게 스케줄을 마스킹한다. */
export function maskScheduleForViewer<T extends Schedule>(
  schedule: T,
  viewer: ViewerContext
): T {
  if (canViewPersonalDetail(schedule, viewer)) {
    return schedule;
  }

  return {
    ...schedule,
    title: PERSONAL_TITLE_PLACEHOLDER,
    memo: null,
  };
}

export function maskSchedulesForViewer<T extends Schedule>(
  schedules: T[],
  viewer: ViewerContext
): T[] {
  return schedules.map((s) => maskScheduleForViewer(s, viewer));
}
