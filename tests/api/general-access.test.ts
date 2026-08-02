import { describe, it, expect, beforeEach } from "vitest";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { signup } from "@/app/signup/actions";
import { login } from "@/app/login/actions";
import { POST as lectureTypesPOST } from "@/app/api/lecture-types/route";
import { PUT as instructorLectureTypesPUT } from "@/app/api/instructors/[id]/lecture-types/route";
import { GET as instructorsGET, POST as instructorsPOST } from "@/app/api/instructors/route";
import {
  PATCH as instructorPATCH,
  DELETE as instructorDELETE,
} from "@/app/api/instructors/[id]/route";
import { GET as signupsGET } from "@/app/api/signups/route";
import { POST as approvePOST } from "@/app/api/signups/[id]/approve/route";
import { POST as rejectPOST } from "@/app/api/signups/[id]/reject/route";
import { POST as myScheduleCreate } from "@/app/api/my/schedules/route";
import { resetDb, sessionCookieFor, TEST_PASSWORD } from "../helpers/fixtures";
import { makeRequest } from "../helpers/request";

let fx: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  fx = await resetDb();
});

function formDataFrom(fields: Record<string, string>) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("회원가입 (signup server action)", () => {
  it("creates a GENERAL account with status PENDING", async () => {
    const result = await signup(
      {},
      formDataFrom({
        email: "newuser@test.local",
        name: "새 사용자",
        password: "password123",
        passwordConfirm: "password123",
      })
    );
    expect(result.success).toBe(true);

    const created = await prisma.user.findUnique({ where: { email: "newuser@test.local" } });
    expect(created?.role).toBe("GENERAL");
    expect(created?.status).toBe("PENDING");
  });

  it("rejects a duplicate email", async () => {
    const result = await signup(
      {},
      formDataFrom({
        email: fx.userGeneral.email,
        name: "중복",
        password: "password123",
        passwordConfirm: "password123",
      })
    );
    expect(result.error).toBeDefined();
  });

  it("rejects mismatched password confirmation", async () => {
    const result = await signup(
      {},
      formDataFrom({
        email: "mismatch@test.local",
        name: "불일치",
        password: "password123",
        passwordConfirm: "password456",
      })
    );
    expect(result.error).toBeDefined();
  });
});

describe("로그인 승인 상태 검증 (login server action)", () => {
  it("blocks login for a PENDING account", async () => {
    const result = await login(
      {},
      formDataFrom({ email: fx.userGeneralPending.email, password: TEST_PASSWORD })
    );
    expect(result.error).toMatch(/승인 대기/);
  });
});

describe("일반 사용자는 /api/my/schedules를 직접 호출할 수 없다", () => {
  it("403s on POST", async () => {
    const cookie = await sessionCookieFor(fx.userGeneral);
    const res = await myScheduleCreate(
      makeRequest("http://localhost/api/my/schedules", {
        method: "POST",
        cookie,
        body: { scheduleType: "LECTURE" },
      })
    );
    expect(res.status).toBe(403);
  });
});

describe("강의 유형 / 강사 관리 권한 (팀장/매니저 전용)", () => {
  it("403s creating a lecture type as an instructor", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await lectureTypesPOST(
      makeRequest("http://localhost/api/lecture-types", {
        method: "POST",
        cookie,
        body: { name: "새 강의 유형" },
      })
    );
    expect(res.status).toBe(403);
  });

  it("allows a team lead to create a lecture type and assign it to an instructor", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const created = await lectureTypesPOST(
      makeRequest("http://localhost/api/lecture-types", {
        method: "POST",
        cookie,
        body: { name: "새 강의 유형" },
      })
    );
    expect(created.status).toBe(201);
    const lectureType = await created.json();

    const assignRes = await instructorLectureTypesPUT(
      makeRequest(`http://localhost/api/instructors/${fx.instructorB.id}/lecture-types`, {
        method: "PUT",
        cookie,
        body: { lectureTypeIds: [lectureType.id, fx.lectureType.id] },
      }),
      { params: Promise.resolve({ id: String(fx.instructorB.id) }) }
    );
    expect(assignRes.status).toBe(200);

    const links = await prisma.instructorLectureType.findMany({
      where: { instructorId: fx.instructorB.id },
    });
    expect(links).toHaveLength(2);
  });

  it("403s assigning lecture types as an instructor", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await instructorLectureTypesPUT(
      makeRequest(`http://localhost/api/instructors/${fx.instructorB.id}/lecture-types`, {
        method: "PUT",
        cookie,
        body: { lectureTypeIds: [] },
      }),
      { params: Promise.resolve({ id: String(fx.instructorB.id) }) }
    );
    expect(res.status).toBe(403);
  });
});

