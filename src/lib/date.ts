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
