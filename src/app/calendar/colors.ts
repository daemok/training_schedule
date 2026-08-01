import type { CSSProperties } from "react";

/**
 * dataviz 스킬의 검증된 8색 categorical 팔레트(고정 순서, light/dark 각각 CVD 안전성 검증됨).
 * 강사 식별은 항상 이름 텍스트와 함께 노출되므로("identity is never color-alone"),
 * 8명을 넘는 강사는 팔레트를 순환(cycle)하지 않고 그대로 나눠 써도 무방하다.
 */
const INSTRUCTOR_PALETTE: { light: string; dark: string }[] = [
  { light: "#2a78d6", dark: "#3987e5" }, // blue
  { light: "#eb6834", dark: "#d95926" }, // orange
  { light: "#1baf7a", dark: "#199e70" }, // aqua
  { light: "#eda100", dark: "#c98500" }, // yellow
  { light: "#e87ba4", dark: "#d55181" }, // magenta
  { light: "#008300", dark: "#008300" }, // green
  { light: "#4a3aa7", dark: "#9085e9" }, // violet
  { light: "#e34948", dark: "#e66767" }, // red
];

/**
 * 강사 색상은 "누가 필터링되어 있는지"가 아니라 강사 고유 식별자에 고정되어야 한다
 * (필터가 바뀌어도 같은 강사는 항상 같은 색). orderedInstructorIds는 전체 강사 목록을
 * 안정적인 순서(id asc)로 전달해 슬롯을 고정한다.
 */
export function instructorColorVars(
  instructorId: number,
  orderedInstructorIds: number[]
): CSSProperties {
  const index = orderedInstructorIds.indexOf(instructorId);
  const slot = INSTRUCTOR_PALETTE[(index < 0 ? 0 : index) % INSTRUCTOR_PALETTE.length];
  return {
    "--ic-light": slot.light,
    "--ic-dark": slot.dark,
  } as CSSProperties;
}
