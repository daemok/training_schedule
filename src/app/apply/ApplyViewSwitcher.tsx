"use client";

import { useState } from "react";
import { ApplyFlow } from "./ApplyFlow";
import { ApplyCalendarView } from "./ApplyCalendarView";
import type { LectureType } from "./apply-types";

type ViewMode = "list" | "calendar";

/** 강의 신청 화면을 리스트형(날짜 하나씩) 또는 캘린더형(월 전체)으로 전환해서 볼 수 있다. */
export function ApplyViewSwitcher({ lectureTypes }: { lectureTypes: LectureType[] }) {
  const [view, setView] = useState<ViewMode>("list");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex overflow-hidden self-start rounded-full border border-zinc-300 dark:border-zinc-700">
        <button
          onClick={() => setView("list")}
          className={`px-3 py-1.5 text-sm ${
            view === "list"
              ? "bg-black text-white dark:bg-zinc-50 dark:text-black"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          리스트형
        </button>
        <button
          onClick={() => setView("calendar")}
          className={`px-3 py-1.5 text-sm ${
            view === "calendar"
              ? "bg-black text-white dark:bg-zinc-50 dark:text-black"
              : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          }`}
        >
          캘린더형
        </button>
      </div>

      {view === "list" ? (
        <ApplyFlow lectureTypes={lectureTypes} />
      ) : (
        <ApplyCalendarView lectureTypes={lectureTypes} />
      )}
    </div>
  );
}
