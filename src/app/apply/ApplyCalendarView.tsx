"use client";

import { useEffect, useState } from "react";
import { formatDateOnly } from "@/lib/date";
import { buildMonthGridDays, formatMonthTitle, shiftAnchor } from "@/app/calendar/date-utils";
import { RequestFormModal, RequestFormPayload, SubmitResult } from "./RequestFormModal";
import { Toast } from "@/components/Toast";
import {
  APPLY_BLOCKS,
  APPLY_BLOCK_LABEL,
  type ApplyTimeBlock,
  type LectureType,
  type InstructorOption,
  type ScheduleRow,
} from "./apply-types";

interface DatedScheduleRow extends ScheduleRow {
  date: string;
}

interface Props {
  lectureTypes: LectureType[];
}

const WEEKDAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];
const TOAST_DURATION_MS = 3000;

function currentMonthAnchor(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
}

/**
 * 강의 신청 화면의 캘린더형 뷰 — 월 전체를 보여주고, 날짜별로 오전/오후/저녁 블록마다
 * (필터된) 강사 중 신청 가능한 사람이 있는지 표시한다. 칸이 작아 강사 이름 대신 블록
 * 이름만 표시하고, 신청 가능한 강사가 여럿이면 클릭 시 강사 선택 팝업을 먼저 띄운다.
 */
