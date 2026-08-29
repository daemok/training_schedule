import { TIME_BLOCK_LABEL } from "@/lib/schedule-labels";
import { STATUS_LABEL, STATUS_BADGE_CLASS, type MyRequestRow } from "./types";

/** 내 신청 내역 리스트형 — 기존 apply/my/page.tsx의 <ul> 마크업을 그대로 옮긴 것. */
export function MyRequestsList({ requests }: { requests: MyRequestRow[] }) {
  if (requests.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-zinc-300 p-8 text-center text-sm text-zinc-500 dark:border-zinc-700">
        신청한 강의가 없습니다.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {requests.map((r) => (
        <li
          key={r.id}
          className="flex flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2 font-medium text-black dark:text-zinc-50">
              <span className="rounded-full bg-zinc-900 px-2 py-0.5 text-xs font-semibold text-white dark:bg-zinc-50 dark:text-black">
                {r.date} {TIME_BLOCK_LABEL[r.timeBlock]} {r.queuePosition}번째
              </span>
              {r.lectureTypeName} · {r.instructorName} 강사
            </span>
            <span className={`rounded px-2 py-0.5 text-xs font-medium ${STATUS_BADGE_CLASS[r.status]}`}>
              {STATUS_LABEL[r.status]}
            </span>
          </div>
          <div className="text-sm text-zinc-500 dark:text-zinc-400">
            {r.date} · {TIME_BLOCK_LABEL[r.timeBlock]} · {r.startTime}~{r.endTime}
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">
            장소: {r.location} · 참석인원: {r.attendeeCount}명 · FC/LOS: {r.fcLos}
          </div>
          <div className="text-sm text-zinc-600 dark:text-zinc-300">{r.content}</div>
          {r.status === "REJECTED" && r.rejectionReason && (
            <div className="rounded-md bg-zinc-50 px-3 py-2 text-sm text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
              거절 사유: {r.rejectionReason}
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
