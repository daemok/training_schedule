import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST, DELETE } from "@/app/api/lecture-requests/locks/route";
import { resetDb, sessionCookieFor } from "../helpers/fixtures";
import { makeRequest } from "../helpers/request";

let fx: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  fx = await resetDb();
});

const BASE = "http://localhost/api/lecture-requests/locks";

function slotBody(overrides: Record<string, unknown> = {}) {
  return { instructorId: 0, date: "2026-08-10", timeBlock: "MORNING", ...overrides };
}

describe("POST /api/lecture-requests/locks", () => {
  it("403s for an instructor account (not a requester role)", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await POST(
      makeRequest(BASE, { method: "POST", cookie, body: slotBody({ instructorId: fx.instructorA.id }) })
    );
    expect(res.status).toBe(403);
  });

  it("acquires a fresh lock", async () => {
    const cookie = await sessionCookieFor(fx.userGeneral);
    const res = await POST(
      makeRequest(BASE, { method: "POST", cookie, body: slotBody({ instructorId: fx.instructorA.id }) })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(data.expiresInMs).toBeGreaterThan(0);
  });

  it("409s when a different user tries to acquire the same slot", async () => {
    const cookieA = await sessionCookieFor(fx.userGeneral);
    await POST(
      makeRequest(BASE, { method: "POST", cookie: cookieA, body: slotBody({ instructorId: fx.instructorA.id }) })
    );

    const cookieB = await sessionCookieFor(fx.userTeamLead);
    const res = await POST(
      makeRequest(BASE, { method: "POST", cookie: cookieB, body: slotBody({ instructorId: fx.instructorA.id }) })
    );
    expect(res.status).toBe(409);
  });

  it("allows the same user to re-acquire (reclaim) their own lock", async () => {
    const cookie = await sessionCookieFor(fx.userGeneral);
    const first = await POST(
      makeRequest(BASE, { method: "POST", cookie, body: slotBody({ instructorId: fx.instructorA.id }) })
    );
    expect(first.status).toBe(200);
    const second = await POST(
      makeRequest(BASE, { method: "POST", cookie, body: slotBody({ instructorId: fx.instructorA.id }) })
    );
    expect(second.status).toBe(200);
  });

  it("allows a different user to acquire once the lock has expired", async () => {
    const cookieA = await sessionCookieFor(fx.userGeneral);
    await POST(
      makeRequest(BASE, { method: "POST", cookie: cookieA, body: slotBody({ instructorId: fx.instructorA.id }) })
    );
    // Simulate expiry by backdating the lock directly.
    await prisma.requestLock.updateMany({
      where: { instructorId: fx.instructorA.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });

    const cookieB = await sessionCookieFor(fx.userTeamLead);
    const res = await POST(
      makeRequest(BASE, { method: "POST", cookie: cookieB, body: slotBody({ instructorId: fx.instructorA.id }) })
    );
    expect(res.status).toBe(200);
  });

  it("does not block a different (instructor, block) slot", async () => {
    const cookieA = await sessionCookieFor(fx.userGeneral);
    await POST(
      makeRequest(BASE, { method: "POST", cookie: cookieA, body: slotBody({ instructorId: fx.instructorA.id }) })
    );

    const cookieB = await sessionCookieFor(fx.userTeamLead);
    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie: cookieB,
        body: slotBody({ instructorId: fx.instructorA.id, timeBlock: "AFTERNOON" }),
      })
    );
    expect(res.status).toBe(200);
  });
});

describe("DELETE /api/lecture-requests/locks", () => {
  it("releases the caller's own lock, letting another user acquire it", async () => {
    const cookieA = await sessionCookieFor(fx.userGeneral);
    await POST(
      makeRequest(BASE, { method: "POST", cookie: cookieA, body: slotBody({ instructorId: fx.instructorA.id }) })
    );
    const del = await DELETE(
      makeRequest(BASE, { method: "DELETE", cookie: cookieA, body: slotBody({ instructorId: fx.instructorA.id }) })
    );
    expect(del.status).toBe(200);

    const cookieB = await sessionCookieFor(fx.userTeamLead);
    const res = await POST(
      makeRequest(BASE, { method: "POST", cookie: cookieB, body: slotBody({ instructorId: fx.instructorA.id }) })
    );
    expect(res.status).toBe(200);
  });

  it("is a no-op when releasing someone else's lock", async () => {
    const cookieA = await sessionCookieFor(fx.userGeneral);
    await POST(
      makeRequest(BASE, { method: "POST", cookie: cookieA, body: slotBody({ instructorId: fx.instructorA.id }) })
    );

    const cookieB = await sessionCookieFor(fx.userTeamLead);
    await DELETE(
      makeRequest(BASE, { method: "DELETE", cookie: cookieB, body: slotBody({ instructorId: fx.instructorA.id }) })
    );

    // Still locked by A — B still can't acquire it.
    const res = await POST(
      makeRequest(BASE, { method: "POST", cookie: cookieB, body: slotBody({ instructorId: fx.instructorA.id }) })
    );
    expect(res.status).toBe(409);
  });
});

describe("GET /api/lecture-requests/locks", () => {
  it("lists active locks in range and flags which one is mine", async () => {
    const cookieA = await sessionCookieFor(fx.userGeneral);
    await POST(
      makeRequest(BASE, { method: "POST", cookie: cookieA, body: slotBody({ instructorId: fx.instructorA.id }) })
    );

    const cookieB = await sessionCookieFor(fx.userTeamLead);
    const res = await GET(
      makeRequest(`${BASE}?from=2026-08-01&to=2026-08-31`, { method: "GET", cookie: cookieB })
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].mine).toBe(false);

    const resMine = await GET(
      makeRequest(`${BASE}?from=2026-08-01&to=2026-08-31`, { method: "GET", cookie: cookieA })
    );
    const dataMine = await resMine.json();
    expect(dataMine[0].mine).toBe(true);
  });
});
