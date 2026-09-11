"use client";

import {
  CalendarScheduleDTO,
  TIME_BLOCK_LABEL,
  SCHEDULE_TYPE_LABEL,
} from "./types";
import { PERSONAL_TITLE_PLACEHOLDER } from "@/lib/access-control";
import { LoadingOverlay } from "@/components/LoadingOverlay";

interface Props {
  schedule: CalendarScheduleDTO;
  onClose: () => void;
  /** true면 팀장/매니저 등 상급자 뷰 — 수정/삭제 버튼을 보여준다. */
  canManage?: boolean;
  onEdit?: (schedule: CalendarScheduleDTO) => void;
  onDelete?: (schedule: CalendarScheduleDTO) => void;
  /** true면 이 미확정 건에 대해 확정/거절 버튼을 보여준다(대상 강사 본인 또는 팀장/매니저). */
  canDecideLectureRequest?: boolean;
  onConfirmLectureRequest?: (schedule: CalendarScheduleDTO) => void;
  onRejectLectureRequest?: (schedule: CalendarScheduleDTO) => void;
  decisionSubmitting?: boolean;
}

export function DetailPanel({
  schedule,
  onClose,
  canManage,
  onEdit,
  onDelete,
  canDecideLectureRequest,
  onConfirmLectureRequest,
  onRejectLectureRequest,
  decisionSubmitting,
}: Props) {
  return (
    <div
      className="fixed inset-0 z-40 flex justify-end bg-black/30"
      onClick={onClose}
    >
      <div
        className="relative h-full w-full max-w-sm overflow-y-auto bg-white p-6 shadow-xl dark:bg-zinc-900"
        onClick={(e) => e.stopPropagation()}
      >
        {decisionSubmitting && <LoadingOverlay label="처리 중..." />}
        <div className="mb-4 flex items-start justify-between">
          <div className="flex items-center gap-2">
            <span
              className={`rounded px-2 py-0.5 text-xs font-medium ${
                schedule.scheduleType === "LECTURE"
                  ? "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300"
                  : "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300"
              }`}
            >
              {SCHEDULE_TYPE_LABEL[schedule.scheduleType]}
            </span>
            {schedule.status === "PROVISIONAL" && (
              <span className="rounded bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700 dark:bg-rose-950 dark:text-rose-300">
                미확정
              </span>
            )}
            {schedule.lectureRequest?.dailyPriority != null && (
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-zinc-50 dark:text-black">
                {schedule.lectureRequest.dailyPriority}번째
              </span>
            )}
          </div>
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-xl leading-none text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            ×
          </button>
        </div>

        <h2 className="mb-6 text-lg font-semibold text-black dark:text-zinc-50">
          {schedule.title}
        </h2>

        <dl className="flex flex-col gap-4 text-sm">
          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">등록 강사</dt>
            <dd className="mt-0.5 font-medium text-black dark:text-zinc-50">
              {schedule.instructorName}
            </dd>
          </div>

          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">날짜 · 시간대</dt>
            <dd className="mt-0.5 font-medium text-black dark:text-zinc-50">
              {schedule.date} · {TIME_BLOCK_LABEL[schedule.timeBlock]}
            </dd>
          </div>

          <div>
            <dt className="text-zinc-500 dark:text-zinc-400">시작 ~ 종료</dt>
            <dd className="mt-0.5 font-medium text-black dark:text-zinc-50">
              {schedule.startTime && schedule.endTime
                ? `${schedule.startTime} ~ ${schedule.endTime}`
                : "종일 (해당 시간대 전체)"}
            </dd>
          </div>

          {schedule.location && (
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">장소</dt>
              <dd className="mt-0.5 font-medium text-black dark:text-zinc-50">
                {schedule.location}
              </dd>
            </div>
          )}

          {schedule.memo && (
            <div>
              <dt className="text-zinc-500 dark:text-zinc-400">메모</dt>
              <dd className="mt-0.5 text-black dark:text-zinc-50">{schedule.memo}</dd>
            </div>
          )}

          {schedule.lectureRequest && (
            <>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">신청자</dt>
                <dd className="mt-0.5 font-medium text-black dark:text-zinc-50">
                  {schedule.lectureRequest.requesterName} ({schedule.lectureRequest.requesterEmail})
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">FC/LOS · 참석 인원</dt>
                <dd className="mt-0.5 font-medium text-black dark:text-zinc-50">
                  {schedule.lectureRequest.fcLos} · {schedule.lectureRequest.attendeeCount}명
                </dd>
              </div>
              <div>
                <dt className="text-zinc-500 dark:text-zinc-400">강의 요청 목적</dt>
                <dd className="mt-0.5 text-black dark:text-zinc-50">{schedule.lectureRequest.content}</dd>
              </div>
            </>
          )}
        </dl>

        {schedule.scheduleType === "PERSONAL" && schedule.title === PERSONAL_TITLE_PLACEHOLDER && (
          <p className="mt-6 rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400">
            개인일정의 상세 사유는 본인 또는 팀장/매니저에게만 공개되며, 그 외에는 &quot;개인
            일정&quot;으로만 표시됩니다.
          </p>
        )}

        {canDecideLectureRequest && schedule.lectureRequest && (
          <div className="mt-6 flex justify-end gap-2 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
            <button
              onClick={() => onRejectLectureRequest?.(schedule)}
              disabled={decisionSubmitting}
              className="rounded-full border border-zinc-300 px-4 py-1.5 hover:border-black disabled:opacity-50 dark:border-zinc-700 dark:hover:border-zinc-50"
            >
              거절
            </button>
            <button
              onClick={() => onConfirmLectureRequest?.(schedule)}
              disabled={decisionSubmitting}
              className="rounded-full bg-black px-4 py-1.5 font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
            >
              확정
            </button>
          </div>
        )}

        {canManage && (
          <div className="mt-6 flex justify-end gap-4 border-t border-zinc-200 pt-4 text-sm dark:border-zinc-800">
            <button
              onClick={() => onEdit?.(schedule)}
              className="text-zinc-600 hover:underline dark:text-zinc-300"
            >
              수정
            </button>
            <button onClick={() => onDelete?.(schedule)} className="text-red-600 hover:underline">
              삭제
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
