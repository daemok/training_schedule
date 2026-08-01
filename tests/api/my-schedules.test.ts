import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/my/schedules/route";
import { PATCH, DELETE } from "@/app/api/my/schedules/[id]/route";
import { resetDb, sessionCookieFor } from "../helpers/fixtures";
import { makeRequest } from "../helpers/request";

let fx: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  fx = await resetDb();
});

const BASE = "http://localhost/api/my/schedules";

describe("POST /api/my/schedules", () => {
  it("401s without a session", async () => {
    const res = await POST(makeRequest(BASE, { method: "POST", body: {} }));
    expect(res.status).toBe(401);
  });

  it("400s for team lead when instructorId is missing", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await POST(
      makeRequest(BASE, { method: "POST", cookie, body: { scheduleType: "LECTURE" } })
    );
    expect(res.status).toBe(400);
  });

  it("404s for team lead when instructorId doesn't exist", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: {
          instructorId: 999999,
          scheduleType: "LECTURE",
          date: "2026-08-03",
          timeBlock: "MORNING",
          startTime: "09:00",
          endTime: "10:00",
          title: "테스트 강의",
        },
      })
    );
    expect(res.status).toBe(404);
  });

  it("allows a team lead to register a schedule for another instructor", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: {
          instructorId: fx.instructorB.id,
          scheduleType: "LECTURE",
          date: "2026-08-03",
          timeBlock: "MORNING",
          startTime: "09:00",
          endTime: "10:00",
          title: "팀장이 대신 등록한 강의",
        },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.instructorId).toBe(fx.instructorB.id);
  });

  it("allows a manager to register a schedule for another instructor", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: {
          instructorId: fx.instructorA.id,
          scheduleType: "LECTURE",
          date: "2026-08-03",
          timeBlock: "MORNING",
          startTime: "09:00",
          endTime: "10:00",
          title: "매니저가 대신 등록한 강의",
        },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.instructorId).toBe(fx.instructorA.id);
  });

  it("creates a lecture schedule owned by the logged-in instructor", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: {
          scheduleType: "LECTURE",
          date: "2026-08-03",
          timeBlock: "MORNING",
          startTime: "09:00",
          endTime: "10:00",
          title: "테스트 강의",
          location: "온라인",
        },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.title).toBe("테스트 강의");
    expect(data.instructorId).toBe(fx.instructorA.id);

    const stored = await prisma.schedule.findUnique({ where: { id: data.id } });
    expect(stored?.instructorId).toBe(fx.instructorA.id);
  });

  it("400s when end time is not after start time", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: {
          scheduleType: "LECTURE",
          date: "2026-08-03",
          timeBlock: "MORNING",
          startTime: "10:00",
          endTime: "09:00",
          title: "테스트 강의",
        },
      })
    );
    expect(res.status).toBe(400);
  });

  it("409s on overlap unless force:true is set", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const first = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: {
          scheduleType: "LECTURE",
          date: "2026-08-03",
          timeBlock: "MORNING",
          startTime: "09:00",
          endTime: "11:00",
          title: "1교시",
        },
      })
    );
    expect(first.status).toBe(201);

    const overlapping = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: {
          scheduleType: "LECTURE",
          date: "2026-08-03",
          timeBlock: "MORNING",
          startTime: "10:00",
          endTime: "12:00",
          title: "겹치는 2교시",
        },
      })
    );
    expect(overlapping.status).toBe(409);
    const overlapData = await overlapping.json();
    expect(overlapData.overlap).toBe(true);

    const forced = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: {
          scheduleType: "LECTURE",
          date: "2026-08-03",
          timeBlock: "MORNING",
          startTime: "10:00",
          endTime: "12:00",
          title: "강제 저장된 2교시",
          force: true,
        },
      })
    );
    expect(forced.status).toBe(201);
  });
});

