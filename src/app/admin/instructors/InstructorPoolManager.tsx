"use client";

import { useState } from "react";

interface InstructorOption {
  id: number;
  name: string;
  team: string;
  status: "ACTIVE" | "INACTIVE";
}

interface LectureType {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
}

interface Props {
  instructors: InstructorOption[];
  lectureTypes: LectureType[];
  assignmentsByInstructor: Record<string, number[]>;
}

export function InstructorPoolManager({
  instructors,
  lectureTypes: initialLectureTypes,
  assignmentsByInstructor: initialAssignments,
}: Props) {
  const [lectureTypes, setLectureTypes] = useState(initialLectureTypes);
  const [assignments, setAssignments] = useState<Record<string, number[]>>(initialAssignments);
  const [savingInstructorId, setSavingInstructorId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDescription, setNewTypeDescription] = useState("");
  const [creatingType, setCreatingType] = useState(false);

  async function handleCreateLectureType() {
    if (!newTypeName.trim()) return;
    setCreatingType(true);
    setError(null);
    const res = await fetch("/api/lecture-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newTypeName.trim(), description: newTypeDescription.trim() }),
    });
    setCreatingType(false);
    if (res.ok) {
      const created = (await res.json()) as LectureType;
      setLectureTypes((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTypeName("");
      setNewTypeDescription("");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "강의 유형 생성에 실패했습니다.");
  }

  async function toggleLectureTypeActive(lectureType: LectureType) {
    const res = await fetch(`/api/lecture-types/${lectureType.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !lectureType.isActive }),
    });
    if (res.ok) {
      const updated = (await res.json()) as LectureType;
      setLectureTypes((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    }
  }

  function toggleAssignment(instructorId: number, lectureTypeId: number) {
    setAssignments((prev) => {
      const current = prev[instructorId] ?? [];
      const next = current.includes(lectureTypeId)
        ? current.filter((id) => id !== lectureTypeId)
        : [...current, lectureTypeId];
      return { ...prev, [instructorId]: next };
    });
  }

  async function saveInstructor(instructorId: number) {
    setSavingInstructorId(instructorId);
    setError(null);
    const res = await fetch(`/api/instructors/${instructorId}/lecture-types`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lectureTypeIds: assignments[instructorId] ?? [] }),
    });
    setSavingInstructorId(null);
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "저장에 실패했습니다.");
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">강의 유형</h2>
        <div className="flex flex-col gap-2">
          {lectureTypes.length === 0 && (
            <p className="text-sm text-zinc-500">등록된 강의 유형이 없습니다.</p>
          )}
          {lectureTypes.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 dark:border-zinc-800"
            >
              <div>
                <span className="font-medium text-black dark:text-zinc-50">{t.name}</span>
                {t.description && (
                  <span className="ml-2 text-sm text-zinc-500">{t.description}</span>
                )}
                {!t.isActive && (
                  <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                    비활성
                  </span>
                )}
              </div>
              <button
                onClick={() => toggleLectureTypeActive(t)}
                className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
              >
                {t.isActive ? "비활성화" : "활성화"}
              </button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700 sm:flex-row sm:items-end">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              새 강의 유형 이름
            </label>
            <input
              value={newTypeName}
              onChange={(e) => setNewTypeName(e.target.value)}
              placeholder="예: 리더십 교육"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              설명 (선택)
            </label>
            <input
              value={newTypeDescription}
              onChange={(e) => setNewTypeDescription(e.target.value)}
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <button
            onClick={handleCreateLectureType}
            disabled={creatingType || !newTypeName.trim()}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
          >
            {creatingType ? "추가 중..." : "추가"}
          </button>
        </div>
      </section>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">강사별 강의 유형 배정</h2>
        {instructors.map((instructor) => {
          const assigned = assignments[instructor.id] ?? [];
          return (
            <div
              key={instructor.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <span className="font-medium text-black dark:text-zinc-50">
                    {instructor.name}
                  </span>
                  <span className="ml-2 text-sm text-zinc-500">{instructor.team}</span>
                  {instructor.status === "INACTIVE" && (
                    <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                      비활성 강사
                    </span>
                  )}
                </div>
                <button
                  onClick={() => saveInstructor(instructor.id)}
                  disabled={savingInstructorId === instructor.id}
                  className="rounded-full border border-zinc-300 px-3 py-1.5 text-sm hover:border-black disabled:opacity-50 dark:border-zinc-700 dark:hover:border-zinc-50"
                >
                  {savingInstructorId === instructor.id ? "저장 중..." : "저장"}
                </button>
              </div>
              <div className="flex flex-wrap gap-4">
                {lectureTypes.map((t) => (
                  <label
                    key={t.id}
                    className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200"
                  >
                    <input
                      type="checkbox"
                      checked={assigned.includes(t.id)}
                      onChange={() => toggleAssignment(instructor.id, t.id)}
                    />
                    {t.name}
                  </label>
                ))}
                {lectureTypes.length === 0 && (
                  <p className="text-sm text-zinc-500">먼저 강의 유형을 추가해주세요.</p>
                )}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