describe("가입 승인 관리 (팀장/매니저 전용)", () => {
  it("lists pending signups and allows approval", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const listRes = await signupsGET(
      makeRequest("http://localhost/api/signups", { method: "GET", cookie })
    );
    const pending = await listRes.json();
    expect(pending.some((p: { id: number }) => p.id === fx.userGeneralPending.id)).toBe(true);

    const approveRes = await approvePOST(
      makeRequest(`http://localhost/api/signups/${fx.userGeneralPending.id}/approve`, {
        method: "POST",
        cookie,
      }),
      { params: Promise.resolve({ id: String(fx.userGeneralPending.id) }) }
    );
    expect(approveRes.status).toBe(200);

    const updated = await prisma.user.findUnique({ where: { id: fx.userGeneralPending.id } });
    expect(updated?.status).toBe("APPROVED");
  });

  it("403s for an instructor trying to reject a signup", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await rejectPOST(
      makeRequest(`http://localhost/api/signups/${fx.userGeneralPending.id}/reject`, {
        method: "POST",
        cookie,
      }),
      { params: Promise.resolve({ id: String(fx.userGeneralPending.id) }) }
    );
    expect(res.status).toBe(403);
  });
});

describe("블록 단위 개인일정 (시간 미입력)", () => {
  const BASE = "http://localhost/api/my/schedules";

  it("creates a PERSONAL schedule without start/end time", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await myScheduleCreate(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: { scheduleType: "PERSONAL", date: "2026-08-05", timeBlock: "MORNING" },
      })
    );
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.startTime).toBeNull();
    expect(data.endTime).toBeNull();
  });

  it("409s when another entry already occupies the same block", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const first = await myScheduleCreate(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: { scheduleType: "PERSONAL", date: "2026-08-05", timeBlock: "MORNING" },
      })
    );
    expect(first.status).toBe(201);

    const second = await myScheduleCreate(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: {
          scheduleType: "LECTURE",
          date: "2026-08-05",
          timeBlock: "MORNING",
          startTime: "09:00",
          endTime: "10:00",
          title: "충돌 강의",
        },
      })
    );
    expect(second.status).toBe(409);
  });

  it("allows a timed entry in a different block on the same day", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const first = await myScheduleCreate(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: { scheduleType: "PERSONAL", date: "2026-08-05", timeBlock: "MORNING" },
      })
    );
    expect(first.status).toBe(201);

    const second = await myScheduleCreate(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: {
          scheduleType: "LECTURE",
          date: "2026-08-05",
          timeBlock: "AFTERNOON",
          startTime: "14:00",
          endTime: "15:00",
          title: "다른 블록 강의",
        },
      })
    );
    expect(second.status).toBe(201);
  });
});

