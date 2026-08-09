import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/users/route";
import { PATCH, DELETE } from "@/app/api/users/[id]/route";
import { POST as resetPassword } from "@/app/api/users/[id]/reset-password/route";
import { resetDb, sessionCookieFor } from "../helpers/fixtures";
import { makeRequest } from "../helpers/request";

let fx: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  fx = await resetDb();
});

const BASE = "http://localhost/api/users";

function routeParams(id: number) {
  return { params: Promise.resolve({ id: String(id) }) };
}

describe("GET /api/users", () => {
  it("401s without a session", async () => {
    const res = await GET(makeRequest(BASE, { method: "GET" }));
    expect(res.status).toBe(401);
  });

  it("403s for team lead (manager-only screen)", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await GET(makeRequest(BASE, { method: "GET", cookie }));
    expect(res.status).toBe(403);
  });

  it("403s for instructor and general accounts", async () => {
    for (const user of [fx.userInstructorA, fx.userGeneral]) {
      const cookie = await sessionCookieFor(user);
      const res = await GET(makeRequest(BASE, { method: "GET", cookie }));
      expect(res.status).toBe(403);
    }
  });

  it("lists every account for a manager, including instructor names", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await GET(makeRequest(BASE, { method: "GET", cookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.length).toBeGreaterThanOrEqual(6);
    const instructorRow = data.find((u: { id: number }) => u.id === fx.userInstructorA.id);
    expect(instructorRow.instructorName).toBe("테스트강사A");
  });
});

describe("PATCH /api/users/[id]", () => {
  it("403s for team lead", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await PATCH(
      makeRequest(`${BASE}/${fx.userGeneral.id}`, {
        method: "PATCH",
        cookie,
        body: { name: "새 이름" },
      }),
      routeParams(fx.userGeneral.id)
    );
    expect(res.status).toBe(403);
  });

  it("updates email and name", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await PATCH(
      makeRequest(`${BASE}/${fx.userGeneral.id}`, {
        method: "PATCH",
        cookie,
        body: { email: "renamed@test.local", name: "새 이름" },
      }),
      routeParams(fx.userGeneral.id)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe("renamed@test.local");
    expect(data.name).toBe("새 이름");
  });

  it("400s for an invalid email", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await PATCH(
      makeRequest(`${BASE}/${fx.userGeneral.id}`, {
        method: "PATCH",
        cookie,
        body: { email: "not-an-email" },
      }),
      routeParams(fx.userGeneral.id)
    );
    expect(res.status).toBe(400);
  });

  it("409s when the new email is already in use by another account", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await PATCH(
      makeRequest(`${BASE}/${fx.userGeneral.id}`, {
        method: "PATCH",
        cookie,
        body: { email: fx.userTeamLead.email },
      }),
      routeParams(fx.userGeneral.id)
    );
    expect(res.status).toBe(409);
  });
});

describe("POST /api/users/[id]/reset-password", () => {
  it("403s for team lead", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await resetPassword(
      makeRequest(`${BASE}/${fx.userGeneral.id}/reset-password`, { method: "POST", cookie }),
      routeParams(fx.userGeneral.id)
    );
    expect(res.status).toBe(403);
  });

  it("generates a working temporary password", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await resetPassword(
      makeRequest(`${BASE}/${fx.userGeneral.id}/reset-password`, { method: "POST", cookie }),
      routeParams(fx.userGeneral.id)
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.email).toBe(fx.userGeneral.email);
    expect(typeof data.temporaryPassword).toBe("string");
    expect(data.temporaryPassword.length).toBeGreaterThan(0);

    const updated = await prisma.user.findUniqueOrThrow({ where: { id: fx.userGeneral.id } });
    const matches = await bcrypt.compare(data.temporaryPassword, updated.passwordHash);
    expect(matches).toBe(true);
  });
});

describe("DELETE /api/users/[id]", () => {
  it("403s for team lead", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await DELETE(
      makeRequest(`${BASE}/${fx.userGeneral.id}`, { method: "DELETE", cookie }),
      routeParams(fx.userGeneral.id)
    );
    expect(res.status).toBe(403);
  });

  it("400s when a manager tries to delete their own account", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await DELETE(
      makeRequest(`${BASE}/${fx.userManager.id}`, { method: "DELETE", cookie }),
      routeParams(fx.userManager.id)
    );
    expect(res.status).toBe(400);
  });

  it("deletes an account with no lecture-request history", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await DELETE(
      makeRequest(`${BASE}/${fx.userGeneral.id}`, { method: "DELETE", cookie }),
      routeParams(fx.userGeneral.id)
    );
    expect(res.status).toBe(200);
    const gone = await prisma.user.findUnique({ where: { id: fx.userGeneral.id } });
    expect(gone).toBeNull();
  });

  it("409s when the account has made a lecture request", async () => {
    const schedule = await prisma.schedule.create({
      data: {
        instructorId: fx.instructorA.id,
        date: new Date("2026-09-01T00:00:00.000Z"),
        timeBlock: "MORNING",
        startTime: "09:00",
        endTime: "10:00",
        scheduleType: "LECTURE",
        status: "PROVISIONAL",
        title: "요청된 강의",
      },
    });
    await prisma.lectureRequest.create({
      data: {
        requesterId: fx.userGeneral.id,
        instructorId: fx.instructorA.id,
        lectureTypeId: fx.lectureType.id,
        date: new Date("2026-09-01T00:00:00.000Z"),
        timeBlock: "MORNING",
        startTime: "09:00",
        endTime: "10:00",
        fcLos: "FC-1",
        location: "본사",
        attendeeCount: 3,
        content: "테스트",
        scheduleId: schedule.id,
      },
    });

    const cookie = await sessionCookieFor(fx.userManager);
    const res = await DELETE(
      makeRequest(`${BASE}/${fx.userGeneral.id}`, { method: "DELETE", cookie }),
      routeParams(fx.userGeneral.id)
    );
    expect(res.status).toBe(409);

    const stillThere = await prisma.user.findUnique({ where: { id: fx.userGeneral.id } });
    expect(stillThere).not.toBeNull();
  });

  it("409s when the account has confirmed a lecture request", async () => {
    const schedule = await prisma.schedule.create({
      data: {
        instructorId: fx.instructorA.id,
        date: new Date("2026-09-01T00:00:00.000Z"),
        timeBlock: "MORNING",
        startTime: "09:00",
        endTime: "10:00",
        scheduleType: "LECTURE",
        status: "CONFIRMED",
        title: "확정된 강의",
      },
    });
    await prisma.lectureRequest.create({
      data: {
        requesterId: fx.userGeneral.id,
        instructorId: fx.instructorA.id,
        lectureTypeId: fx.lectureType.id,
        date: new Date("2026-09-01T00:00:00.000Z"),
        timeBlock: "MORNING",
        startTime: "09:00",
        endTime: "10:00",
        fcLos: "FC-1",
        location: "본사",
        attendeeCount: 3,
        content: "테스트",
        scheduleId: schedule.id,
        status: "CONFIRMED",
        confirmedById: fx.userTeamLead.id,
      },
    });

    const cookie = await sessionCookieFor(fx.userManager);
    const res = await DELETE(
      makeRequest(`${BASE}/${fx.userTeamLead.id}`, { method: "DELETE", cookie }),
      routeParams(fx.userTeamLead.id)
    );
    expect(res.status).toBe(409);
  });
});
