import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/schedules/route";
import { resetDb, sessionCookieFor } from "../helpers/fixtures";
import { makeRequest } from "../helpers/request";

let fx: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  fx = await resetDb();

  await prisma.schedule.createMany({
    data: [
      {
        instructorId: fx.instructorA.id,
        date: new Date("2026-08-05T00:00:00.000Z"),
        timeBlock: "MORNING",
        startTime: "09:00",
        endTime: "10:00",
        scheduleType: "LECTURE",
        title: "A 강사의 8월 강의",
      },
      {
        instructorId: fx.instructorB.id,
        date: new Date("2026-08-06T00:00:00.000Z"),
        timeBlock: "AFTERNOON",
        startTime: "13:00",
        endTime: "14:00",
        scheduleType: "LECTURE",
        title: "B 강사의 8월 강의",
      },
      {
        instructorId: fx.instructorA.id,
        date: new Date("2026-09-01T00:00:00.000Z"),
        timeBlock: "MORNING",
        startTime: "09:00",
        endTime: "10:00",
        scheduleType: "LECTURE",
        title: "A 강사의 9월 강의(범위 밖)",
      },
    ],
  });
});

const BASE = "http://localhost/api/schedules";

describe("GET /api/schedules", () => {
  it("400s when from/to are missing", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await GET(makeRequest(`${BASE}?instructor=ALL`, { method: "GET", cookie }));
    expect(res.status).toBe(400);
  });

  it("401s without a session", async () => {
    const res = await GET(
      makeRequest(`${BASE}?from=2026-08-01&to=2026-09-01&instructor=ALL`, { method: "GET" })
    );
    expect(res.status).toBe(401);
  });

  it("only returns rows inside the requested date range", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await GET(
      makeRequest(`${BASE}?from=2026-08-01&to=2026-09-01&instructor=ALL`, {
        method: "GET",
        cookie,
      })
    );
    const data = await res.json();
    expect(data).toHaveLength(2);
    expect(data.every((d: { date: string }) => d.date >= "2026-08-01" && d.date < "2026-09-01")).toBe(
      true
    );
  });

  it("returns every instructor's schedules when instructor=ALL", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await GET(
      makeRequest(`${BASE}?from=2026-08-01&to=2026-09-01&instructor=ALL`, {
        method: "GET",
        cookie,
      })
    );
    const data = await res.json();
    const instructorIds = new Set(data.map((d: { instructorId: number }) => d.instructorId));
    expect(instructorIds.has(fx.instructorA.id)).toBe(true);
    expect(instructorIds.has(fx.instructorB.id)).toBe(true);
  });

  it("filters down to a single instructor when instructor=<id>", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await GET(
      makeRequest(`${BASE}?from=2026-08-01&to=2026-09-01&instructor=${fx.instructorA.id}`, {
        method: "GET",
        cookie,
      })
    );
    const data = await res.json();
    expect(data).toHaveLength(1);
    expect(data[0].instructorId).toBe(fx.instructorA.id);
    expect(data[0].title).toBe("A 강사의 8월 강의");
  });
});

describe("dailyPriority (캘린더에 표시되는 미확정 요청 우선순위)", () => {
  async function createPendingLectureSchedule(opts: {
    instructorId: number;
    timeBlock: "MORNING" | "AFTERNOON" | "EVENING";
    startTime: string;
    endTime: string;
    createdAt: Date;
  }) {
    const schedule = await prisma.schedule.create({
      data: {
        instructorId: opts.instructorId,
        date: new Date("2026-08-10T00:00:00.000Z"),
        timeBlock: opts.timeBlock,
        startTime: opts.startTime,
        endTime: opts.endTime,
        scheduleType: "LECTURE",
        status: "PROVISIONAL",
        title: "테스트 강의 신청",
      },
    });
    await prisma.lectureRequest.create({
      data: {
        requesterId: fx.userGeneral.id,
        instructorId: opts.instructorId,
        lectureTypeId: fx.lectureType.id,
        date: new Date("2026-08-10T00:00:00.000Z"),
        timeBlock: opts.timeBlock,
        startTime: opts.startTime,
        endTime: opts.endTime,
        fcLos: "FC-1",
        location: "본사",
        attendeeCount: 1,
        content: "테스트",
        scheduleId: schedule.id,
        createdAt: opts.createdAt,
      },
    });
    return schedule;
  }

  it("ranks pending requests by creation order across the whole date, not per time block", async () => {
    // 저녁 신청이 먼저, 오전 신청이 나중 — 블록이 달라도 날짜 전체 기준으로 1, 2가 매겨져야 한다.
    const eveningSchedule = await createPendingLectureSchedule({
      instructorId: fx.instructorA.id,
      timeBlock: "EVENING",
      startTime: "18:00",
      endTime: "19:00",
      createdAt: new Date("2026-08-01T09:00:00.000Z"),
    });
    const morningSchedule = await createPendingLectureSchedule({
      instructorId: fx.instructorB.id,
      timeBlock: "MORNING",
      startTime: "09:00",
      endTime: "10:00",
      createdAt: new Date("2026-08-01T10:00:00.000Z"),
    });

    const cookie = await sessionCookieFor(fx.userManager);
    const res = await GET(
      makeRequest(`${BASE}?from=2026-08-01&to=2026-09-01&instructor=ALL`, { method: "GET", cookie })
    );
    const data = await res.json();
    const evening = data.find((d: { id: number }) => d.id === eveningSchedule.id);
    const morning = data.find((d: { id: number }) => d.id === morningSchedule.id);
    expect(evening.lectureRequest.dailyPriority).toBe(1);
    expect(morning.lectureRequest.dailyPriority).toBe(2);
  });

  it("returns null dailyPriority once a request is confirmed", async () => {
    const schedule = await createPendingLectureSchedule({
      instructorId: fx.instructorA.id,
      timeBlock: "MORNING",
      startTime: "09:00",
      endTime: "10:00",
      createdAt: new Date("2026-08-01T09:00:00.000Z"),
    });
    await prisma.schedule.update({ where: { id: schedule.id }, data: { status: "CONFIRMED" } });
    await prisma.lectureRequest.updateMany({
      where: { scheduleId: schedule.id },
      data: { status: "CONFIRMED" },
    });

    const cookie = await sessionCookieFor(fx.userManager);
    const res = await GET(
      makeRequest(`${BASE}?from=2026-08-01&to=2026-09-01&instructor=ALL`, { method: "GET", cookie })
    );
    const data = await res.json();
    const row = data.find((d: { id: number }) => d.id === schedule.id);
    expect(row.lectureRequest.dailyPriority).toBeNull();
  });
});
