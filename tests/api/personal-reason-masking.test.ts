import { describe, it, expect, beforeEach } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/schedules/route";
import { GET as exportGET } from "@/app/api/schedules/export/route";
import { resetDb, sessionCookieFor } from "../helpers/fixtures";
import { makeRequest } from "../helpers/request";

let fx: Awaited<ReturnType<typeof resetDb>>;

/**
 * 엑셀 내보내기는 날짜별로 묶여 강의 1건당 2줄(1줄: "강의명: .../FC·LOS: .../시간: ...",
 * 2줄: "장소: .../강사명: ...")로 라벨이 셀에 그대로 표기된다(고정 헤더 행이 없음) —
 * src/app/api/schedules/export/route.ts. 각 블록의 첫 줄(1번 열)에서 "강의명: " 라벨을
 * 떼어내 실제 제목만 모은다.
 */
function extractTitles(sheet: ExcelJS.Worksheet): string[] {
  const titles: string[] = [];
  sheet.eachRow((row) => {
    const first = String(row.getCell(1).value ?? "");
    if (first.startsWith("강의명: ")) {
      titles.push(first.slice("강의명: ".length));
    }
  });
  return titles;
}

const SECRET_REASON = "병원 진료 실제 사유(비공개)";
const SECRET_MEMO = "정기 검진, 매우 민감한 개인 메모";

beforeEach(async () => {
  fx = await resetDb();

  await prisma.schedule.create({
    data: {
      instructorId: fx.instructorA.id,
      date: new Date("2026-08-12T00:00:00.000Z"),
      timeBlock: "EVENING",
      startTime: "19:00",
      endTime: "20:00",
      scheduleType: "PERSONAL",
      title: SECRET_REASON,
      memo: SECRET_MEMO,
    },
  });
});

const BASE = "http://localhost/api/schedules";
const RANGE = "from=2026-08-01&to=2026-09-01&instructor=ALL";

async function fetchSchedules(cookie: string) {
  const res = await GET(makeRequest(`${BASE}?${RANGE}`, { method: "GET", cookie }));
  return res.json() as Promise<
    { scheduleType: string; title: string; memo: string | null }[]
  >;
}

describe("개인일정 사유 노출 정책 (조회 API)", () => {
  it("팀장에게는 사유/메모가 실제 값 그대로 노출된다 (상급자 — 전체 권한)", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const data = await fetchSchedules(cookie);
    const personal = data.find((d) => d.scheduleType === "PERSONAL");

    expect(personal).toBeDefined();
    expect(personal?.title).toBe(SECRET_REASON);
    expect(personal?.memo).toBe(SECRET_MEMO);
  });

  it("매니저에게도 사유/메모가 실제 값 그대로 노출된다 (상급자 — 전체 권한)", async () => {
    const cookie = await sessionCookieFor(fx.userManager);
    const data = await fetchSchedules(cookie);
    const personal = data.find((d) => d.scheduleType === "PERSONAL");

    expect(personal?.title).toBe(SECRET_REASON);
    expect(personal?.memo).toBe(SECRET_MEMO);
  });

  it("다른 강사에게는 사유/메모가 응답에 포함되지 않는다", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorB);
    const data = await fetchSchedules(cookie);
    const personal = data.find((d) => d.scheduleType === "PERSONAL");

    expect(personal?.title).toBe("개인 일정");
    expect(personal?.memo).toBeNull();
  });

  it("본인 강사에게는 실제 사유/메모가 그대로 내려온다", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorA);
    const data = await fetchSchedules(cookie);
    const personal = data.find((d) => d.scheduleType === "PERSONAL");

    expect(personal?.title).toBe(SECRET_REASON);
    expect(personal?.memo).toBe(SECRET_MEMO);
  });

  it("쿼리 파라미터로 role/viewerId를 조작해도 서버는 세션만 신뢰한다", async () => {
    // 강사B 세션인데 쿼리로 role=INSTRUCTOR&viewerId=<강사A>를 주입해도 무시되어야 한다.
    const cookie = await sessionCookieFor(fx.userInstructorB);
    const res = await GET(
      makeRequest(
        `${BASE}?${RANGE}&role=INSTRUCTOR&viewerId=${fx.instructorA.id}`,
        { method: "GET", cookie }
      )
    );
    const data = (await res.json()) as { scheduleType: string; title: string }[];
    const personal = data.find((d) => d.scheduleType === "PERSONAL");
    expect(personal?.title).toBe("개인 일정");
  });
});

describe("개인일정 사유 노출 정책 (엑셀 내보내기)", () => {
  it("팀장이 내려받은 엑셀 파일에는 실제 사유가 포함된다 (상급자 — 전체 권한)", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const res = await exportGET(
      makeRequest(`${BASE}/export?${RANGE}`, { method: "GET", cookie })
    );
    expect(res.status).toBe(200);

    const buffer = Buffer.from(await res.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    // exceljs 타입 선언과 @types/node의 Buffer 제네릭 파라미터가 구조적으로 어긋나
    // (런타임에는 동일한 Buffer) 타입 충돌이 나므로 eslint-disable 후 any로 우회한다.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet("스케줄");
    expect(sheet).toBeDefined();

    const titles = extractTitles(sheet!);

    expect(titles.some((t) => t.includes(SECRET_REASON))).toBe(true);
  });

  it("다른 강사가 내려받은 엑셀 파일에는 실제 사유가 포함되지 않는다", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorB);
    const res = await exportGET(
      makeRequest(`${BASE}/export?${RANGE}`, { method: "GET", cookie })
    );
    expect(res.status).toBe(200);

    const buffer = Buffer.from(await res.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.getWorksheet("스케줄");
    const titles = extractTitles(sheet!);

    expect(titles).toContain("개인 일정");
    expect(titles.some((t) => t.includes(SECRET_REASON))).toBe(false);
  });
});
