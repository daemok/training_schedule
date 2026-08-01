import { isEndAfterStart } from "@/lib/schedule-validation";
import { PERSONAL_TITLE_PLACEHOLDER } from "@/lib/access-control";

const TIME_BLOCKS = ["MORNING", "AFTERNOON", "EVENING"] as const;
const SCHEDULE_TYPES = ["LECTURE", "PERSONAL"] as const;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export interface ScheduleInput {
  date: string;
  timeBlock: (typeof TIME_BLOCKS)[number];
  // LECTURE는 항상 채워진다. PERSONAL은 "블록 전체"로 등록하면 null(시각 미입력)이 된다.
  startTime: string | null;
  endTime: string | null;
  scheduleType: (typeof SCHEDULE_TYPES)[number];
  title: string;
  location: string | null;
  memo: string | null;
}

type ParseResult =
  | { ok: true; data: ScheduleInput }
  | { ok: false; error: string };

/**
 * 스케줄 등록/수정 요청 바디를 검증하고, scheduleType에 따라
 * title/location/memo를 정규화한다.
 * - LECTURE: title(강의명)·시작/종료 시각 필수, location(장소) 선택
 * - PERSONAL: title은 "사유"(선택 입력) — 비어 있으면 "개인 일정"으로 대체, location/memo는
 *   사용하지 않는다. 시작/종료 시각은 선택 입력이며, 비워두면(블록 전체 점유) null로 저장된다.
 *   "종일"은 이 함수 바깥(클라이언트/라우트)에서 오전·오후·저녁 3개 요청으로 분해해 처리한다.
 */
export function parseScheduleInput(body: unknown): ParseResult {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "잘못된 요청입니다." };
  }
  const b = body as Record<string, unknown>;

  if (typeof b.date !== "string" || !DATE_RE.test(b.date)) {
    return { ok: false, error: "날짜를 선택해주세요." };
  }
  if (typeof b.timeBlock !== "string" || !TIME_BLOCKS.includes(b.timeBlock as never)) {
    return { ok: false, error: "시간대(오전/오후/저녁)를 선택해주세요." };
  }
  if (typeof b.scheduleType !== "string" || !SCHEDULE_TYPES.includes(b.scheduleType as never)) {
    return { ok: false, error: "일정 유형을 선택해주세요." };
  }

  const date = b.date;
  const timeBlock = b.timeBlock as ScheduleInput["timeBlock"];
  const scheduleType = b.scheduleType as ScheduleInput["scheduleType"];
  const rawTitle = typeof b.title === "string" ? b.title.trim() : "";

  const hasStart = typeof b.startTime === "string" && b.startTime !== "";
  const hasEnd = typeof b.endTime === "string" && b.endTime !== "";

  if (scheduleType === "LECTURE") {
    if (!hasStart || !TIME_RE.test(b.startTime as string)) {
      return { ok: false, error: "시작 시각을 선택해주세요." };
    }
    if (!hasEnd || !TIME_RE.test(b.endTime as string)) {
      return { ok: false, error: "종료 시각을 선택해주세요." };
    }
    if (!isEndAfterStart(b.startTime as string, b.endTime as string)) {
      return { ok: false, error: "종료 시각은 시작 시각보다 늦어야 합니다." };
    }
    if (!rawTitle) {
      return { ok: false, error: "강의명을 입력해주세요." };
    }
    const rawLocation = typeof b.location === "string" ? b.location.trim() : "";
    return {
      ok: true,
      data: {
        date,
        timeBlock,
        startTime: b.startTime as string,
        endTime: b.endTime as string,
        scheduleType,
        title: rawTitle,
        location: rawLocation || null,
        memo: null,
      },
    };
  }

  // PERSONAL: 시각은 선택 입력. 하나만 채워진 경우는 잘못된 입력으로 거부한다.
  if (hasStart !== hasEnd) {
    return { ok: false, error: "시작/종료 시각은 둘 다 입력하거나 둘 다 비워주세요." };
  }
  if (hasStart && hasEnd) {
    if (!TIME_RE.test(b.startTime as string) || !TIME_RE.test(b.endTime as string)) {
      return { ok: false, error: "시각 형식이 올바르지 않습니다." };
    }
    if (!isEndAfterStart(b.startTime as string, b.endTime as string)) {
      return { ok: false, error: "종료 시각은 시작 시각보다 늦어야 합니다." };
    }
  }

  return {
    ok: true,
    data: {
      date,
      timeBlock,
      startTime: hasStart ? (b.startTime as string) : null,
      endTime: hasEnd ? (b.endTime as string) : null,
      scheduleType,
      title: rawTitle || PERSONAL_TITLE_PLACEHOLDER,
      location: null,
      memo: null,
    },
  };
}
