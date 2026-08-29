"use client";

import { useState } from "react";
import { MyRequestsList } from "./MyRequestsList";
import { MyRequestsCalendarView } from "./MyRequestsCalendarView";
import type { MyRequestRow } from "./types";

type ViewMode = "list" | "calendar";

/** 내 신청 내역을 리스트형 또는 캘린더형으로 전환해서 볼 수 있다(기본은 캘린더형). */
export function MyRequestsViewSwitcher({ requests }: { requests: MyRequestRow[] }) {
  const [view, setView] = useState<ViewMode>("calendar");

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
        <MyRequestsList requests={requests} />
      ) : (
        <MyRequestsCalendarView requests={requests} />
      )}
    </div>
  );
}
