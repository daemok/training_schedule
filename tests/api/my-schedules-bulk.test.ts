import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { POST } from "@/app/api/my/schedules/bulk/route";
import { resetDb, sessionCookieFor } from "../helpers/fixtures";
import { makeRequest } from "../helpers/request";

let fx: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  fx = await resetDb();
});

const BASE = "http://localhost/api/my/schedules/bulk";

function dates(n: number, startDay = 1): string[] {
  return Array.from({ length: n }, (_, i) => `2026-09-${String(startDay + i).padStart(2, "0")}`);
}

describe("POST /api/my/schedules/bulk", () => {
  it("401s without a session", async () => {
    const res = await POST(makeRequest(BASE, { method: "POST", body: {} }));
    expect(res.status).toBe(401);
  });

  it("403s for non-instructor accounts", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: { dates: dates(2), personalBlock: "ALL_DAY" },
      })
    );
    expect(res.status).toBe(403);
  });

  it("400s when no dates are given", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await POST(
      makeRequest(BASE, { method: "POST", cookie, body: { dates: [], personalBlock: "ALL_DAY" } })
    );
    expect(res.status).toBe(400);
  });

  it("400s when more than 30 dates are given", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: { dates: dates(31), personalBlock: "ALL_DAY" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("400s for an invalid personalBlock value", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: { dates: dates(2), personalBlock: "NOON" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("creates one row per date for a single block, defaulting the title placeholder", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: { dates: dates(3), personalBlock: "MORNING" },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.createdCount).toBe(3);

    const rows = await prisma.schedule.findMany({ where: { instructorId: fx.instructorA.id } });
    expect(rows).toHaveLength(3);
    expect(rows.every((r) => r.scheduleType === "PERSONAL")).toBe(true);
    expect(rows.every((r) => r.timeBlock === "MORNING")).toBe(true);
    expect(rows.every((r) => r.startTime === null)).toBe(true);
    expect(rows.every((r) => r.title === "개인 일정")).toBe(true);
  });

  it("fans ALL_DAY out into 3 blocks per date and applies a custom title", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: { dates: dates(2), personalBlock: "ALL_DAY", title: "휴가" },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.createdCount).toBe(6);

    const rows = await prisma.schedule.findMany({ where: { instructorId: fx.instructorA.id } });
    expect(rows).toHaveLength(6);
    expect(rows.every((r) => r.title === "휴가")).toBe(true);
    expect(new Set(rows.map((r) => r.timeBlock))).toEqual(
      new Set(["MORNING", "AFTERNOON", "EVENING"])
    );
  });

  it("409s and creates nothing when a date/block already has a schedule", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    await prisma.schedule.create({
      data: {
        instructorId: fx.instructorA.id,
        date: new Date("2026-09-02T00:00:00.000Z"),
        timeBlock: "MORNING",
        scheduleType: "LECTURE",
        title: "기존 강의",
      },
    });

    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: { dates: dates(3), personalBlock: "MORNING" },
      })
    );
    expect(res.status).toBe(409);
    const data = await res.json();
    expect(data.overlap).toBe(true);
    expect(data.conflicts).toHaveLength(1);
    expect(data.conflicts[0].title).toBe("기존 강의");

    const rows = await prisma.schedule.findMany({ where: { instructorId: fx.instructorA.id } });
    expect(rows).toHaveLength(1); // only the pre-existing lecture, nothing from the bulk request
  });

  it("force:true creates rows even when a conflict exists", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    await prisma.schedule.create({
      data: {
        instructorId: fx.instructorA.id,
        date: new Date("2026-09-02T00:00:00.000Z"),
        timeBlock: "MORNING",
        scheduleType: "LECTURE",
        title: "기존 강의",
      },
    });

    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: { dates: dates(3), personalBlock: "MORNING", force: true },
      })
    );
    expect(res.status).toBe(201);

    const rows = await prisma.schedule.findMany({ where: { instructorId: fx.instructorA.id } });
    expect(rows).toHaveLength(4); // 1 pre-existing + 3 forced
  });

  it("notifies team leads with a single summary message, not one per row", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await POST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: { dates: dates(3), personalBlock: "ALL_DAY" },
      })
    );
    expect(res.status).toBe(201);

    const notifications = await prisma.notification.findMany({
      where: { recipientId: fx.userTeamLead.id },
    });
    expect(notifications).toHaveLength(1);
    expect(notifications[0].message).toContain("3일");
    expect(notifications[0].message).toContain("9건");
  });
});
