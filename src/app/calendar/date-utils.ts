import type { ViewMode } from "./types";

export function addDaysUTC(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

export function addMonthsUTC(date: Date, months: number): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1));
}

/**
 * 모든 캘린더 화면이 최초 진입 시 기본으로 보여줄 "다음 달 1일" — 오늘이 속한 달의 다음 달을
 * 반환한다(사용자가 "오늘" 버튼을 누르면 실제 오늘이 속한 달로 돌아간다, 초기값에만 적용).
 */
export function nextMonthAnchor(base: Date = new Date()): Date {
  return addMonthsUTC(new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), 1)), 1);
}

/** 선택된 뷰(월/주/일)에 해당하는 조회 날짜 범위. end는 미포함(exclusive). */
export function getViewRange(view: ViewMode, anchor: Date): { start: Date; end: Date } {
  if (view === "month") {
    const start = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
    const end = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
    return { start, end };
  }
  if (view === "week") {
    const start = addDaysUTC(anchor, -anchor.getUTCDay());
    return { start, end: addDaysUTC(start, 7) };
  }
  return { start: anchor, end: addDaysUTC(anchor, 1) };
}

export function shiftAnchor(view: ViewMode, anchor: Date, direction: 1 | -1): Date {
  if (view === "month") return addMonthsUTC(anchor, direction);
  if (view === "week") return addDaysUTC(anchor, direction * 7);
  return addDaysUTC(anchor, direction);
}

/** 월간 뷰의 6주(42일) 그리드 — 이전/다음 달의 여백 날짜 포함 */
export function buildMonthGridDays(anchor: Date): Date[] {
  const firstOfMonth = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
  const gridStart = addDaysUTC(firstOfMonth, -firstOfMonth.getUTCDay());
  return Array.from({ length: 42 }, (_, i) => addDaysUTC(gridStart, i));
}

/** 주간 뷰의 7일 */
export function buildWeekDays(anchor: Date): Date[] {
  const start = addDaysUTC(anchor, -anchor.getUTCDay());
  return Array.from({ length: 7 }, (_, i) => addDaysUTC(start, i));
}

const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"] as const;

export function weekdayLabel(date: Date): string {
  return WEEKDAY_LABELS[date.getUTCDay()];
}

export function formatMonthTitle(anchor: Date): string {
  return `${anchor.getUTCFullYear()}년 ${anchor.getUTCMonth() + 1}월`;
}

export function formatWeekTitle(anchor: Date): string {
  const days = buildWeekDays(anchor);
  const start = days[0];
  const end = days[6];
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();
  const startLabel = `${start.getUTCMonth() + 1}월 ${start.getUTCDate()}일`;
  const endLabel = sameMonth
    ? `${end.getUTCDate()}일`
    : `${end.getUTCMonth() + 1}월 ${end.getUTCDate()}일`;
  return `${start.getUTCFullYear()}년 ${startLabel} ~ ${endLabel}`;
}

export function formatDayTitle(anchor: Date): string {
  return `${anchor.getUTCFullYear()}년 ${anchor.getUTCMonth() + 1}월 ${anchor.getUTCDate()}일 (${weekdayLabel(anchor)})`;
}
