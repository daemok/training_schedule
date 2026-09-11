import { describe, it, expect, beforeEach } from "vitest";
import ExcelJS from "exceljs";
import { prisma } from "@/lib/prisma";
import { GET } from "@/app/api/schedules/route";
import { GET as exportGET } from "@/app/api/schedules/export/route";
import { resetDb, sessionCookieFor } from "../helpers/fixtures";
import { makeRequest } from "../helpers/request";

let fx: Awaited<ReturnType<typeof resetDb>>;

/**
 * 엑셀 내보내기는 월별 달력 그리드로, 요일 칸 하나(richText)에 그 날짜의 확정된 강의가
 * "FC/LOS {값} {시간}" / "{장소} / {강사명}" 형태로 줄바꿈되어 쌓인다(개인일정과 미확정
 * 건은 애초에 제외됨 — src/app/api/schedules/export/route.ts). 시트 전체를 훑어 모든
 * 셀의 richText run 텍스트를 이어붙인 문자열 하나로 모아, 특정 문구가 파일 어디에도
 * 포함되는지/포함되지 않는지를 검사한다.
 */
function extractAllText(sheet: ExcelJS.Worksheet): string {
  const parts: string[] = [];
  sheet.eachRow((row) => {
    row.eachCell((cell) => {
      const value = cell.value;
      if (value && typeof value === "object" && "richText" in value) {
        for (const run of value.richText) parts.push(run.text);
      } else if (typeof value === "string") {
        parts.push(value);
      }
    });
  });
  return parts.join("");
}

const SECRET_REASON = "병원 진료 실제 사유(비공개)";
const SECRET_MEMO = "정기 검진, 매우 민감한 개인 메모";
const CONFIRMED_LOCATION = "확정강의실 A";
const PROVISIONAL_LOCATION = "미확정강의실 B";

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

  // 엑셀 내보내기는 확정된(CONFIRMED) 강의만 포함해야 하므로, 확정 강의 1건과
  // 미확정(PROVISIONAL) 강의 1건을 함께 만들어 필터링을 검증한다.
  await prisma.schedule.create({
    data: {
      instructorId: fx.instructorA.id,
      date: new Date("2026-08-13T00:00:00.000Z"),
      timeBlock: "MORNING",
      startTime: "09:00",
      endTime: "12:00",
      scheduleType: "LECTURE",
      status: "CONFIRMED",
      title: "확정 강의",
      location: CONFIRMED_LOCATION,
    },
  });
  await prisma.schedule.create({
    data: {
      instructorId: fx.instructorA.id,
      date: new Date("2026-08-14T00:00:00.000Z"),
      timeBlock: "MORNING",
      startTime: "09:00",
      endTime: "12:00",
      scheduleType: "LECTURE",
      status: "PROVISIONAL",
      title: "미확정 강의",
      location: PROVISIONAL_LOCATION,
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

describe("엑셀 내보내기 (확정 강의만, 개인일정 제외)", () => {
  async function exportText(cookie: string): Promise<string> {
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
    const sheet = workbook.worksheets[0];
    expect(sheet).toBeDefined();
    return extractAllText(sheet!);
  }

  it("팀장이 내려받아도 개인일정 사유는 포함되지 않는다 (애초에 제외됨)", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const text = await exportText(cookie);

    expect(text.includes(SECRET_REASON)).toBe(false);
    expect(text.includes("개인 일정")).toBe(false);
  });

  it("다른 강사가 내려받아도 개인일정 사유는 포함되지 않는다", async () => {
    const cookie = await sessionCookieFor(fx.userInstructorB);
    const text = await exportText(cookie);

    expect(text.includes(SECRET_REASON)).toBe(false);
    expect(text.includes("개인 일정")).toBe(false);
  });

  it("확정된 강의는 포함되고, 미확정 강의는 제외된다", async () => {
    const cookie = await sessionCookieFor(fx.userTeamLead);
    const text = await exportText(cookie);

    expect(text.includes(CONFIRMED_LOCATION)).toBe(true);
    expect(text.includes(PROVISIONAL_LOCATION)).toBe(false);
  });
});
