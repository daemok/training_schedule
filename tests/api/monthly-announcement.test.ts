import { describe, it, expect, beforeEach } from "vitest";
import { GET, PATCH } from "@/app/api/monthly-announcement/route";
import { resetDb, sessionCookieFor } from "../helpers/fixtures";
import { makeRequest } from "../helpers/request";

let fx: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  fx = await resetDb();
});

const BASE = "http://localhost/api/monthly-announcement";

describe("GET /api/monthly-announcement", () => {
  it("401s without a session", async () => {
    const res = await GET(makeRequest(BASE, { method: "GET" }));
    expect(res.status).toBe(401);
  });

  it("returns an empty string when nothing has been registered yet", async () => {
    const cookie = await sessionCookieFor(fx.userGeneral);
    const res = await GET(makeRequest(BASE, { method: "GET", cookie }));
    expect(res.status).toBe(200);
    expect((await res.json()).content).toBe("");
  });

  it("is readable by any logged-in role", async () => {
    const teamLeadCookie = await sessionCookieFor(fx.userTeamLead);
    await PATCH(
      makeRequest(BASE, { method: "PATCH", cookie: teamLeadCookie, body: { content: "8월 안내" } })
    );

    const cookie = await sessionCookieFor(fx.userGeneral);
    const res = await GET(makeRequest(BASE, { method: "GET", cookie }));
    expect((await res.json()).content).toBe("8월 안내");
  });
});

describe("PATCH /api/monthly-announcement", () => {
  it("403s for a general user", async () => {
    const cookie = await sessionCookieFor(fx.userGeneral);
    const res = await PATCH(
      makeRequest(BASE, { method: "PATCH", cookie, body: { content: "안내" } })
    );
    expect(res.status).toBe(403);
  });

  it("403s for an instructor account", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await PATCH(
      makeRequest(BASE, { method: "PATCH", cookie, body: { content: "안내" } })
    );
    expect(res.status).toBe(403);
  });

  it("creates the announcement for a team lead", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await PATCH(
      makeRequest(BASE, { method: "PATCH", cookie, body: { content: "이번 달 FC교육 안내" } })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).content).toBe("이번 달 FC교육 안내");
  });

  it("updates the existing announcement instead of creating a second row for a manager", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    await PATCH(makeRequest(BASE, { method: "PATCH", cookie, body: { content: "첫 안내" } }));
    const res = await PATCH(
      makeRequest(BASE, { method: "PATCH", cookie, body: { content: "수정된 안내" } })
    );
    expect(res.status).toBe(200);
    expect((await res.json()).content).toBe("수정된 안내");

    const getRes = await GET(makeRequest(BASE, { method: "GET", cookie }));
    expect((await getRes.json()).content).toBe("수정된 안내");
  });

  it("allows clearing the announcement with an empty string", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    await PATCH(makeRequest(BASE, { method: "PATCH", cookie, body: { content: "안내" } }));
    const res = await PATCH(makeRequest(BASE, { method: "PATCH", cookie, body: { content: "" } }));
    expect(res.status).toBe(200);
    expect((await res.json()).content).toBe("");
  });

  it("400s when content exceeds 1000 characters", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await PATCH(
      makeRequest(BASE, { method: "PATCH", cookie, body: { content: "a".repeat(1001) } })
    );
    expect(res.status).toBe(400);
  });
});
