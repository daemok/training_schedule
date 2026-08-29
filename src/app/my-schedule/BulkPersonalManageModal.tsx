"use client";

import { useEffect, useState } from "react";
import {
  buildMonthGridDays,
  formatMonthTitle,
  shiftAnchor,
  nextMonthAnchor,
} from "@/app/calendar/date-utils";
import { formatDateOnly } from "@/lib/date";
import type { BulkConflictInfo, BulkEditResult, BulkDeleteResult } from "@/lib/schedule-bulk";
import type { ScheduleDTO, TimeBlock } from "./types";
import { TIME_BLOCK_LABEL } from "./types";

export interface BulkEditPayload {
  ids: number[];
  title?: string;
  location?: string;
  personalBlock?: TimeBlock;
}

interface Props {
  onCancel: () => void;
  onDeleteSubmit: (ids: number[]) => Promise<BulkDeleteResult>;
  onEditSubmit: (payload: BulkEditPayload, force: boolean) => Promise<BulkEditResult>;
}

const WEEKDAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];
const EDIT_BLOCK_CHOICES: TimeBlock[] = ["MORNING", "AFTERNOON", "EVENING"];

/**
 * 강사 본인의 기존 개인일정을 여러 건 선택해 한 번에 삭제하거나(사유/장소/시간대) 수정하는
 * 모달 — BulkPersonalScheduleModal(일괄 "등록")과 짝을 이루는 일괄 "관리" 모달이다.
 * 표시 월의 본인 개인일정을 GET /api/my/schedules?year=&month=로 자체적으로 불러온 뒤,
 * 항목을 토글 선택해 삭제 또는 수정을 적용한다. 실제 API 호출(fetch)은 onDeleteSubmit/
 * onEditSubmit prop을 통해 부모(ScheduleManager/ScheduleCalendarView)가 담당한다 —
 * 다른 폼 모달들과 동일한 위임 패턴.
 */
