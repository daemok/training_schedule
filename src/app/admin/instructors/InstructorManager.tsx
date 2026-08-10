"use client";

import { useState } from "react";
import { InstructorFormModal, InstructorOption, BrandOption, SubmitResult } from "./InstructorFormModal";
import { Toast } from "@/components/Toast";

interface LectureBrand {
  id: number;
  name: string;
  isActive: boolean;
}

interface LectureType {
  id: number;
  name: string;
  description: string | null;
  isActive: boolean;
  applicationStartDate: string | null;
  applicationEndDate: string | null;
}

interface Props {
  instructors: InstructorOption[];
  lectureTypes: LectureType[];
  brands: LectureBrand[];
  assignmentsByInstructor: Record<string, number[]>;
}

const TOAST_DURATION_MS = 3000;

export function InstructorManager({
  instructors: initialInstructors,
  lectureTypes: initialLectureTypes,
  brands: initialBrands,
  assignmentsByInstructor: initialAssignments,
}: Props) {
  const [instructors, setInstructors] = useState(initialInstructors);
  const [lectureTypes, setLectureTypes] = useState(initialLectureTypes);
  const [brands, setBrands] = useState(initialBrands);
  const [assignments, setAssignments] = useState<Record<string, number[]>>(initialAssignments);
  const [savingInstructorId, setSavingInstructorId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const [newBrandName, setNewBrandName] = useState("");
  const [creatingBrand, setCreatingBrand] = useState(false);
  const [showInactiveBrands, setShowInactiveBrands] = useState(false);

  const [newTypeName, setNewTypeName] = useState("");
  const [newTypeDescription, setNewTypeDescription] = useState("");
  const [newTypeStartDate, setNewTypeStartDate] = useState("");
  const [newTypeEndDate, setNewTypeEndDate] = useState("");
  const [creatingType, setCreatingType] = useState(false);
  const [showInactiveLectureTypes, setShowInactiveLectureTypes] = useState(false);

  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editTypeName, setEditTypeName] = useState("");
  const [editTypeDescription, setEditTypeDescription] = useState("");
  const [editTypeStartDate, setEditTypeStartDate] = useState("");
  const [editTypeEndDate, setEditTypeEndDate] = useState("");
  const [savingTypeEdit, setSavingTypeEdit] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editingInstructor, setEditingInstructor] = useState<InstructorOption | null>(null);
  const [deleting, setDeleting] = useState<InstructorOption | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }

  function openCreate() {
    setEditingInstructor(null);
    setFormOpen(true);
  }
  function openEdit(instructor: InstructorOption) {
    setEditingInstructor(instructor);
    setFormOpen(true);
  }
  function closeForm() {
    setFormOpen(false);
    setEditingInstructor(null);
  }

  async function handleInstructorSubmit(payload: {
    name: string;
    brandId: number;
    status: "ACTIVE" | "INACTIVE";
    email?: string;
  }): Promise<SubmitResult> {
    const url = editingInstructor ? `/api/instructors/${editingInstructor.id}` : "/api/instructors";
    const method = editingInstructor ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const saved = (await res.json()) as {
        id: number;
        name: string;
        status: "ACTIVE" | "INACTIVE";
        brand: { id: number; name: string };
        email?: string;
        temporaryPassword?: string;
      };
      const normalized: InstructorOption = {
        id: saved.id,
        name: saved.name,
        status: saved.status,
        brandId: saved.brand.id,
        brandName: saved.brand.name,
      };
      setInstructors((prev) => {
        const next = editingInstructor
          ? prev.map((i) => (i.id === normalized.id ? normalized : i))
          : [...prev, normalized];
        return next.sort((a, b) => a.name.localeCompare(b.name));
      });
      if (editingInstructor) {
        closeForm();
        showToast("강사 정보가 수정되었습니다.");
        return { ok: true };
      }
      // 등록 성공 시에는 모달을 바로 닫지 않고, 모달 안에서 임시 비밀번호를 한 번 보여준 뒤
      // 사용자가 "확인"을 눌러야 닫히도록 한다(비밀번호는 이 응답에만 담겨 있어 다시 볼 수 없음).
      showToast("강사가 등록되었습니다.");
      return { ok: true, email: saved.email, temporaryPassword: saved.temporaryPassword };
    }

    const data = await res.json().catch(() => ({}));
    return { ok: false, error: data.error ?? "저장에 실패했습니다." };
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    setDeleteSubmitting(true);
    setDeleteError(null);

    const res = await fetch(`/api/instructors/${deleting.id}`, { method: "DELETE" });
    setDeleteSubmitting(false);

    if (res.ok) {
      setInstructors((prev) => prev.filter((i) => i.id !== deleting.id));
      setDeleting(null);
      showToast("강사가 삭제되었습니다.");
      return;
    }

    const data = await res.json().catch(() => ({}));
    setDeleteError(data.error ?? "삭제에 실패했습니다.");
  }

  async function handleCreateBrand() {
    if (!newBrandName.trim()) return;
    setCreatingBrand(true);
    setError(null);
    const res = await fetch("/api/lecture-brands", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newBrandName.trim() }),
    });
    setCreatingBrand(false);
    if (res.ok) {
      const created = (await res.json()) as LectureBrand;
      setBrands((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)));
      setNewBrandName("");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "브랜드 생성에 실패했습니다.");
  }

  async function toggleBrandActive(brand: LectureBrand) {
    const res = await fetch(`/api/lecture-brands/${brand.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isActive: !brand.isActive }),
    });
    if (res.ok) {
      const updated = (await res.json()) as LectureBrand;
      setBrands((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "브랜드 상태 변경에 실패했습니다.");
  }

  async function handleCreateLectureType() {
    if (!newTypeName.trim()) return;
    setCreatingType(true);
    setError(null);
    const res = await fetch("/api/lecture-types", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: newTypeName.trim(),
        description: newTypeDescription.trim(),
        applicationStartDate: newTypeStartDate || undefined,
        applicationEndDate: newTypeEndDate || undefined,
      }),
    });
    setCreatingType(false);
    if (res.ok) {
      const created = (await res.json()) as {
        id: number;
        name: string;
        description: string | null;
        isActive: boolean;
        applicationStartDate: string | null;
        applicationEndDate: string | null;
      };
      const normalized: LectureType = {
        id: created.id,
        name: created.name,
        description: created.description,
        isActive: created.isActive,
        applicationStartDate: created.applicationStartDate?.slice(0, 10) ?? null,
        applicationEndDate: created.applicationEndDate?.slice(0, 10) ?? null,
      };
      setLectureTypes((prev) => [...prev, normalized].sort((a, b) => a.name.localeCompare(b.name)));
      setNewTypeName("");
      setNewTypeDescription("");
      setNewTypeStartDate("");
      setNewTypeEndDate("");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "강의 생성에 실패했습니다.");
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

  function openEditLectureType(t: LectureType) {
    setEditingTypeId(t.id);
    setEditTypeName(t.name);
    setEditTypeDescription(t.description ?? "");
    setEditTypeStartDate(t.applicationStartDate ?? "");
    setEditTypeEndDate(t.applicationEndDate ?? "");
  }

  function closeEditLectureType() {
    setEditingTypeId(null);
  }

  async function submitEditLectureType() {
    if (!editingTypeId || !editTypeName.trim()) return;
    setSavingTypeEdit(true);
    setError(null);
    const res = await fetch(`/api/lecture-types/${editingTypeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: editTypeName.trim(),
        description: editTypeDescription.trim(),
        applicationStartDate: editTypeStartDate || null,
        applicationEndDate: editTypeEndDate || null,
      }),
    });
    setSavingTypeEdit(false);
    if (res.ok) {
      const updated = (await res.json()) as {
        id: number;
        name: string;
        description: string | null;
        isActive: boolean;
        applicationStartDate: string | null;
        applicationEndDate: string | null;
      };
      const normalized: LectureType = {
        id: updated.id,
        name: updated.name,
        description: updated.description,
        isActive: updated.isActive,
        applicationStartDate: updated.applicationStartDate?.slice(0, 10) ?? null,
        applicationEndDate: updated.applicationEndDate?.slice(0, 10) ?? null,
      };
      setLectureTypes((prev) =>
        prev.map((t) => (t.id === normalized.id ? normalized : t)).sort((a, b) => a.name.localeCompare(b.name))
      );
      setEditingTypeId(null);
      showToast("강의 프로그램 정보가 수정되었습니다.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "수정에 실패했습니다.");
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

  async function saveAssignments(instructorId: number) {
    setSavingInstructorId(instructorId);
    setError(null);
    const res = await fetch(`/api/instructors/${instructorId}/lecture-types`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lectureTypeIds: assignments[instructorId] ?? [] }),
    });
    setSavingInstructorId(null);
    if (res.ok) {
      showToast("강의 프로그램 배정이 저장되었습니다.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setError(data.error ?? "저장에 실패했습니다.");
  }

  const visibleBrands = brands.filter((b) => showInactiveBrands || b.isActive);
  const activeBrands: BrandOption[] = brands.filter((b) => b.isActive);
  const visibleLectureTypes = lectureTypes.filter((t) => showInactiveLectureTypes || t.isActive);

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">강사</h2>
          <button
            onClick={openCreate}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
          >
            + 새 강사 등록
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {instructors.length === 0 && (
            <p className="text-sm text-zinc-500">등록된 강사가 없습니다.</p>
          )}
          {instructors.map((instructor) => (
            <div
              key={instructor.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-2 dark:border-zinc-800"
            >
              <div>
                <span className="font-medium text-black dark:text-zinc-50">{instructor.name}</span>
                <span className="ml-2 text-sm text-zinc-500">{instructor.brandName}</span>
                {instructor.status === "INACTIVE" && (
                  <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                    비활성
                  </span>
                )}
              </div>
              <div className="flex gap-4 text-sm">
                <button
                  onClick={() => openEdit(instructor)}
                  className="text-zinc-600 hover:underline dark:text-zinc-300"
                >
                  수정
                </button>
                <button
                  onClick={() => {
                    setDeleteError(null);
                    setDeleting(instructor);
                  }}
                  className="text-red-600 hover:underline"
                >
                  삭제
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold text-black dark:text-zinc-50">강사별 강의 프로그램 배정</h2>
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
                  <span className="ml-2 text-sm text-zinc-500">{instructor.brandName}</span>
                  {instructor.status === "INACTIVE" && (
                    <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs text-zinc-500 dark:bg-zinc-800">
                      비활성 강사
                    </span>
                  )}
                </div>
                <button
                  onClick={() => saveAssignments(instructor.id)}
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
                  <p className="text-sm text-zinc-500">먼저 강의 프로그램을 개설해주세요.</p>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">브랜드</h2>
          <button
            onClick={() => setShowInactiveBrands((prev) => !prev)}
            className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            {showInactiveBrands ? "삭제된 브랜드 숨기기" : "삭제된 브랜드 보기"}
          </button>
        </div>
        <p className="text-xs text-zinc-500">
          강사가 강의 가능한 브랜드를 관리하는 용도로만 쓰입니다. 강사 등록·수정 시 선택합니다.
        </p>
        <div className="flex flex-wrap gap-2">
          {visibleBrands.length === 0 && (
            <p className="text-sm text-zinc-500">
              {showInactiveBrands ? "삭제된 브랜드가 없습니다." : "등록된 브랜드가 없습니다."}
            </p>
          )}
          {visibleBrands.map((b) =>
            b.isActive ? (
              <span
                key={b.id}
                className="flex items-center gap-1.5 rounded-full border border-zinc-300 py-1 pl-3 pr-2 text-sm text-zinc-700 dark:border-zinc-700 dark:text-zinc-200"
              >
                {b.name}
                <button
                  onClick={() => toggleBrandActive(b)}
                  aria-label={`${b.name} 브랜드 삭제`}
                  title="삭제 (화면에서만 숨김, 나중에 복원 가능)"
                  className="flex h-4 w-4 items-center justify-center rounded-full text-xs text-zinc-400 hover:bg-zinc-200 hover:text-zinc-700 dark:hover:bg-zinc-700 dark:hover:text-zinc-100"
                >
                  ×
                </button>
              </span>
            ) : (
              <span
                key={b.id}
                className="flex items-center gap-1.5 rounded-full border border-dashed border-zinc-300 py-1 pl-3 pr-2 text-sm text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
              >
                {b.name}
                <span className="rounded bg-zinc-100 px-1 text-[10px] dark:bg-zinc-800">삭제됨</span>
                <button
                  onClick={() => toggleBrandActive(b)}
                  className="ml-1 text-xs text-zinc-500 hover:underline dark:text-zinc-400"
                >
                  복원
                </button>
              </span>
            )
          )}
        </div>
        <div className="flex items-end gap-2 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              새 브랜드 이름
            </label>
            <input
              value={newBrandName}
              onChange={(e) => setNewBrandName(e.target.value)}
              placeholder="예: 뉴트리라이트"
              className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
            />
          </div>
          <button
            onClick={handleCreateBrand}
            disabled={creatingBrand || !newBrandName.trim()}
            className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
          >
            {creatingBrand ? "추가 중..." : "추가"}
          </button>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-black dark:text-zinc-50">강의 프로그램</h2>
          <button
            onClick={() => setShowInactiveLectureTypes((prev) => !prev)}
            className="text-sm text-zinc-500 hover:underline dark:text-zinc-400"
          >
            {showInactiveLectureTypes ? "비활성 강의 숨기기" : "비활성 강의 보기"}
          </button>
        </div>
        <div className="flex flex-col gap-2">
          {visibleLectureTypes.length === 0 && (
            <p className="text-sm text-zinc-500">
              {showInactiveLectureTypes ? "비활성 강의가 없습니다." : "개설된 강의가 없습니다."}
            </p>
          )}
          {visibleLectureTypes.map((t) =>
            editingTypeId === t.id ? (
              <div
                key={t.id}
                className="flex flex-col gap-2 rounded-lg border border-black p-4 dark:border-zinc-50"
              >
                <div className="flex flex-col gap-2 sm:flex-row">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      강의명
                    </label>
                    <input
                      value={editTypeName}
                      onChange={(e) => setEditTypeName(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      설명 (선택)
                    </label>
                    <input
                      value={editTypeDescription}
                      onChange={(e) => setEditTypeDescription(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      신청 시작일 (선택 — 비우면 제한 없음)
                    </label>
                    <input
                      type="date"
                      value={editTypeStartDate}
                      onChange={(e) => setEditTypeStartDate(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex-1">
                    <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                      신청 종료일 (선택 — 비우면 제한 없음)
                    </label>
                    <input
                      type="date"
                      value={editTypeEndDate}
                      onChange={(e) => setEditTypeEndDate(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={closeEditLectureType}
                      className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
                    >
                      취소
                    </button>
                    <button
                      onClick={submitEditLectureType}
                      disabled={savingTypeEdit || !editTypeName.trim()}
                      className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
                    >
                      {savingTypeEdit ? "저장 중..." : "저장"}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
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
                  <div className="mt-0.5 text-xs text-zinc-500">
                    신청 기간:{" "}
                    {t.applicationStartDate || t.applicationEndDate
                      ? `${t.applicationStartDate ?? "제한 없음"} ~ ${t.applicationEndDate ?? "제한 없음"}`
                      : "제한 없음"}
                  </div>
                </div>
                <div className="flex gap-4 text-sm">
                  <button
                    onClick={() => openEditLectureType(t)}
                    className="text-zinc-600 hover:underline dark:text-zinc-300"
                  >
                    수정
                  </button>
                  <button
                    onClick={() => toggleLectureTypeActive(t)}
                    className="text-zinc-500 hover:underline dark:text-zinc-400"
                  >
                    {t.isActive ? "비활성화" : "활성화"}
                  </button>
                </div>
              </div>
            )
          )}
        </div>

        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                강의명
              </label>
              <input
                value={newTypeName}
                onChange={(e) => setNewTypeName(e.target.value)}
                placeholder="예: FC교육"
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
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                신청 시작일 (선택 — 비우면 제한 없음)
              </label>
              <input
                type="date"
                value={newTypeStartDate}
                onChange={(e) => setNewTypeStartDate(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                신청 종료일 (선택 — 비우면 제한 없음)
              </label>
              <input
                type="date"
                value={newTypeEndDate}
                onChange={(e) => setNewTypeEndDate(e.target.value)}
                className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
              />
            </div>
            <button
              onClick={handleCreateLectureType}
              disabled={creatingType || !newTypeName.trim()}
              className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
            >
              {creatingType ? "개설 중..." : "강의 개설"}
            </button>
          </div>
          <p className="text-xs text-zinc-500">
            신청 가능 기간은 시스템 현재 시각을 기준으로 판단되며, 일반 사용자에게만 적용됩니다.
            팀장/매니저는 기간과 무관하게 신청할 수 있습니다. 기간은 이후에도 언제든 수정할 수
            있습니다.
          </p>
        </div>
      </section>

      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
          {error}
        </p>
      )}

      {formOpen && (
        <InstructorFormModal
          initial={editingInstructor}
          brands={activeBrands}
          onCancel={closeForm}
          onSubmit={handleInstructorSubmit}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">
              강사를 삭제할까요?
            </h2>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              {deleting.name} ({deleting.brandName})
            </p>
            <p className="mb-4 text-xs text-zinc-500">
              등록된 스케줄이나 강의 신청 이력, 연결된 로그인 계정이 있으면 삭제할 수 없습니다 —
              이 경우 비활성화를 사용해주세요.
            </p>
            {deleteError && (
              <p className="mb-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                {deleteError}
              </p>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(null)}
                className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
              >
                취소
              </button>
              <button
                type="button"
                disabled={deleteSubmitting}
                onClick={handleDeleteConfirm}
                className="rounded-full bg-red-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {deleteSubmitting ? "삭제 중..." : "삭제"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
