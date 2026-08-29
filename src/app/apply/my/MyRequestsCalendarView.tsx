"use client";

import { useState } from "react";
import { formatDateOnly } from "@/lib/date";
import { TIME_BLOCK_LABEL } from "@/lib/schedule-labels";
import {
  buildMonthGridDays,
  formatMonthTitle,
  shiftAnchor,
  nextMonthAnchor,
} from "@/app/calendar/date-utils";
import { isGrayCalendarDate, useKoreanHolidays, TIME_BLOCK_BADGE_CLASS_GRAY } from "@/lib/korean-holidays";
import { STATUS_LABEL, STATUS_BADGE_CLASS, type MyRequestRow } from "./types";

const WEEKDAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];

/**
 * 내 신청 내역 캘린더형 — 월 전체 그리드에 신청 건을 날짜별로 묶어 보여준다. 강사색 대신
 * 상태색(미확정/확정/거절)으로 구분하고, pill을 클릭하면 리스트형 카드와 동일한 상세 필드를
 * 오른쪽 패널로 보여준다.
 */
export function MyRequestsCalendarView({ requests }: { requests: MyRequestRow[] }) {
  const [anchor, setAnchor] = useState(() => nextMonthAnchor());
  const [selected, setSelected] = useState<MyRequestRow | null>(null);

  const days = buildMonthGridDays(anchor);
  const currentMonth = anchor.getUTCMonth();
  const today = formatDateOnly(new Date());
  const holidayYears = Array.from(new Set(days.map((d) => d.getUTCFullYear())));
  const holidays = useKoreanHolidays(holidayYears);

  const byDate = new Map<string, MyRequestRow[]>();
  for (const r of requests) {
    const list = byDate.get(r.date) ?? [];
    list.push(r);
    byDate.set(r.date, list);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setAnchor(shiftAnchor("month", anchor, -1))}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
        >
          ← 이전
        </button>
        <button
          onClick={() => setAnchor(nextMonthAnchor(new Date()))}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
        >
          오늘
        </button>
        <button
          onClick={() => setAnchor(shiftAnchor("month", anchor, 1))}
          className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
        >
          다음 →
        </button>
        <span className="ml-2 text-xl font-semibold text-black dark:text-zinc-50">
          {formatMonthTitle(anchor)}
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <div className="min-w-[640px]">
          <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-xs font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            {WEEKDAY_HEADERS.map((w) => (
              <div key={w} className="py-2">
                {w}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {days.map((d) => {
              const dateStr = formatDateOnly(d);
              const inMonth = d.getUTCMonth() === currentMonth;
              const isToday = dateStr === today;
              const dayRequests = byDate.get(dateStr) ?? [];
              const isGrayDay = isGrayCalendarDate(dateStr, holidays);

              return (
                <div
                  key={dateStr}
                  className={`min-h-[104px] border-b border-r border-zinc-200 p-1.5 dark:border-zinc-800 ${
                    isGrayDay
                      ? "bg-zinc-200 dark:bg-zinc-800"
                      : inMonth
                        ? ""
                        : "bg-zinc-50/60 dark:bg-zinc-950/40"
                  }`}
                >
                  <div
                    className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-xs ${
                      isToday
                        ? "bg-black font-semibold text-white dark:bg-zinc-50 dark:text-black"
                        : inMonth
                          ? "text-zinc-700 dark:text-zinc-300"
                          : "text-zinc-400 dark:text-zinc-600"
                    }`}
                  >
                    {d.getUTCDate()}
                  </div>
                  <div className="flex flex-col gap-0.5">
                    {dayRequests.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => setSelected(r)}
                        title={`${r.lectureTypeName} · ${r.instructorName} (${STATUS_LABEL[r.status]})`}
                        className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      >
                        <span
                          className={`shrink-0 rounded px-1 py-px text-[10px] font-medium ${
                            isGrayDay ? TIME_BLOCK_BADGE_CLASS_GRAY : STATUS_BADGE_CLASS[r.status]
                          }`}
                        >
                          {TIME_BLOCK_LABEL[r.timeBlock]}
                        </span>
                        <span className="truncate text-zinc-700 dark:text-zinc-200">
                          {r.lectureTypeName}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {selected && (
        <div
          className="fixed inset-0 z-40 flex justify-end bg-black/30"
          onClick={() => setSelected(null)}
        >
          <div
            className="h-full w-full max-w-sm overflow-y-auto bg-white p-6 shadow-xl dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <span
                className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[selected.status]}`}
              >
                {STATUS_LABEL[selected.status]}
              </span>
              <button
                onClick={() => setSelected(null)}
                aria-label="닫기"
                className="text-xl leading-none text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              >
                ×
              </button>
            </div>
            <h2 className="mb-6 text-lg font-semibold text-black dark:text-zinc-50">
              {selected.lectureTypeName} · {selected.instructorName} 강사
            </h2>
            <dl className="flex flex-col gap-4 text-sm">
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">날짜 · 시간대</dt>
                <dd className="mt-0.5 font-medium text-black dark:text-zinc-50">
                  {selected.date} · {TIME_BLOCK_LABEL[selected.timeBlock]} ({selected.queuePosition}번째)
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">시작 ~ 종료</dt>
                <dd className="mt-0.5 font-medium text-black dark:text-zinc-50">
                  {selected.startTime} ~ {selected.endTime}
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">장소 · 참석 인원</dt>
                <dd className="mt-0.5 font-medium text-black dark:text-zinc-50">
                  {selected.location} · {selected.attendeeCount}명
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">FC/LOS</dt>
                <dd className="mt-0.5 font-medium text-black dark:text-zinc-50">{selected.fcLos}</dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">요청 내용</dt>
                <dd className="mt-0.5 text-black dark:text-zinc-50">{selected.content}</dd>
              </div>
              {selected.status === "REJECTED" && selected.rejectionReason && (
                <div>
                  <dt className="text-zinc-500 dark:text-zinc-400">거절 사유</dt>
                  <dd className="mt-0.5 text-black dark:text-zinc-50">{selected.rejectionReason}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>
      )}
    </div>
  );
}