describe("강사 관리 (팀장/매니저 전용)", () => {
  const BASE = "http://localhost/api/instructors";

  it("403s creating an instructor as an instructor account", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await instructorsPOST(
      makeRequest(BASE, { method: "POST", cookie, body: { name: "새강사", team: "D팀" } })
    );
    expect(res.status).toBe(403);
  });

  it("allows a team lead to create an instructor with a linked login account", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await instructorsPOST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: { name: "새강사", team: "D팀", email: "new-instructor@test.local" },
      })
    );
    expect(res.status).toBe(201);
    const created = await res.json();
    expect(created.name).toBe("새강사");
    expect(created.status).toBe("ACTIVE");
    expect(created.email).toBe("new-instructor@test.local");
    expect(typeof created.temporaryPassword).toBe("string");
    expect(created.temporaryPassword.length).toBeGreaterThanOrEqual(8);

    const listRes = await instructorsGET();
    const list = await listRes.json();
    expect(list.some((i: { id: number }) => i.id === created.id)).toBe(true);

    const linkedUser = await prisma.user.findUnique({
      where: { email: "new-instructor@test.local" },
    });
    expect(linkedUser?.role).toBe("INSTRUCTOR");
    expect(linkedUser?.status).toBe("APPROVED");
    expect(linkedUser?.instructorId).toBe(created.id);

    const matches = await bcrypt.compare(created.temporaryPassword, linkedUser!.passwordHash);
    expect(matches).toBe(true);
  });

  it("400s when the email is missing or invalid", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await instructorsPOST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: { name: "새강사", team: "D팀", email: "not-an-email" },
      })
    );
    expect(res.status).toBe(400);
  });

  it("409s when the email is already in use", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await instructorsPOST(
      makeRequest(BASE, {
        method: "POST",
        cookie,
        body: { name: "새강사", team: "D팀", email: fx.userInstructorA.email },
      })
    );
    expect(res.status).toBe(409);
  });

  it("400s when name or team is missing", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await instructorsPOST(
      makeRequest(BASE, { method: "POST", cookie, body: { name: "" } })
    );
    expect(res.status).toBe(400);
  });

  it("allows a manager to edit an instructor's name/team/status", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await instructorPATCH(
      makeRequest(`${BASE}/${fx.instructorB.id}`, {
        method: "PATCH",
        cookie,
        body: { name: "박도윤(개명)", team: "C팀", status: "INACTIVE" },
      }),
      { params: Promise.resolve({ id: String(fx.instructorB.id) }) }
    );
    expect(res.status).toBe(200);
    const updated = await res.json();
    expect(updated.name).toBe("박도윤(개명)");
    expect(updated.team).toBe("C팀");
    expect(updated.status).toBe("INACTIVE");
  });

  it("403s editing an instructor as an instructor account", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await instructorPATCH(
      makeRequest(`${BASE}/${fx.instructorB.id}`, {
        method: "PATCH",
        cookie,
        body: { name: "해킹 시도" },
      }),
      { params: Promise.resolve({ id: String(fx.instructorB.id) }) }
    );
    expect(res.status).toBe(403);
  });

  it("deletes an instructor with no schedules, requests, or linked account", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const created = await prisma.instructor.create({ data: { name: "삭제용강사", team: "Z팀" } });

    const res = await instructorDELETE(
      makeRequest(`${BASE}/${created.id}`, { method: "DELETE", cookie }),
      { params: Promise.resolve({ id: String(created.id) }) }
    );
    expect(res.status).toBe(200);

    const stillThere = await prisma.instructor.findUnique({ where: { id: created.id } });
    expect(stillThere).toBeNull();
  });

  it("409s deleting an instructor that has schedules", async () => {
    await prisma.schedule.create({
      data: {
        instructorId: fx.instructorA.id,
        date: new Date("2026-08-05T00:00:00.000Z"),
        timeBlock: "MORNING",
        startTime: "09:00",
        endTime: "10:00",
        scheduleType: "LECTURE",
        title: "삭제 방지용 강의",
      },
    });
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await instructorDELETE(
      makeRequest(`${BASE}/${fx.instructorA.id}`, { method: "DELETE", cookie }),
      { params: Promise.resolve({ id: String(fx.instructorA.id) }) }
    );
    expect(res.status).toBe(409);

    const stillThere = await prisma.instructor.findUnique({ where: { id: fx.instructorA.id } });
    expect(stillThere).not.toBeNull();
  });

  it("409s deleting an instructor that has a linked login account", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    // fx.instructorB has no schedules but is linked to fx.userInstructorB
    const res = await instructorDELETE(
      makeRequest(`${BASE}/${fx.instructorB.id}`, { method: "DELETE", cookie }),
      { params: Promise.resolve({ id: String(fx.instructorB.id) }) }
    );
    expect(res.status).toBe(409);
  });

  it("403s deleting an instructor as an instructor account", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const created = await prisma.instructor.create({ data: { name: "삭제용강사2", team: "Z팀" } });
    const res = await instructorDELETE(
      makeRequest(`${BASE}/${created.id}`, { method: "DELETE", cookie }),
      { params: Promise.resolve({ id: String(created.id) }) }
    );
    expect(res.status).toBe(403);
  });
});
