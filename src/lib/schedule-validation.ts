/** "HH:mm" 형식 문자열은 항상 0-padding 되어 있어 문자열 비교로 시각 순서를 판단할 수 있다. */

export function isEndAfterStart(startTime: string, endTime: string): boolean {
  return endTime > startTime;
}

export function timesOverlap(
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string
): boolean {
  return aStart < bEnd && bStart < aEnd;
}
