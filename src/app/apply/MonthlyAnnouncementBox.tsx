"use client";

import { useState } from "react";

const MAX_LENGTH = 1000;

interface Props {
  initialContent: string;
  canManage: boolean;
}

/** 강의 신청 화면 왼쪽에 노출되는 "이달의 교육 프로그램 안내" 박스. 팀장/매니저만 수정할 수 있다. */
export function MonthlyAnnouncementBox({ initialContent, canManage }: Props) {
  const [content, setContent] = useState(initialContent);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(initialContent);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startEditing() {
    setDraft(content);
    setError(null);
    setEditing(true);
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/monthly-announcement", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: draft }),
    });
    setSaving(false);
    if (res.ok) {
      const data = (await res.json()) as { content: string };
      setContent(data.content);
      setEditing(false);
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "저장에 실패했습니다.");
  }

  return (
    <div className="flex h-fit flex-col gap-2 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800 lg:sticky lg:top-6">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-black dark:text-zinc-50">
          이달의 교육 프로그램 안내
        </h2>
        {canManage && !editing && (
          <button
            onClick={startEditing}
            className="text-xs text-zinc-500 hover:underline dark:text-zinc-400"
          >
            수정
          </button>
        )}
      </div>

      {editing ? (
        <div className="flex flex-col gap-2">
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, MAX_LENGTH))}
            rows={12}
            maxLength={MAX_LENGTH}
            placeholder="이번 달 교육 프로그램에 대한 안내를 입력해주세요."
            className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-zinc-400">
              {draft.length} / {MAX_LENGTH}자
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setEditing(false)}
                className="rounded-full border border-zinc-300 px-3 py-1 text-xs dark:border-zinc-700"
              >
                취소
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-full bg-black px-3 py-1 text-xs font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}
        </div>
      ) : content ? (
        <p className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">{content}</p>
      ) : (
        <p className="text-sm text-zinc-400">
          등록된 안내가 없습니다.{canManage ? " '수정'을 눌러 작성해주세요." : ""}
        </p>
      )}
    </div>
  );
}
