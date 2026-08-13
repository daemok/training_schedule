"use client";

import { useEffect, useState } from "react";
import { getHolidayPreset } from "@hyunbinseo/holidays-kr";

export type HolidayMap = Record<string, readonly string[]>;

/**
 * 화면에 보이는 연도(들)의 대한민국 공휴일(대체공휴일 포함) 정보를 비동기로 불러온다.
 * 패키지가 지원하지 않는 연도(2018~2027 범위 밖)는 조용히 건너뛴다 — 캘린더 색상 표시는
 * 부가 기능이므로 지원 범위 밖 연도에서도 화면이 깨지면 안 된다.
 */
export function useKoreanHolidays(years: number[]): HolidayMap {
  const yearsKey = Array.from(new Set(years)).sort().join(",");
  const [holidays, setHolidays] = useState<HolidayMap>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const merged: HolidayMap = {};
      for (const raw of yearsKey.split(",").filter(Boolean)) {
        try {
          Object.assign(merged, await getHolidayPreset(raw));
        } catch {
          // 데이터가 없는 연도는 건너뜀.
        }
      }
      if (!cancelled) setHolidays(merged);
    })();
    return () => {
      cancelled = true;
    };
  }, [yearsKey]);

  return holidays;
}

/** yyyy-MM-dd 문자열이 토요일 또는 일요일인지 (UTC 기준, 이 앱의 날짜 처리 규칙과 동일). */
export function isWeekendDate(dateStr: string): boolean {
  const day = new Date(`${dateStr}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}

/** 캘린더 칸/시간대 배지를 회색으로 표시해야 하는 날짜인지 — 주말이거나 공휴일(대체공휴일 포함). */
export function isGrayCalendarDate(dateStr: string, holidays: HolidayMap): boolean {
  return isWeekendDate(dateStr) || dateStr in holidays;
}

/** 오전/오후/저녁 배지의 평상시 색상 대신 쓰는 진한 회색 스타일. */
export const TIME_BLOCK_BADGE_CLASS_GRAY =
  "bg-zinc-500 text-white dark:bg-zinc-600 dark:text-zinc-100";
