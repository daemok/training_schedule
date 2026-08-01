"use client";

import { useEffect, useState } from "react";

interface NotificationItem {
  id: number;
  message: string;
  isRead: boolean;
  createdAt: string;
}

/** 팀장 전용 알림 벨 — 강사가 신규 일정을 등록하면 여기로 알림이 쌓인다. */
export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    try {
      const res = await fetch("/api/notifications");
      if (res.ok) {
        setItems(await res.json());
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  const unreadCount = items.filter((i) => !i.isRead).length;

  async function handleMarkAllRead() {
    await fetch("/api/notifications/read-all", { method: "POST" });
    setItems((prev) => prev.map((i) => ({ ...i, isRead: true })));
  }

  function handleToggle() {
    setOpen((o) => {
      const next = !o;
      if (next) load();
      return next;
    });
  }

  return (
    <div className="relative">
      <button
        onClick={handleToggle}
        className="relative rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black dark:border-zinc-700 dark:hover:border-zinc-50"
      >
        알림
        {unreadCount > 0 && (
          <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 z-30 mt-2 w-80 max-w-[90vw] rounded-lg border border-zinc-200 bg-white p-2 shadow-lg dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-sm font-medium text-black dark:text-zinc-50">알림</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-zinc-500 hover:underline"
              >
                모두 읽음
              </button>
            )}
          </div>
          <div className="max-h-72 overflow-y-auto">
            {loading && (
              <p className="px-2 py-3 text-sm text-zinc-500">불러오는 중...</p>
            )}
            {!loading && items.length === 0 && (
              <p className="px-2 py-3 text-sm text-zinc-500">알림이 없습니다.</p>
            )}
            {items.map((n) => (
              <div
                key={n.id}
                className={`rounded-md px-2 py-2 text-sm ${
                  n.isRead
                    ? "text-zinc-500"
                    : "font-medium text-black dark:text-zinc-50"
                }`}
              >
                {n.message}
                <div className="mt-0.5 text-xs text-zinc-400">
                  {new Date(n.createdAt).toLocaleString("ko-KR")}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
