"use client";

import { useState, type FormEvent } from "react";
import {
  ScheduleDTO,
  ScheduleType,
  TimeBlock,
  TIME_BLOCK_LABEL,
} from "./types";
import { PERSONAL_TITLE_PLACEHOLDER } from "@/lib/access-control";
import { ALL_DAY_BLOCKS } from "@/lib/schedule-all-day";
import { LoadingOverlay } from "@/components/LoadingOverlay";
import type { PersonalBlockChoice } from "./personal-block";
import { PERSONAL_BLOCK_LABEL } from "./personal-block";

export interface ScheduleFormPayload {
  scheduleType: ScheduleType;
  date: string;
  /** LECTURE 및 개인일정(단일 블록)은 원소 1개, 개인일정 "종일"은 3개(오전/오후/저녁). */
  timeBlocks: TimeBlock[];
  startTime?: string; // LECTURE만 사용
  endTime?: string;
  title: string;
  location: string;
}

export interface ConflictInfo {
  title: string;
  startTime: string | null;
  endTime: string | null;
}

export type SubmitResult =
  | { ok: true }
  | { ok: false; error: string; overlap?: boolean; conflicts?: ConflictInfo[] };

interface Props {
  initial: ScheduleDTO | null;
  /** 캘린더형 화면에서 빈 블록 클릭으로 열었을 때 미리 채워줄 값(등록 모드에서만 사용). */
  presetDate?: string;
  presetTimeBlock?: TimeBlock;
  onCancel: () => void;
  onSubmit: (payload: ScheduleFormPayload, force: boolean) => Promise<SubmitResult>;
}

const LECTURE_TIME_BLOCKS: TimeBlock[] = ["MORNING", "AFTERNOON", "EVENING"];

