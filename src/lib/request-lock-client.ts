export interface LockAcquireResult {
  ok: boolean;
  error?: string;
  expiresInMs?: number;
}

export interface ActiveLock {
  instructorId: number;
  date: string;
  timeBlock: "MORNING" | "AFTERNOON" | "EVENING";
  mine: boolean;
}

/** 신청서 작성 시작 — RequestFormModal을 열기 전에 호출한다. */
export async function acquireRequestLockClient(
  instructorId: number,
  date: string,
  timeBlock: string
): Promise<LockAcquireResult> {
  const res = await fetch("/api/lecture-requests/locks", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructorId, date, timeBlock }),
  });
  if (res.ok) {
    const data = await res.json();
    return { ok: true, expiresInMs: data.expiresInMs };
  }
  const data = await res.json().catch(() => ({}));
  return { ok: false, error: data.error ?? "신청서를 열 수 없습니다." };
}

/** 취소 또는 시간 초과 시 잠금을 해제한다. 실패해도 서버에서 10분 뒤 자동 만료되므로 무시한다. */
export async function releaseRequestLockClient(
  instructorId: number,
  date: string,
  timeBlock: string
): Promise<void> {
  await fetch("/api/lecture-requests/locks", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ instructorId, date, timeBlock }),
  }).catch(() => {});
}

/** 기간 내 현재 유효한 잠금 목록 — 신청 가능 여부 표시에 다른 사용자의 진행 중 신청을 반영하기 위함. */
export async function fetchActiveLocksClient(from: string, to: string): Promise<ActiveLock[]> {
  const res = await fetch(`/api/lecture-requests/locks?from=${from}&to=${to}`);
  if (!res.ok) return [];
  return res.json();
}
