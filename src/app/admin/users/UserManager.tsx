"use client";

import { useMemo, useState } from "react";
import { Toast } from "@/components/Toast";

type Role = "INSTRUCTOR" | "TEAM_LEAD" | "MANAGER" | "GENERAL";
type Status = "PENDING" | "APPROVED" | "REJECTED";

export interface UserRow {
  id: number;
  email: string;
  name: string | null;
  role: Role;
  status: Status;
  instructorName: string | null;
  createdAt: string;
}

const ROLE_LABEL: Record<Role, string> = {
  INSTRUCTOR: "강사",
  TEAM_LEAD: "팀장",
  MANAGER: "매니저",
  GENERAL: "일반 사용자",
};

const STATUS_LABEL: Record<Status, string> = {
  PENDING: "승인 대기",
  APPROVED: "승인됨",
  REJECTED: "거절됨",
};

const TOAST_DURATION_MS = 3000;
const ROLE_FILTERS: Array<Role | "ALL"> = ["ALL", "INSTRUCTOR", "TEAM_LEAD", "MANAGER", "GENERAL"];

export function UserManager({
  currentUserId,
  initialUsers,
}: {
  currentUserId: number;
  initialUsers: UserRow[];
}) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [roleFilter, setRoleFilter] = useState<Role | "ALL">("ALL");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [editEmail, setEditEmail] = useState("");
  const [editName, setEditName] = useState("");
  const [editError, setEditError] = useState<string | null>(null);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [resetting, setResetting] = useState<UserRow | null>(null);
  const [resetResult, setResetResult] = useState<{ email: string; temporaryPassword: string } | null>(
    null
  );
  const [resetError, setResetError] = useState<string | null>(null);
  const [resetSubmitting, setResetSubmitting] = useState(false);
  const [deleting, setDeleting] = useState<UserRow | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState<"TEAM_LEAD" | "MANAGER">("TEAM_LEAD");
  const [createError, setCreateError] = useState<string | null>(null);
  const [createSubmitting, setCreateSubmitting] = useState(false);
  const [createResult, setCreateResult] = useState<{ email: string; temporaryPassword: string } | null>(
    null
  );
  const [createCopied, setCreateCopied] = useState(false);

  function showToast(message: string) {
    setToast(message);
    setTimeout(() => setToast(null), TOAST_DURATION_MS);
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return users.filter((u) => {
      if (roleFilter !== "ALL" && u.role !== roleFilter) return false;
      if (!q) return true;
      return (
        u.email.toLowerCase().includes(q) ||
        (u.name ?? "").toLowerCase().includes(q) ||
        (u.instructorName ?? "").toLowerCase().includes(q)
      );
    });
  }, [users, roleFilter, search]);

  function openEdit(user: UserRow) {
    setEditing(user);
    setEditEmail(user.email);
    setEditName(user.name ?? "");
    setEditError(null);
  }

  async function submitEdit() {
    if (!editing) return;
    setEditSubmitting(true);
    setEditError(null);
    const res = await fetch(`/api/users/${editing.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: editEmail.trim(), name: editName.trim() }),
    });
    setEditSubmitting(false);
    if (res.ok) {
      const updated = await res.json();
      setUsers((prev) =>
        prev.map((u) => (u.id === editing.id ? { ...u, email: updated.email, name: updated.name } : u))
      );
      setEditing(null);
      showToast("계정 정보가 수정되었습니다.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setEditError(data.error ?? "저장에 실패했습니다.");
  }

  function openReset(user: UserRow) {
    setResetting(user);
    setResetResult(null);
    setResetError(null);
  }

  async function submitReset() {
    if (!resetting) return;
    setResetSubmitting(true);
    setResetError(null);
    const res = await fetch(`/api/users/${resetting.id}/reset-password`, { method: "POST" });
    setResetSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      setResetResult({ email: data.email, temporaryPassword: data.temporaryPassword });
      return;
    }
    const data = await res.json().catch(() => ({}));
    setResetError(data.error ?? "재설정에 실패했습니다.");
  }

  async function handleCopyReset() {
    if (!resetResult) return;
    await navigator.clipboard.writeText(
      `이메일: ${resetResult.email}\n임시 비밀번호: ${resetResult.temporaryPassword}`
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function openCreate() {
    setCreateEmail("");
    setCreateName("");
    setCreateRole("TEAM_LEAD");
    setCreateError(null);
    setCreateResult(null);
    setCreateOpen(true);
  }

  function closeCreate() {
    setCreateOpen(false);
  }

  async function submitCreate() {
    if (!createEmail.trim() || !createName.trim()) {
      setCreateError("이메일과 이름을 모두 입력해주세요.");
      return;
    }
    setCreateSubmitting(true);
    setCreateError(null);
    const res = await fetch("/api/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: createEmail.trim(),
        name: createName.trim(),
        role: createRole,
      }),
    });
    setCreateSubmitting(false);
    if (res.ok) {
      const data = await res.json();
      setUsers((prev) =>
        [
          ...prev,
          {
            id: data.id,
            email: data.email,
            name: data.name,
            role: data.role,
            status: data.status,
            instructorName: null,
            createdAt: new Date().toISOString(),
          },
        ].sort((a, b) => a.role.localeCompare(b.role) || a.email.localeCompare(b.email))
      );
      setCreateResult({ email: data.email, temporaryPassword: data.temporaryPassword });
      return;
    }
    const data = await res.json().catch(() => ({}));
    setCreateError(data.error ?? "생성에 실패했습니다.");
  }

  async function handleCopyCreate() {
    if (!createResult) return;
    await navigator.clipboard.writeText(
      `이메일: ${createResult.email}\n임시 비밀번호: ${createResult.temporaryPassword}`
    );
    setCreateCopied(true);
    setTimeout(() => setCreateCopied(false), 2000);
  }

  async function handleDeleteConfirm() {
    if (!deleting) return;
    setDeleteSubmitting(true);
    setDeleteError(null);
    const res = await fetch(`/api/users/${deleting.id}`, { method: "DELETE" });
    setDeleteSubmitting(false);
    if (res.ok) {
      setUsers((prev) => prev.filter((u) => u.id !== deleting.id));
      setDeleting(null);
      showToast("계정이 삭제되었습니다.");
      return;
    }
    const data = await res.json().catch(() => ({}));
    setDeleteError(data.error ?? "삭제에 실패했습니다.");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            역할
          </label>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as Role | "ALL")}
            className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          >
            {ROLE_FILTERS.map((r) => (
              <option key={r} value={r}>
                {r === "ALL" ? "전체" : ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <div className="flex-1">
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            검색
          </label>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="이메일, 이름, 강사명으로 검색"
            className="w-full max-w-xs rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
          />
        </div>
        </div>
        <button
          onClick={openCreate}
          className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
        >
          + 새 계정 추가
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[720px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900">
              <th className="p-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                이메일
              </th>
              <th className="p-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                이름
              </th>
              <th className="p-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                역할
              </th>
              <th className="p-2 text-left text-xs font-medium text-zinc-500 dark:text-zinc-400">
                상태
              </th>
              <th className="p-2 text-right text-xs font-medium text-zinc-500 dark:text-zinc-400">
                작업
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => (
              <tr key={u.id} className="border-b border-zinc-200 dark:border-zinc-800">
                <td className="p-2 font-medium text-black dark:text-zinc-50">{u.email}</td>
                <td className="p-2 text-zinc-700 dark:text-zinc-300">
                  {u.instructorName ?? u.name ?? "-"}
                </td>
                <td className="p-2 text-zinc-700 dark:text-zinc-300">{ROLE_LABEL[u.role]}</td>
                <td className="p-2 text-zinc-700 dark:text-zinc-300">{STATUS_LABEL[u.status]}</td>
                <td className="p-2">
                  <div className="flex justify-end gap-3 text-sm">
                    <button
                      onClick={() => openEdit(u)}
                      className="text-zinc-600 hover:underline dark:text-zinc-300"
                    >
                      수정
                    </button>
                    <button
                      onClick={() => openReset(u)}
                      className="text-zinc-600 hover:underline dark:text-zinc-300"
                    >
                      비밀번호 재설정
                    </button>
                    <button
                      onClick={() => {
                        setDeleteError(null);
                        setDeleting(u);
                      }}
                      disabled={u.id === currentUserId}
                      className="text-red-600 hover:underline disabled:cursor-not-allowed disabled:text-zinc-300 dark:disabled:text-zinc-700"
                    >
                      삭제
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={5} className="p-6 text-center text-sm text-zinc-500">
                  조건에 맞는 계정이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="mb-4 text-lg font-semibold text-black dark:text-zinc-50">
              계정 정보 수정
            </h2>
            <div className="flex flex-col gap-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  이메일
                </label>
                <input
                  type="email"
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                  이름
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                />
                {editing.role === "INSTRUCTOR" && (
                  <p className="mt-1 text-xs text-zinc-500">
                    강사 계정의 표시 이름은 &quot;강사 관리&quot; 화면의 강사 이름을 따릅니다.
                  </p>
                )}
              </div>
              {editError && (
                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                  {editError}
                </p>
              )}
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
                >
                  취소
                </button>
                <button
                  type="button"
                  disabled={editSubmitting}
                  onClick={submitEdit}
                  className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
                >
                  {editSubmitting ? "저장 중..." : "저장"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {resetting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            {resetResult ? (
              <>
                <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">
                  비밀번호가 재설정되었습니다
                </h2>
                <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                  아래 임시 비밀번호를 계정 소유자에게 전달해주세요. 이 창을 닫으면 다시 확인할
                  수 없습니다.
                </p>
                <div className="mb-4 flex flex-col gap-2 rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">이메일 </span>
                    <span className="font-mono text-black dark:text-zinc-50">
                      {resetResult.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">임시 비밀번호 </span>
                    <span className="font-mono font-semibold text-black dark:text-zinc-50">
                      {resetResult.temporaryPassword}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCopyReset}
                    className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
                  >
                    {copied ? "복사됨" : "복사"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResetting(null)}
                    className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
                  >
                    확인
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">
                  비밀번호를 재설정할까요?
                </h2>
                <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                  {resetting.email} 계정의 비밀번호가 새 임시 비밀번호로 즉시 바뀝니다. 기존
                  비밀번호로는 더 이상 로그인할 수 없습니다.
                </p>
                {resetError && (
                  <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                    {resetError}
                  </p>
                )}
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setResetting(null)}
                    className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
                  >
                    취소
                  </button>
                  <button
                    type="button"
                    disabled={resetSubmitting}
                    onClick={submitReset}
                    className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
                  >
                    {resetSubmitting ? "재설정 중..." : "재설정"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {deleting && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">
              계정을 삭제할까요?
            </h2>
            <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
              {deleting.email} ({ROLE_LABEL[deleting.role]}) 계정을 삭제합니다. 이 작업은 되돌릴
              수 없습니다.
            </p>
            {deleteError && (
              <p className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
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

      {createOpen && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 px-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl dark:bg-zinc-900">
            {createResult ? (
              <>
                <h2 className="mb-2 text-lg font-semibold text-black dark:text-zinc-50">
                  계정이 생성되었습니다
                </h2>
                <p className="mb-4 text-sm text-zinc-600 dark:text-zinc-400">
                  아래 로그인 정보를 계정 소유자에게 전달해주세요. 이 창을 닫으면 비밀번호는
                  다시 확인할 수 없습니다.
                </p>
                <div className="mb-4 flex flex-col gap-2 rounded-md bg-zinc-50 p-3 text-sm dark:bg-zinc-800">
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">이메일 </span>
                    <span className="font-mono text-black dark:text-zinc-50">
                      {createResult.email}
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-500 dark:text-zinc-400">임시 비밀번호 </span>
                    <span className="font-mono font-semibold text-black dark:text-zinc-50">
                      {createResult.temporaryPassword}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={handleCopyCreate}
                    className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
                  >
                    {createCopied ? "복사됨" : "복사"}
                  </button>
                  <button
                    type="button"
                    onClick={closeCreate}
                    className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white dark:bg-zinc-50 dark:text-black"
                  >
                    확인
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2 className="mb-4 text-lg font-semibold text-black dark:text-zinc-50">
                  새 계정 추가
                </h2>
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      이메일
                    </label>
                    <input
                      type="email"
                      value={createEmail}
                      onChange={(e) => setCreateEmail(e.target.value)}
                      placeholder="teamlead@example.com"
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      이름
                    </label>
                    <input
                      type="text"
                      value={createName}
                      onChange={(e) => setCreateName(e.target.value)}
                      className="w-full rounded-md border border-zinc-300 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100"
                    />
                  </div>
                  <div>
                    <span className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
                      권한
                    </span>
                    <div className="flex gap-4">
                      <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                        <input
                          type="radio"
                          name="createRole"
                          checked={createRole === "TEAM_LEAD"}
                          onChange={() => setCreateRole("TEAM_LEAD")}
                        />
                        팀장
                      </label>
                      <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200">
                        <input
                          type="radio"
                          name="createRole"
                          checked={createRole === "MANAGER"}
                          onChange={() => setCreateRole("MANAGER")}
                        />
                        매니저
                      </label>
                    </div>
                    <p className="mt-1 text-xs text-zinc-500">
                      임시 비밀번호가 자동 생성되어 생성 직후 한 번만 표시됩니다.
                    </p>
                  </div>
                  {createError && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                      {createError}
                    </p>
                  )}
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={closeCreate}
                      className="rounded-full border border-zinc-300 px-4 py-2 text-sm dark:border-zinc-700"
                    >
                      취소
                    </button>
                    <button
                      type="button"
                      disabled={createSubmitting}
                      onClick={submitCreate}
                      className="rounded-full bg-black px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-50 dark:text-black"
                    >
                      {createSubmitting ? "생성 중..." : "생성"}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}