describe("GET /api/my/schedules", () => {
  it("only returns the logged-in instructor's own schedules", async () => {
    await prisma.schedule.create({
      data: {
        instructorId: fx.instructorA.id,
        date: new Date("2026-08-05T00:00:00.000Z"),
        timeBlock: "MORNING",
        startTime: "09:00",
        endTime: "10:00",
        scheduleType: "LECTURE",
        title: "A의 강의",
      },
    });
    await prisma.schedule.create({
      data: {
        instructorId: fx.instructorB.id,
        date: new Date("2026-08-05T00:00:00.000Z"),
        timeBlock: "MORNING",
        startTime: "09:00",
        endTime: "10:00",
        scheduleType: "LECTURE",
        title: "B의 강의",
      },
    });

    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await GET(makeRequest(`${BASE}?year=2026&month=8`, { method: "GET", cookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].title).toBe("A의 강의");
  });
});

describe("PATCH/DELETE /api/my/schedules/[id]", () => {
  async function createScheduleFor(instructorId: number) {
    return prisma.schedule.create({
      data: {
        instructorId,
        date: new Date("2026-08-10T00:00:00.000Z"),
        timeBlock: "AFTERNOON",
        startTime: "13:00",
        endTime: "14:00",
        scheduleType: "LECTURE",
        title: "원본 강의",
      },
    });
  }

  it("allows the owner to update their own schedule", async () => {
    const schedule = await createScheduleFor(fx.instructorA.id);
    const cookie = await sessionCookieFor(fx.userInstructorA);

    const res = await PATCH(
      makeRequest(`${BASE}/${schedule.id}`, {
        method: "PATCH",
        cookie,
        body: {
          scheduleType: "LECTURE",
          date: "2026-08-10",
          timeBlock: "AFTERNOON",
          startTime: "13:00",
          endTime: "15:00",
          title: "수정된 강의",
        },
      }),
      { params: Promise.resolve({ id: String(schedule.id) }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("수정된 강의");
    expect(data.endTime).toBe("15:00");
  });

  it("403s when updating another instructor's schedule", async () => {
    const schedule = await createScheduleFor(fx.instructorB.id);
    const cookie = await sessionCookieFor(fx.userInstructorA);

    const res = await PATCH(
      makeRequest(`${BASE}/${schedule.id}`, {
        method: "PATCH",
        cookie,
        body: {
          scheduleType: "LECTURE",
          date: "2026-08-10",
          timeBlock: "AFTERNOON",
          startTime: "13:00",
          endTime: "15:00",
          title: "해킹 시도",
        },
      }),
      { params: Promise.resolve({ id: String(schedule.id) }) }
    );

    expect(res.status).toBe(403);
    const unchanged = await prisma.schedule.findUnique({ where: { id: schedule.id } });
    expect(unchanged?.title).toBe("원본 강의");
  });

  it("allows a team lead to update another instructor's schedule", async () => {
    const schedule = await createScheduleFor(fx.instructorB.id);
    const cookie = await sessionCookieFor(fx.userTeamLead);

    const res = await PATCH(
      makeRequest(`${BASE}/${schedule.id}`, {
        method: "PATCH",
        cookie,
        body: {
          scheduleType: "LECTURE",
          date: "2026-08-10",
          timeBlock: "AFTERNOON",
          startTime: "13:00",
          endTime: "15:00",
          title: "팀장이 수정한 강의",
        },
      }),
      { params: Promise.resolve({ id: String(schedule.id) }) }
    );

    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.title).toBe("팀장이 수정한 강의");
    expect(data.instructorId).toBe(fx.instructorB.id);
  });

  it("deletes the schedule and writes a ScheduleDeleteLog entry", async () => {
    const schedule = await createScheduleFor(fx.instructorA.id);
    const cookie = await sessionCookieFor(fx.userInstructorA);

    const res = await DELETE(makeRequest(`${BASE}/${schedule.id}`, { method: "DELETE", cookie }), {
      params: Promise.resolve({ id: String(schedule.id) }),
    });

    expect(res.status).toBe(200);
    const remaining = await prisma.schedule.findUnique({ where: { id: schedule.id } });
    expect(remaining).toBeNull();

    const log = await prisma.scheduleDeleteLog.findFirst({
      where: { scheduleId: schedule.id },
    });
    expect(log).not.toBeNull();
    expect(log?.deletedByUserId).toBe(fx.userInstructorA.id);
    expect(log?.title).toBe("원본 강의");
  });

  it("403s when deleting another instructor's schedule", async () => {
    const schedule = await createScheduleFor(fx.instructorB.id);
    const cookie = await sessionCookieFor(fx.userInstructorA);

    const res = await DELETE(makeRequest(`${BASE}/${schedule.id}`, { method: "DELETE", cookie }), {
      params: Promise.resolve({ id: String(schedule.id) }),
    });

    expect(res.status).toBe(403);
    const stillThere = await prisma.schedule.findUnique({ where: { id: schedule.id } });
    expect(stillThere).not.toBeNull();
  });

  it("allows a manager to delete another instructor's schedule and records the manager as the deleter", async () => {
    const schedule = await createScheduleFor(fx.instructorB.id);
    const cookie = await sessionCookieFor(fx.userManager);

    const res = await DELETE(makeRequest(`${BASE}/${schedule.id}`, { method: "DELETE", cookie }), {
      params: Promise.resolve({ id: String(schedule.id) }),
    });

    expect(res.status).toBe(200);
    const remaining = await prisma.schedule.findUnique({ where: { id: schedule.id } });
    expect(remaining).toBeNull();

    const log = await prisma.scheduleDeleteLog.findFirst({
      where: { scheduleId: schedule.id },
    });
    expect(log?.deletedByUserId).toBe(fx.userManager.id);
    expect(log?.instructorId).toBe(fx.instructorB.id);
  });
});
