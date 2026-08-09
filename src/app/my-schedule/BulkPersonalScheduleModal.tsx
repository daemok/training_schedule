"use client";

import { useState } from "react";
import { buildMonthGridDays, formatMonthTitle, shiftAnchor } from "@/app/calendar/date-utils";
import { formatDateOnly } from "@/lib/date";
import { MAX_BULK_PERSONAL_DATES, type BulkConflictInfo, type BulkSubmitResult } from "@/lib/schedule-bulk";
import type { PersonalBlockChoice } from "./personal-block";
import { PERSONAL_BLOCK_LABEL } from "./personal-block";

export interface BulkSchedulePayload {
  dates: string[];
  personalBlock: PersonalBlockChoice;
  title: string;
}

interface Props {
  onCancel: () => void;
  onSubmit: (payload: BulkSchedulePayload, force: boolean) => Promise<BulkSubmitResult>;
}

const WEEKDAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];
const PERSONAL_BLOCK_CHOICES: PersonalBlockChoice[] = ["ALL_DAY", "MORNING", "AFTERNOON", "EVENING"];

function currentMonthAnchor(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
}

/** 강사 본인의 개인일정을 여러 날짜에 한 번에 등록하는 모달(최대 MAX_BULK_PERSONAL_DATES개). */
export function BulkPersonalScheduleModal({ onCancel, onSubmit }: Props) {
  const [anchor, setAnchor] = useState(currentMonthAnchor);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [personalBlock, setPersonalBlock] = useState<PersonalBlockChoice>("ALL_DAY");
  const [title, setTitle] = useState("");
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [overlapWarning, setOverlapWarning] = useState<{
    message: string;
    conflicts: BulkConflictInfo[];
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [createdCount, setCreatedCount] = useState<number | null>(null);

  const today = formatDateOnly(new Date());
  const days = buildMonthGridDays(anchor);
  const currentMonth = anchor.getUTCMonth();
  const selectedSet = new Set(selectedDates);

  function toggleDate(dateStr: string) {
    setOverlapWarning(null);
    setSelectedDates((prev) => {
      if (prev.includes(dateStr)) {
        setFieldError(null);
        return prev.filter((d) => d !== dateStr);
      }
      if (prev.length >= MAX_BULK_PERSONAL_DATES) {
        setFieldError(`최대 ${MAX_BULK_PERSONAL_DATES}개 날짜까지 선택할 수 있습니다.`);
        return prev;
      }
      setFieldError(null);
      return [...prev, dateStr].sort();
    });
  }

  function removeDate(dateStr: string) {
    setFieldError(null);
    setSelectedDates((prev) => prev.filter((d) => d !== dateStr));
  }

  async function submit(force: boolean) {
    if (selectedDates.length === 0) {
      setFieldError("날짜를 1개 이상 선택해주세요.");
      return;
    }
    setFieldError(null);
    setSubmitting(true);

    const result = await onSubmit({ dates: selectedDates, personalBlock, title }, force);

    setSubmitting(false);

    if (result.ok) {
      setOverlapWarning(null);
      setCreatedCount(result.createdCount);
      return;
    }

    if (result.overlap) {
      setOverlapWarning({ message: result.error, conflicts: result.conflicts ?? [] });
      return;
    }

    setOverlapWarning(null);
    setFieldError(result.error);
  }

  if (createdCount !== null) {
    return (
      <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
        <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
          <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">
            일괄 등록이 완료되었습니다
          </h2>
          <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
            총 {createdCount}건의 개인일정이 등록되었습니다.
          </p>
          <div className="flex justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
            >
              확인
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="max-h-full w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="mb-1 text-lg font-semibold text-black dark:text-zinc-50">
          개인일정 일괄 등록
        </h2>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          날짜를 여러 개 선택하면 같은 시간대·사유로 한 번에 등록됩니다(최대{" "}
          {MAX_BULK_PERSONAL_DATES}개).
        </p>

        <div className="flex flex-col gap-4 sm:flex-row">
          <div className="sm:w-80 sm:shrink-0">
            <div className="mb-2 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setAnchor((a) => shiftAnchor("month", a, -1))}
                className="rounded-full border border-zinc-300 px-2 py-1 text-xs hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
              >
                ← 이전
              </button>
              <span className="text-sm font-medium text-black dark:text-zinc-50">
                {formatMonthTitle(anchor)}
              </span>
              <button
                type="button"
                onClick={() => setAnchor((a) => shiftAnchor("month", a, 1))}
                className="rounded-full border border-zinc-300 px-2 py-1 text-xs hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
              >
                다음 →
              </button>
            </div>
            <div className="overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
              <div className="grid grid-cols-7 border-b border-zinc-200 bg-zinc-50 text-center text-[11px] font-medium text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                {WEEKDAY_HEADERS.map((w) => (
                  <div key={w} className="py-1.5">
                    {w}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {days.map((d) => {
                  const dateStr = formatDateOnly(d);
                  const inMonth = d.getUTCMonth() === currentMonth;
                  const isToday = dateStr === today;
                  const isSelected = selectedSet.has(dateStr);
                  return (
                    <button
                      type="button"
                      key={dateStr}
                      onClick={() => toggleDate(dateStr)}
                      className={`flex h-10 items-center justify-center border-b border-r border-zinc-200 text-sm dark:border-zinc-800 ${
                        inMonth ? "" : "text-zinc-300 dark:text-zinc-700"
                      } ${
                        isSelected
                          ? "bg-black font-semibold text-white dark:bg-zinc-50 dark:text-black"
                          : isToday
                            ? "font-semibold text-black dark:text-zinc-50"
                            : "hover:bg-zinc-50 dark:hover:bg-zinc-800"
                      }`}
                    >
                      {d.getUTCDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="flex flex-1 flex-col gap-4">
            <div>
              <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                선택된 날짜 ({selectedDates.length}/{MAX_BULK_PERSONAL_DATES})
              </span>
              {selectedDates.length === 0 ? (
                <p className="rounded-md border border-dashed border-zinc-300 px-3 py-4 text-center text-xs text-zinc-400 dark:border-zinc-700">
                  왼쪽 달력에서 날짜를 선택해주세요.
                </p>
              ) : (
                <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto rounded-md border border-zinc-200 p-2 dark:border-zinc-800">
                  {selectedDates.map((d) => (
                    <span
                      key={d}
                      className="flex items-center gap-1 rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
                    >
                      {d.slice(5)}
                      <button
                        type="button"
                        onClick={() => removeDate(d)}
                        className="text-zinc-400 hover:text-red-600"
                        aria-label={`${d} 선택 해제`}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>

            <div>
              <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                시간대
              </span>
              <div className="flex flex-wrap gap-4">
                {PERSONAL_BLOCK_CHOICES.map((b) => (
                  <label
                    key={b}
                    className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200"
                  >
                    <input
                      type="radio"
                      name="bulkPersonalBlock"
                      checked={personalBlock === b}
                      onChange={() => setPersonalBlock(b)}
                    />
                    {PERSONAL_BLOCK_LABEL[b]}
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-zinc-500">
                &quot;종일&quot;을 선택하면 각 날짜마다 오전/오후/저녁 3개 블록이 함께
                등록됩니다.
              </p>
            </div>

            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                사유 (선택 입력)
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="비워두면 '개인 일정'으로 표시됩니다"
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
              <p className="mt-1 text-xs text-zinc-500">
                선택한 모든 날짜에 동일한 사유가 적용됩니다.
              </p>
            </div>
          </div>
        </div>

        {fieldError && (
          <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {fieldError}
          </p>
        )}

        {overlapWarning && (
          <div className="mt-4 rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <p className="font-medium">⚠ {overlapWarning.message}</p>
            {overlapWarning.conflicts.length > 0 && (
              <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-5">
                {overlapWarning.conflicts.map((c, i) => (
                  <li key={i}>
                    {c.date} · {PERSONAL_BLOCK_LABEL[c.timeBlock]} — {c.title}
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              disabled={submitting}
              onClick={() => submit(true)}
              className="mt-2 rounded-md border border-amber-600 px-3 py-1 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:text-amber-200 dark:hover:bg-amber-900"
            >
              그래도 저장
            </button>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            취소
          </button>
          <button
            type="button"
            disabled={submitting || selectedDates.length === 0}
            onClick={() => submit(false)}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
          >
            {submitting ? "등록 중..." : `${selectedDates.length}개 날짜 일괄 등록`}
          </button>
        </div>
      </div>
    </div>
  );
}
