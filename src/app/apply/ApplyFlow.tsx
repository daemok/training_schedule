"use client";

import { useEffect, useState } from "react";
import { toDateOnly, formatDateOnly } from "@/lib/date";
import { RequestFormModal, RequestFormPayload, SubmitResult } from "./RequestFormModal";
import { Toast } from "@/components/Toast";
import {
  APPLY_BLOCKS as BLOCKS,
  APPLY_BLOCK_LABEL as BLOCK_LABEL,
  type LectureType,
  type InstructorOption,
  type ScheduleRow,
} from "./apply-types";

const TOAST_DURATION_MS = 3000;

export function ApplyFlow({ lectureTypes }: { lectureTypes: LectureType[] }) {
  const [lectureTypeId, setLectureTypeId] = useState<number | "">(lectureTypes[0]?.id ?? "");
  const [date, setDate] = useState(formatDateOnly(new Date()));
  const [instructors, setInstructors] = useState<InstructorOption[]>([]);
  const [schedules, setSchedules] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [requestTarget, setRequestTarget] = useState<{
    instructorId: number;
    instructorName: string;
    timeBlock: ScheduleRow["timeBlock"];
  } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_DURATION_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      if (!lectureTypeId || !date) {
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

        const to = formatDateOnly(new Date(toDateOnly(date).getTime() + 86400000));
        const schedulesRes = await fetch(
          `/api/schedules?from=${date}&to=${to}&instructor=ALL`,
          { signal: controller.signal }
        );
        if (!schedulesRes.ok) throw new Error();
        const rows = (await schedulesRes.json()) as ScheduleRow[];
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
  }, [lectureTypeId, date, refreshKey]);

  function isOccupied(instructorId: number, block: ScheduleRow["timeBlock"]): boolean {
    return schedules.some((s) => s.instructorId === instructorId && s.timeBlock === block);
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
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            강의 유형
          </label>
          <select
            value={lectureTypeId}
            onChange={(e) => setLectureTypeId(Number(e.target.value))}
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
            날짜
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
      </div>

      {loading && <p className="text-sm text-zinc-400">불러오는 중...</p>}
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
          <table className="w-full min-w-[480px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
                <th className="p-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                  강사
                </th>
                {BLOCKS.map((b) => (
                  <th
                    key={b}
                    className="p-2 text-xs font-medium text-zinc-500 dark:text-zinc-400"
                  >
                    {BLOCK_LABEL[b]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {instructors.map((instructor) => (
                <tr key={instructor.id} className="border-b border-zinc-200 dark:border-zinc-800">
                  <td className="p-2 font-medium text-black dark:text-zinc-50">
                    {instructor.name}
                    <span className="ml-1 text-xs text-zinc-500">{instructor.team}</span>
                  </td>
                  {BLOCKS.map((block) => {
                    const occupied = isOccupied(instructor.id, block);
                    return (
                      <td key={block} className="p-2 text-center">
                        {occupied ? (
                          <span className="rounded bg-zinc-100 px-2 py-1 text-xs text-zinc-500 dark:bg-zinc-800">
                            신청 불가
                          </span>
                        ) : (
                          <button
                            onClick={() =>
                              setRequestTarget({
                                instructorId: instructor.id,
                                instructorName: instructor.name,
                                timeBlock: block,
                              })
                            }
                            className="rounded bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700 hover:bg-emerald-200 dark:bg-emerald-950 dark:text-emerald-300"
                          >
                            신청 가능
                          </button>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {requestTarget && lectureTypeId && (
        <RequestFormModal
          instructorId={requestTarget.instructorId}
          instructorName={requestTarget.instructorName}
          lectureTypeId={lectureTypeId}
          date={date}
          timeBlock={requestTarget.timeBlock}
          onCancel={() => setRequestTarget(null)}
          onSubmit={handleRequestSubmit}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