export function BulkPersonalManageModal({ onCancel, onDeleteSubmit, onEditSubmit }: Props) {
  // 최초 진입 시에는 다음 달을 기본으로 보여준다.
  const [anchor, setAnchor] = useState(() => nextMonthAnchor());
  const [refreshKey, setRefreshKey] = useState(0);
  const [schedules, setSchedules] = useState<ScheduleDTO[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [mode, setMode] = useState<"delete" | "edit" | null>(null);

  const [editTitle, setEditTitle] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editBlock, setEditBlock] = useState<TimeBlock | "">("");
  const [overlapWarning, setOverlapWarning] = useState<{
    message: string;
    conflicts: BulkConflictInfo[];
  } | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [resultMessage, setResultMessage] = useState<string | null>(null);

  const today = formatDateOnly(new Date());
  const days = buildMonthGridDays(anchor);
  const currentMonth = anchor.getUTCMonth();

  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      setLoading(true);
      setLoadError(null);
      try {
        const res = await fetch(
          `/api/my/schedules?year=${anchor.getUTCFullYear()}&month=${anchor.getUTCMonth() + 1}`,
          { signal: controller.signal }
        );
        if (!res.ok) throw new Error("불러오지 못했습니다.");
        const data = (await res.json()) as ScheduleDTO[];
        setSchedules(data.filter((s) => s.scheduleType === "PERSONAL"));
      } catch (e) {
        if ((e as Error).name !== "AbortError") setLoadError("일정을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    }
    load();
    return () => controller.abort();
  }, [anchor, refreshKey]);

  const byDate = new Map<string, ScheduleDTO[]>();
  for (const s of schedules) {
    const list = byDate.get(s.date) ?? [];
    list.push(s);
    byDate.set(s.date, list);
  }

  function toggleSelect(id: number) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((v) => v !== id) : [...prev, id]));
  }

  function openDelete() {
    setMode("delete");
    setActionError(null);
    setResultMessage(null);
  }
  function openEdit() {
    setMode("edit");
    setEditTitle("");
    setEditLocation("");
    setEditBlock("");
    setOverlapWarning(null);
    setActionError(null);
    setResultMessage(null);
  }

  async function submitDelete() {
    setSubmitting(true);
    setActionError(null);
    const result = await onDeleteSubmit(selectedIds);
    setSubmitting(false);
    if (result.ok) {
      setResultMessage(`${result.deletedCount}건 삭제되었습니다.`);
      setSelectedIds([]);
      setMode(null);
      setRefreshKey((k) => k + 1);
      return;
    }
    setActionError(result.error);
  }

  async function submitEdit(force: boolean) {
    if (!editTitle.trim() && !editLocation.trim() && !editBlock) {
      setActionError("변경할 값을 1개 이상 입력해주세요.");
      return;
    }
    setSubmitting(true);
    setActionError(null);
    const result = await onEditSubmit(
      {
        ids: selectedIds,
        title: editTitle.trim() || undefined,
        location: editLocation.trim() || undefined,
        personalBlock: editBlock || undefined,
      },
      force
    );
    setSubmitting(false);
    if (result.ok) {
      setOverlapWarning(null);
      setResultMessage(`${result.updatedCount}건 수정되었습니다.`);
      setSelectedIds([]);
      setMode(null);
      setRefreshKey((k) => k + 1);
      return;
    }
    if (result.overlap) {
      setOverlapWarning({ message: result.error, conflicts: result.conflicts ?? [] });
      return;
    }
    setOverlapWarning(null);
    setActionError(result.error);
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4 py-8">
      <div className="max-h-full w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
        <h2 className="mb-1 text-lg font-semibold text-black dark:text-zinc-50">
          개인일정 일괄 관리
        </h2>
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          기존에 등록된 개인일정 여러 건을 선택해 한 번에 삭제하거나 사유/장소/시간대를
          수정할 수 있습니다.
        </p>

        <div className="mb-3 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setAnchor((a) => shiftAnchor("month", a, -1))}
            className="rounded-full border border-zinc-300 px-2 py-1 text-xs hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
          >
            ← 이전
          </button>
          <span className="text-base font-semibold text-black dark:text-zinc-50">
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

        {loading && <p className="mb-2 text-xs text-zinc-400">불러오는 중...</p>}
        {loadError && (
          <p className="mb-2 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {loadError}
          </p>
        )}

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
              const dayItems = byDate.get(dateStr) ?? [];
              return (
                <div
                  key={dateStr}
                  className={`min-h-[76px] border-b border-r border-zinc-200 p-1 dark:border-zinc-800 ${
                    inMonth ? "" : "bg-zinc-50/60 dark:bg-zinc-950/40"
                  }`}
                >
                  <div
                    className={`mb-1 inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] ${
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
                    {dayItems.map((s) => {
                      const isSelected = selectedIds.includes(s.id);
                      return (
                        <button
                          type="button"
                          key={s.id}
                          onClick={() => toggleSelect(s.id)}
                          title={`${TIME_BLOCK_LABEL[s.timeBlock]} · ${s.title}`}
                          className={`truncate rounded px-1 py-0.5 text-left text-[10px] ${
                            isSelected
                              ? "bg-black text-white dark:bg-zinc-50 dark:text-black"
                              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-200 dark:hover:bg-zinc-700"
                          }`}
                        >
                          {TIME_BLOCK_LABEL[s.timeBlock]} {s.title}
                        </button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <span className="text-sm text-zinc-600 dark:text-zinc-300">
            {selectedIds.length}건 선택됨
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={openEdit}
              className="rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:border-black disabled:opacity-50 dark:border-zinc-700 dark:hover:border-zinc-50"
            >
              선택 항목 일괄 수정
            </button>
            <button
              type="button"
              disabled={selectedIds.length === 0}
              onClick={openDelete}
              className="rounded-full border border-red-300 px-4 py-1.5 text-sm text-red-600 hover:border-red-600 disabled:opacity-50 dark:border-red-900"
            >
              선택 삭제
            </button>
          </div>
        </div>

        {resultMessage && (
          <p className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
            {resultMessage}
          </p>
        )}

        {mode === "delete" && (
          <div className="mt-4 rounded-lg border border-red-200 p-4 dark:border-red-900">
            <p className="mb-3 text-sm text-zinc-700 dark:text-zinc-300">
              선택한 {selectedIds.length}건의 개인일정을 삭제할까요? 이 작업은 되돌릴 수
              없습니다.
            </p>
            {actionError && (
              <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {actionError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMode(null)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              >
                취소
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={submitDelete}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {submitting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        )}

        {mode === "edit" && (
          <div className="mt-4 flex flex-col gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
            <p className="text-sm text-zinc-600 dark:text-zinc-300">
              선택한 {selectedIds.length}건 모두에 아래 값이 동일하게 적용됩니다(비워두면
              해당 항목은 변경하지 않음).
            </p>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                사유
              </label>
              <input
                type="text"
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                장소
              </label>
              <input
                type="text"
                value={editLocation}
                onChange={(e) => setEditLocation(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div>
              <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                시간대 (선택 시 전부 이 블록으로 변경)
              </span>
              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                  <input
                    type="radio"
                    name="bulkEditBlock"
                    checked={editBlock === ""}
                    onChange={() => setEditBlock("")}
                  />
                  변경 안 함
                </label>
                {EDIT_BLOCK_CHOICES.map((b) => (
                  <label
                    key={b}
                    className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200"
                  >
                    <input
                      type="radio"
                      name="bulkEditBlock"
                      checked={editBlock === b}
                      onChange={() => setEditBlock(b)}
                    />
                    {TIME_BLOCK_LABEL[b]}
                  </label>
                ))}
              </div>
            </div>

            {actionError && (
              <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {actionError}
              </p>
            )}

            {overlapWarning && (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <p className="font-medium">⚠ {overlapWarning.message}</p>
                {overlapWarning.conflicts.length > 0 && (
                  <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-5">
                    {overlapWarning.conflicts.map((c, i) => (
                      <li key={i}>
                        {c.date} · {TIME_BLOCK_LABEL[c.timeBlock]} — {c.title}
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => submitEdit(true)}
                  className="mt-2 rounded-md border border-amber-600 px-3 py-1 text-sm font-medium text-amber-800 hover:bg-amber-100 disabled:opacity-50 dark:text-amber-200 dark:hover:bg-amber-900"
                >
                  그래도 저장
                </button>
              </div>
            )}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMode(null)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              >
                취소
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => submitEdit(false)}
                className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
              >
                {submitting ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        )}

        <div className="mt-4 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
          >
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
