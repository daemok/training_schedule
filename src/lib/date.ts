/** "yyyy-MM-dd" 문자열 <-> 시간 없는 UTC 자정 Date 간 변환 헬퍼 */

export function toDateOnly(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00.000Z`);
}

export function formatDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function resolveYearMonth(params: { year?: string; month?: string }) {
  const now = new Date();
  const year = Number(params.year) || now.getFullYear();
  const monthNum = Number(params.month);
  const month = monthNum >= 1 && monthNum <= 12 ? monthNum : now.getMonth() + 1;
  return { year, month };
}

/** month는 1~12 */
export function monthRange(year: number, month: number) {
  const start = new Date(Date.UTC(year, month - 1, 1));
  const end = new Date(Date.UTC(year, month, 1));
  return { start, end };
}

export function shiftMonth(year: number, month: number, delta: number) {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

/**
 * 이 앱은 한국 사용자 전용(휴일 데이터도 KR 전용)이므로, 날짜+시각 입력은 한국 표준시(KST,
 * UTC+9, 서머타임 없음)로 해석한다.
 */
const KST_OFFSET = "+09:00";

/**
 * `<input type="datetime-local">` 값("yyyy-MM-ddTHH:mm")을 KST 벽시계 시각으로 해석해
 * 올바른 UTC 시각의 Date로 변환한다. 초/분이 없는 등 형식이 어긋나면 Invalid Date를 반환한다.
 */
export function toDateTimeKst(dateTimeLocalStr: string): Date {
  return new Date(`${dateTimeLocalStr}:00${KST_OFFSET}`);
}

/**
 * 저장된 UTC Date를 KST 벽시계 기준 "yyyy-MM-ddTHH:mm" 문자열로 변환한다 —
 * `<input type="datetime-local">`의 value로 다시 넣기 위함.
 */
export function formatDateTimeKstLocal(date: Date): string {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 16);
}
