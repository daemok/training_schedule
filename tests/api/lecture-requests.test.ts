import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/lecture-requests/route";
import { POST as confirmPOST } from "@/app/api/lecture-requests/[id]/confirm/route";
import { POST as rejectPOST } from "@/app/api/lecture-requests/[id]/reject/route";
import { resetDb, sessionCookieFor } from "../helpers/fixtures";
import { makeRequest } from "../helpers/request";

let fx: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  fx = await resetDb();
});

const BASE = "http://localhost/api/lecture-requests";

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    instructorId: fx.instructorA.id,
    lectureTypeId: fx.lectureType.id,
    date: "2026-08-10",
    timeBlock: "MORNING",
    startTime: "09:30",
    endTime: "10:30",
    fcLos: "FC-1234",
    location: "본사 3층",
    attendeeCount: 5,
    content: "신규 입사자 리더십 교육 요청",
    ...overrides,
  };
}

describe("POST /api/lecture-requests", () => {
  it("403s for non-GENERAL roles", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await POST(makeRequest(BASE, { method: "POST", cookie, body: validBody() }));
    expect(res.status).toBe(403);
  });

  it("creates a PENDING request and a PROVISIONAL schedule occupying the slot", async () => {
    const cookie = await sessionCookieFor(fx.userGeneral);
    const res = await POST(makeRequest(BASE, { method: "POST", cookie, body: validBody() }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.status).toBe("PENDING");
    expect(data.scheduleId).not.toBeNull();

    const schedule = await prisma.schedule.findUnique({ where: { id: data.scheduleId } });
    expect(schedule?.status).toBe("PROVISIONAL");
    expect(schedule?.scheduleType).toBe("LECTURE");
    expect(schedule?.startTime).toBe("09:30");
  });

  it("400s when requested time is outside the selected block's range", async () => {
    const cookie = await sessionCookieFor(fx.userGeneral);
    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: validBody({ startTime: "08:00", endTime: "08:30" }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("400s when the instructor doesn't teach the selected lecture type", async () => {
    const cookie = await sessionCookieFor(fx.userGeneral);
    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: validBody({ instructorId: fx.instructorB.id }),
      })
    );
    expect(res.status).toBe(400);
  });

  it("409s when the slot is already occupied", async () => {
    const cookie = await sessionCookieFor(fx.userGeneral);
    const first = await POST(makeRequest(BASE, { method: "POST", cookie, body: validBody() }));
    expect(first.status).toBe(201);

    const second = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: validBody({ startTime: "10:00", endTime: "11:00" }),
      })
    );
    expect(second.status).toBe(409);
  });
});

describe("GET /api/lecture-requests", () => {
  async function createPendingRequest() {
    const cookie = await sessionCookieFor(fx.userGeneral);
    const res = await POST(makeRequest(BASE, { method: "POST", cookie, body: validBody() }));
    return (await res.json()) as { id: number };
  }

  it("scope=mine returns only the requester's own requests", async () => {
    await createPendingRequest();
    const cookie = await sessionCookieFor(fx.userGeneral);
    const res = await GET(makeRequest(`${BASE}?scope=mine`, { method: "GET", cookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
  });

  it("scope=pending for the target instructor returns it; for a different instructor it's empty", async () => {
    await createPendingRequest();

    const ownerCookie = await sessionCookieFor(fx.userInstructorA);
    const ownerRes = await GET(makeRequest(`${BASE}?scope=pending`, { method: "GET", cookie: ownerCookie }));
    expect((await ownerRes.json())).toHaveLength(1);

    const otherCookie = await sessionCookieFor(fx.userInstructorB);
    const otherRes = await GET(makeRequest(`${BASE}?scope=pending`, { method: "GET", cookie: otherCookie }));
    expect((await otherRes.json())).toHaveLength(0);
  });

  it("scope=pending for team lead returns requests for every instructor", async () => {
    await createPendingRequest();
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await GET(makeRequest(`${BASE}?scope=pending`, { method: "GET", cookie }));
    expect((await res.json())).toHaveLength(1);
  });
});

describe("POST /api/lecture-requests/[id]/confirm and /reject", () => {
  async function createPendingRequest() {
    const cookie = await sessionCookieFor(fx.userGeneral);
    const res = await POST(makeRequest(BASE, { method: "POST", cookie, body: validBody() }));
    return (await res.json()) as { id: number; scheduleId: number };
  }

  it("allows the target instructor to confirm, flipping the schedule to CONFIRMED", async () => {
    const created = await createPendingRequest();
    const cookie = await sessionCookieFor(fx.userInstructorA);

    const res = await confirmPOST(
      makeRequest(`${BASE}/${created.id}/confirm`, { method: "POST", cookie }),
      { params: Promise.resolve({ id: String(created.id) }) }
    );
    expect(res.status).toBe(200);

    const request = await prisma.lectureRequest.findUnique({ where: { id: created.id } });
    expect(request?.status).toBe("CONFIRMED");
    const schedule = await prisma.schedule.findUnique({ where: { id: created.scheduleId } });
    expect(schedule?.status).toBe("CONFIRMED");
  });

  it("403s when a different instructor tries to confirm", async () => {
    const created = await createPendingRequest();
    const cookie = await sessionCookieFor(fx.userInstructorB);

    const res = await confirmPOST(
      makeRequest(`${BASE}/${created.id}/confirm`, { method: "POST", cookie }),
      { params: Promise.resolve({ id: String(created.id) }) }
    );
    expect(res.status).toBe(403);
  });

  it("allows a team lead to reject, deleting the provisional schedule and freeing the slot", async () => {
    const created = await createPendingRequest();
    const cookie = await sessionCookieFor(fx.userTeamLead);

    const res = await rejectPOST(
      makeRequest(`${BASE}/${created.id}/reject`, { method: "POST", cookie }),
      { params: Promise.resolve({ id: String(created.id) }) }
    );
    expect(res.status).toBe(200);

    const request = await prisma.lectureRequest.findUnique({ where: { id: created.id } });
    expect(request?.status).toBe("REJECTED");
    expect(request?.scheduleId).toBeNull();
    const schedule = await prisma.schedule.findUnique({ where: { id: created.scheduleId } });
    expect(schedule).toBeNull();

    // 슬롯이 다시 열렸는지: 같은 시간대로 재신청이 가능해야 한다
    const generalCookie = await sessionCookieFor(fx.userGeneral);
    const retry = await POST(makeRequest(BASE, { method: "POST", cookie: generalCookie, body: validBody() }));
    expect(retry.status).toBe(201);
  });
});
