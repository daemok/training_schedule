import { describe, it, expect, beforeEach } from "vitest";
import { prisma } from "@/lib/prisma";
import { GET, POST } from "@/app/api/lecture-brands/route";
import { PATCH } from "@/app/api/lecture-brands/[id]/route";
import { resetDb, sessionCookieFor } from "../helpers/fixtures";
import { makeRequest } from "../helpers/request";

let fx: Awaited<ReturnType<typeof resetDb>>;

beforeEach(async () => {
  fx = await resetDb();
});

const BASE = "http://localhost/api/lecture-brands";

describe("GET /api/lecture-brands", () => {
  it("401s without a session", async () => {
    const res = await GET(makeRequest(BASE, { method: "GET" }));
    expect(res.status).toBe(401);
  });

  it("lists brands for any logged-in role", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await GET(makeRequest(BASE, { method: "GET", cookie }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.some((b: { id: number }) => b.id === fx.lectureBrand.id)).toBe(true);
  });
});

describe("POST /api/lecture-brands", () => {
  it("403s for an instructor account", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await POST(makeRequest(BASE, { method: "POST", cookie, body: { name: "새 브랜드" } }));
    expect(res.status).toBe(403);
  });

  it("creates a brand for a team lead", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await POST(makeRequest(BASE, { method: "POST", cookie, body: { name: "뉴트리라이트" } }));
    expect(res.status).toBe(201);
    const data = await res.json();
    expect(data.name).toBe("뉴트리라이트");
  });

  it("409s for a duplicate brand name", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await POST(
      makeRequest(BASE, { method: "POST", cookie, body: { name: fx.lectureBrand.name } })
    );
    expect(res.status).toBe(409);
  });

  it("400s when name is missing", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await POST(makeRequest(BASE, { method: "POST", cookie, body: {} }));
    expect(res.status).toBe(400);
  });
});

describe("PATCH /api/lecture-brands/[id]", () => {
  it("403s for an instructor account", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const res = await PATCH(
      makeRequest(`${BASE}/${fx.lectureBrand.id}`, { method: "PATCH", cookie, body: { isActive: false } }),
      { params: Promise.resolve({ id: String(fx.lectureBrand.id) }) }
    );
    expect(res.status).toBe(403);
  });

  it("deactivates (soft-deletes) a brand without removing the row", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await PATCH(
      makeRequest(`${BASE}/${fx.lectureBrand.id}`, { method: "PATCH", cookie, body: { isActive: false } }),
      { params: Promise.resolve({ id: String(fx.lectureBrand.id) }) }
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.isActive).toBe(false);

    const stillThere = await prisma.lectureBrand.findUnique({ where: { id: fx.lectureBrand.id } });
    expect(stillThere).not.toBeNull();
    expect(stillThere?.isActive).toBe(false);
  });

  it("reactivates a previously deactivated brand", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    await PATCH(
      makeRequest(`${BASE}/${fx.lectureBrand.id}`, { method: "PATCH", cookie, body: { isActive: false } }),
      { params: Promise.resolve({ id: String(fx.lectureBrand.id) }) }
    );
    const res = await PATCH(
      makeRequest(`${BASE}/${fx.lectureBrand.id}`, { method: "PATCH", cookie, body: { isActive: true } }),
      { params: Promise.resolve({ id: String(fx.lectureBrand.id) }) }
    );
    expect(res.status).toBe(200);
    expect((await res.json()).isActive).toBe(true);
  });

  it("404s for a nonexistent brand", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const res = await PATCH(
      makeRequest(`${BASE}/999999`, { method: "PATCH", cookie, body: { isActive: false } }),
      { params: Promise.resolve({ id: "999999" }) }
    );
    expect(res.status).toBe(404);
  });
});