export function ScheduleFormModal({
  initial,
  presetDate,
  presetTimeBlock,
  onCancel,
  onSubmit,
}: Props) {
  const [scheduleType, setScheduleType] = useState<ScheduleType>(
    initial?.scheduleType ?? "LECTURE"
  );
  const [date, setDate] = useState(initial?.date ?? presetDate ?? "");
  const [timeBlock, setTimeBlock] = useState<TimeBlock | "">(
    initial?.timeBlock ?? presetTimeBlock ?? ""
  );
  const [personalBlock, setPersonalBlock] = useState<PersonalBlockChoice | "">(
    initial?.timeBlock ?? presetTimeBlock ?? ""
  );
  const [startTime, setStartTime] = useState(initial?.startTime ?? "");
  const [endTime, setEndTime] = useState(initial?.endTime ?? "");
  const [title, setTitle] = useState(() => {
    if (!initial) return "";
    if (initial.scheduleType === "PERSONAL" && initial.title === PERSONAL_TITLE_PLACEHOLDER) {
      return "";
    }
    return initial.title;
  });
  const [location, setLocation] = useState(initial?.location ?? "");

  const [fieldError, setFieldError] = useState<string | null>(null);
  const [overlapWarning, setOverlapWarning] = useState<{
    message: string;
    conflicts: ConflictInfo[];
  } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function validateClientSide(): string | null {
    if (!date) return "날짜를 선택해주세요.";
    if (scheduleType === "LECTURE") {
      if (!timeBlock) return "시간대(오전/오후/저녁)를 선택해주세요.";
      if (!startTime) return "시작 시각을 선택해주세요.";
      if (!endTime) return "종료 시각을 선택해주세요.";
      if (endTime <= startTime) return "종료 시각은 시작 시각보다 늦어야 합니다.";
      if (!title.trim()) return "강의명을 입력해주세요.";
    } else {
      if (!personalBlock) return "시간대(종일/오전/오후/저녁)를 선택해주세요.";
    }
    return null;
  }

  async function submit(force: boolean) {
    const clientError = validateClientSide();
    if (clientError) {
      setFieldError(clientError);
      setOverlapWarning(null);
      return;
    }
    setFieldError(null);
    setSubmitting(true);

    const timeBlocks: TimeBlock[] =
      scheduleType === "LECTURE"
        ? [timeBlock as TimeBlock]
        : personalBlock === "ALL_DAY"
          ? ALL_DAY_BLOCKS
          : [personalBlock as TimeBlock];

    const result = await onSubmit(
      {
        scheduleType,
        date,
        timeBlocks,
        startTime: scheduleType === "LECTURE" ? startTime : undefined,
        endTime: scheduleType === "LECTURE" ? endTime : undefined,
        title,
        location,
      },
      force
    );

    setSubmitting(false);

    if (result.ok) {
      setOverlapWarning(null);
      return;
    }

    if (result.overlap) {
      setOverlapWarning({ message: result.error, conflicts: result.conflicts ?? [] });
      return;
    }

    setOverlapWarning(null);
    setFieldError(result.error);
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    submit(false);
  }

  const personalBlockOptions: PersonalBlockChoice[] = initial
    ? ["MORNING", "AFTERNOON", "EVENING"]
    : ["ALL_DAY", "MORNING", "AFTERNOON", "EVENING"];

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="relative max-h-full w-full max-w-lg overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        {submitting && <LoadingOverlay label="저장 중..." />}
        <h2 className="mb-4 text-lg font-semibold text-black dark:text-zinc-50">
          {initial ? "일정 수정" : "새 일정 등록"}
        </h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div>
            <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              일정 유형
            </span>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === "LECTURE"}
                  onChange={() => setScheduleType("LECTURE")}
                />
                강의
              </label>
              <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                <input
                  type="radio"
                  name="scheduleType"
                  checked={scheduleType === "PERSONAL"}
                  onChange={() => setScheduleType("PERSONAL")}
                />
                개인일정
              </label>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              날짜
            </label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>

          {scheduleType === "LECTURE" ? (
            <>
              <div>
                <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  시간대
                </span>
                <div className="flex gap-4">
                  {LECTURE_TIME_BLOCKS.map((tb) => (
                    <label
                      key={tb}
                      className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200"
                    >
                      <input
                        type="radio"
                        name="timeBlock"
                        checked={timeBlock === tb}
                        onChange={() => setTimeBlock(tb)}
                      />
                      {TIME_BLOCK_LABEL[tb]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    시작 시각
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
                <div className="flex-1">
                  <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    종료 시각
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  강의명
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: React 기초반 강의"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  장소
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="오프라인 강의실명 또는 온라인 링크"
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
            </>
          ) : (
            <>
              <div>
                <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  시간대
                </span>
                <div className="flex flex-wrap gap-4">
                  {personalBlockOptions.map((b) => (
                    <label
                      key={b}
                      className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200"
                    >
                      <input
                        type="radio"
                        name="personalBlock"
                        checked={personalBlock === b}
                        onChange={() => setPersonalBlock(b)}
                      />
                      {PERSONAL_BLOCK_LABEL[b]}
                    </label>
                  ))}
                </div>
                <p className="mt-1 text-xs text-zinc-500">
                  개인일정은 시간을 입력하지 않고 블록 단위로 등록됩니다.
                  {!initial && " \"종일\"을 선택하면 오전/오후/저녁 3개 블록이 함께 등록됩니다."}
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
                  팀장/매니저 화면에는 사유와 무관하게 &quot;개인 일정&quot;으로만 표시됩니다.
                </p>
              </div>
            </>
          )}

          {fieldError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
              {fieldError}
            </p>
          )}

          {overlapWarning && (
            <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <p className="font-medium">⚠ {overlapWarning.message}</p>
              {overlapWarning.conflicts.length > 0 && (
                <ul className="mt-1 list-disc pl-5">
                  {overlapWarning.conflicts.map((c, i) => (
                    <li key={i}>
                      {c.title} ({c.startTime && c.endTime ? `${c.startTime} ~ ${c.endTime}` : "종일"})
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

          <div className="mt-2 flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
            >
              취소
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
            >
              {submitting ? "저장 중..." : "저장"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
