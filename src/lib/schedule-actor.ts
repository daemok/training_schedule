import type { NextRequest } from "next/server";
import { getSessionFromRequest } from "@/lib/auth/current-user";
import type { SessionRole } from "@/lib/auth/session";

/**
 * 스케줄 등록/수정/삭제 요청을 수행하는 행위자(actor).
 * - INSTRUCTOR: fixedInstructorId가 본인 강사 id로 고정되어, 본인 스케줄만 다룰 수 있다.
 * - TEAM_LEAD / MANAGER: 상급자로서 모든 강사의 스케줄을 다룰 수 있으므로 fixedInstructorId가 null이다.
 */
export type ScheduleActor = {
  userId: number;
  role: SessionRole;
  fixedInstructorId: number | null;
};

export type ScheduleActorResult =
  | ({ status: 200 } & ScheduleActor)
  | { status: 401 | 403; error: string };

export async function resolveScheduleActor(
  request: NextRequest
): Promise<ScheduleActorResult> {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return { status: 401, error: "로그인이 필요합니다." };
  }
  if (user.role === "INSTRUCTOR") {
    if (!user.instructorId) {
      return { status: 403, error: "강사 계정에 연결된 강사 정보가 없습니다." };
    }
    return {
      status: 200,
      userId: user.userId,
      role: user.role,
      fixedInstructorId: user.instructorId,
    };
  }
  if (user.role === "GENERAL") {
    // 일반 사용자는 이 엔드포인트를 직접 호출할 수 없다 — 강의 신청(LectureRequest) 흐름을
    // 통해서만 간접적으로 스케줄이 생성된다.
    return { status: 403, error: "이 작업을 수행할 권한이 없습니다." };
  }
  return { status: 200, userId: user.userId, role: user.role, fixedInstructorId: null };
}

/** 행위자가 주어진 강사의 스케줄을 등록/수정/삭제할 수 있는지 판단한다. */
export function canManageSchedule(
  actor: ScheduleActor,
  scheduleInstructorId: number
): boolean {
  if (actor.fixedInstructorId === null) return true; // TEAM_LEAD / MANAGER
  return actor.fixedInstructorId === scheduleInstructorId;
}
