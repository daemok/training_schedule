export type TimeBlock = "MORNING" | "AFTERNOON" | "EVENING";
export type ScheduleType = "LECTURE" | "PERSONAL";

export const TIME_BLOCK_LABEL: Record<TimeBlock, string> = {
  MORNING: "오전",
  AFTERNOON: "오후",
  EVENING: "저녁",
};

export const SCHEDULE_TYPE_LABEL: Record<ScheduleType, string> = {
  LECTURE: "강의",
  PERSONAL: "개인일정",
};

/**
 * 각 시간대 블록의 표준 시각 범위. 강사 본인 스케줄 등록에는 강제되지 않는(자유 입력)
 * 값이지만, 강의 신청(LectureRequest)의 "요청 시간은 선택한 시간 블록 범위 내여야 한다"는
 * 규칙을 검증할 때 기준으로 사용한다.
 */
export const TIME_BLOCK_RANGE: Record<TimeBlock, { start: string; end: string }> = {
  MORNING: { start: "09:00", end: "12:00" },
  AFTERNOON: { start: "13:00", end: "18:00" },
  EVENING: { start: "18:00", end: "21:00" },
};