export function ApplyCalendarView({ lectureTypes }: Props) {
  const [lectureTypeId, setLectureTypeId] = useState<number | "">(lectureTypes[0]?.id ?? "");
  const [instructorFilter, setInstructorFilter] = useState<number | "ALL">("ALL");
  const [anchor, setAnchor] = useState(currentMonthAnchor);
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [schedules, setSchedules] = useState<DatedScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pickerTarget, setPickerTarget] = useState<{
    date: string;
    timeBlock: ApplyTimeBlock;
    candidates: InstructorOption[];
  } | null>(null);
  const [requestTarget, setRequestTarget] = useState<{
    instructorId: number;
    instructorName: string;
    date: string;
    timeBlock: ApplyTimeBlock;
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const today = formatDateOnly(new Date());
  const days = buildMonthGridDays(anchor);
  const currentMonth = anchor.getUTCMonth();

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      if (!lectureTypeId) {
        setInstructors([]);
        setSchedules([]);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const instructorsRes = await fetch(`/api/lecture-types/${lectureTypeId}/instructors`, {
          signal: controller.signal,
        });
        if (!instructorsRes.ok) throw new Error();
        const qualifiedInstructors = (await instructorsRes.json()) as InstructorOption[];
        setInstructors(qualifiedInstructors);

        const monthStart = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth(), 1));
        const monthEnd = new Date(Date.UTC(anchor.getUTCFullYear(), anchor.getUTCMonth() + 1, 1));
        const schedulesRes = await fetch(
          `/api/schedules?from=${formatDateOnly(monthStart)}&to=${formatDateOnly(monthEnd)}&instructor=ALL`,
          { signal: controller.signal }
        );
        if (!schedulesRes.ok) throw new Error();
        const rows = (await schedulesRes.json()) as DatedScheduleRow[];
        setSchedules(rows);
      } catch (e) {
        if ((e as Error).name !== "AbortError") {
          setError("정보를 불러오지 못했습니다.");
        }
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [lectureTypeId, anchor, refreshKey]);

  function availableInstructorsFor(dateStr: string, block: ApplyTimeBlock): InstructorOption[] {
    const candidates =
      instructorFilter === "ALL"
        ? instructors
        : instructors.filter((i) => i.id === instructorFilter);
    return candidates.filter(
      (c) =>
        !schedules.some(
          (s) => s.date === dateStr && s.instructorId === c.id && s.timeBlock === block
        )
    );
  }

  function handleBlockClick(dateStr: string, block: ApplyTimeBlock) {
    const available = availableInstructorsFor(dateStr, block);
    if (available.length === 0) return;
    if (available.length === 1) {
      setRequestTarget({
        instructorId: available[0].id,
        instructorName: available[0].name,
        date: dateStr,
        timeBlock: block,
      });
      return;
    }
    setPickerTarget({ date: dateStr, timeBlock: block, candidates: available });
  }

  async function handleRequestSubmit(payload: RequestFormPayload): Promise<SubmitResult> {
    const res = await fetch("/api/lecture-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (res.ok) {
      setRequestTarget(null);
      setRefreshKey((k) => k + 1);
      setToast("강의 신청이 접수되었습니다. 확정 전까지는 '가신청' 상태입니다.");
      return { ok: true };
    }
    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? "신청에 실패했습니다." };
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            강의 유형
          </label>
          <select
            value={lectureTypeId}
            onChange={(e) => {
              // 강의 유형이 바뀌면 이전 유형 기준으로 골랐던 강사 필터는 더 이상 유효하지
              // 않을 수 있으므로 "전체 강사"로 되돌린다.
              setLectureTypeId(Number(e.target.value));
              setInstructorFilter("ALL");
            }}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {lectureTypes.length === 0 && <option value="">등록된 강의 유형이 없습니다</option>}
            {lectureTypes.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            강사 필터
          </label>
          <select
            value={instructorFilter}
            onChange={(e) =>
              setInstructorFilter(e.target.value === "ALL" ? "ALL" : Number(e.target.value))
            }
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            <option value="ALL">전체 강사</option>
            {instructors.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setAnchor((a) => shiftAnchor("month", a, -1))}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
          >
            ← 이전
          </button>
          <button
            type="button"
            onClick={() => setAnchor(currentMonthAnchor())}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
          >
            오늘
          </button>
          <button
            type="button"
            onClick={() => setAnchor((a) => shiftAnchor("month", a, 1))}
            className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
          >
            다음 →
          </button>
          <span className="text-sm font-medium text-black dark:text-zinc-50">
            {formatMonthTitle(anchor)}
          </span>
          {loading && <span className="text-xs text-zinc-400">불러오는 중...</span>}
        </div>
      </div>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {!loading && lectureTypeId && instructors.length === 0 && (
        <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
          이 강의 유형을 가르칠 수 있는 강사가 없습니다.
        </p>
      )}

      {instructors.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <div className="min-w-[700px]">
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
                return (
                  <div
                    key={dateStr}
                    className={`min-h-[112px] border-b border-r border-zinc-200 p-1.5 dark:border-zinc-800 ${
                      inMonth ? "" : "bg-zinc-50/60 dark:bg-zinc-950/40"
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
                    {inMonth && (
                      <div className="flex flex-col gap-0.5">
                        {APPLY_BLOCKS.map((block) => {
                          const available = availableInstructorsFor(dateStr, block);
                          const isAvailable = available.length > 0;
                          return (
                            <button
                              key={block}
                              type="button"
                              disabled={!isAvailable}
                              onClick={() => handleBlockClick(dateStr, block)}
                              title={
                                isAvailable
                                  ? available.map((i) => i.name).join(", ")
                                  : undefined
                              }
                              className={`w-full rounded px-1 py-0.5 text-left text-[11px] font-medium ${
                                isAvailable
                                  ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                                  : "bg-zinc-100 text-zinc-400 dark:bg-zinc-800 dark:text-zinc-600"
                              }`}
                            >
                              {APPLY_BLOCK_LABEL[block]}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {pickerTarget && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-xs rounded-xl bg-white p-5 shadow-xl dark:bg-zinc-900">
            <h2 className="mb-1 text-base font-semibold text-black dark:text-zinc-50">강사 선택</h2>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              {pickerTarget.date} · {APPLY_BLOCK_LABEL[pickerTarget.timeBlock]}에 신청 가능한
              강사입니다.
            </p>
            <div className="flex flex-col gap-2">
              {pickerTarget.candidates.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => {
                    setRequestTarget({
                      instructorId: c.id,
                      instructorName: c.name,
                      date: pickerTarget.date,
                      timeBlock: pickerTarget.timeBlock,
                    });
                    setPickerTarget(null);
                  }}
                  className="rounded-md border border-zinc-300 px-3 py-2 text-left text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
                >
                  {c.name}
                  <span className="ml-1 text-xs text-zinc-500">{c.team}</span>
                </button>
              ))}
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setPickerTarget(null)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              >
                취소
              </button>
            </div>
          </div>
        </div>
      )}

      {requestTarget && lectureTypeId && (
        <RequestFormModal
          instructorId={requestTarget.instructorId}
          instructorName={requestTarget.instructorName}
          lectureTypeId={lectureTypeId}
          date={requestTarget.date}
          timeBlock={requestTarget.timeBlock}
          onCancel={() => setRequestTarget(null)}
          onSubmit={handleRequestSubmit}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
