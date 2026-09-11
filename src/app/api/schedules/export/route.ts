import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSessionFromRequest } from "@/lib/auth/current-user";
import { prisma } from "@/lib/prisma";
import { toDateOnly, formatDateOnly } from "@/lib/date";
import { fetchMaskedSchedules, type MaskedScheduleRow } from "@/lib/schedule-query";
import { TIME_BLOCK_LABEL } from "@/lib/schedule-labels";
import { buildMonthGridDays, formatMonthTitle } from "@/app/calendar/date-utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];

// src/app/calendar/colors.ts의 강사 색상 팔레트(light 값)를 그대로 재사용 — 앱 화면과
// 엑셀 파일의 색 구분이 시각적으로 일관되도록 한다. 여기서는 강사 개인이 아니라
// "강사가 속한 브랜드"별로 배정한다(브랜드가 2개 이상이면 색은 첫 번째 브랜드 기준).
const BRAND_COLOR_PALETTE = [
  "FF2A78D6", // blue
  "FFEB6834", // orange
  "FF1BAF7A", // aqua
  "FFEDA100", // yellow
  "FFE87BA4", // magenta
  "FF008300", // green
  "FF4A3AA7", // violet
  "FFE34948", // red
];
const GRAY_ARGB = "FF888888";

interface RichTextRun {
  text: string;
  font?: Partial<ExcelJS.Font>;
}

function timeLabelFor(row: MaskedScheduleRow): string {
  return row.startTime && row.endTime
    ? `${row.startTime}~${row.endTime}`
    : `${TIME_BLOCK_LABEL[row.timeBlock]}(블록)`;
}

/**
 * GET /api/schedules/export?from=2026-07-01&to=2026-08-01&instructor=ALL
 *
 * 선택된 기간 + 선택된 강사(또는 전체) 기준으로 스케줄을 실제 달력처럼 보이는 엑셀(.xlsx)로
 * 내려준다 — 월별로 한 시트씩, 요일 헤더 아래 주 단위 행마다 그 날짜의 모든 항목을
 * (브랜드 색상 태그 + 강의명 + FC/LOS + 시간 + 장소 + 강사명) 한 칸 안에 줄바꿈으로 쌓는다.
 * /api/schedules와 동일한 조회+마스킹(fetchMaskedSchedules)을 그대로 재사용하므로,
 * 개인일정 사유는 로그인한 강사 본인의 일정이 아닌 이상 파일에도 포함되지 않는다
 * (팀장/매니저가 내려받아도 "개인 일정"으로만 표시됨).
 */
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  if (!from || !to || !DATE_RE.test(from) || !DATE_RE.test(to)) {
    return NextResponse.json(
      { error: "from, to (yyyy-MM-dd) 쿼리 파라미터가 필요합니다." },
      { status: 400 }
    );
  }

  const instructorParam = searchParams.get("instructor") ?? "ALL";
  const instructorId =
    instructorParam !== "ALL" && Number.isInteger(Number(instructorParam))
      ? Number(instructorParam)
      : undefined;

  const rows = await fetchMaskedSchedules({
    from: toDateOnly(from),
    to: toDateOnly(to),
    instructorId,
    viewer: { role: user.role, instructorId: user.instructorId ?? undefined },
  });

  // 브랜드별 색상 배정 — 전체 브랜드를 id 순으로 고정 슬롯에 배정해, 필터가 바뀌어도
  // 같은 브랜드는 항상 같은 색을 쓴다(src/app/calendar/colors.ts의 강사 색상 배정과 동일 원칙).
  const allBrands = await prisma.lectureBrand.findMany({ orderBy: { id: "asc" } });
  const brandColorById = new Map<number, string>(
    allBrands.map((b, i) => [b.id, BRAND_COLOR_PALETTE[i % BRAND_COLOR_PALETTE.length]])
  );

  const instructorIds = Array.from(new Set(rows.map((r) => r.instructorId)));
  const instructors = await prisma.instructor.findMany({
    where: { id: { in: instructorIds } },
    include: { brands: { include: { brand: true } } },
  });
  const instructorBrandInfo = new Map<number, { names: string; color: string }>(
    instructors.map((i) => {
      const brands = i.brands.map((b) => b.brand);
      const names = brands.map((b) => b.name).join("/");
      const color = brands.length > 0 ? brandColorById.get(brands[0].id) ?? GRAY_ARGB : GRAY_ARGB;
      return [i.id, { names, color }];
    })
  );

  // from~to 기간이 걸쳐 있는 모든 달(yyyy-MM)에 대해, 실제로 해당 월에 데이터가 없어도
  // 최소 from이 속한 달은 빈 달력으로라도 보여준다.
  const monthKeys = new Set<string>([from.slice(0, 7)]);
  for (const row of rows) monthKeys.add(row.date.slice(0, 7));

  const rowsByDate = new Map<string, MaskedScheduleRow[]>();
  for (const row of rows) {
    const list = rowsByDate.get(row.date) ?? [];
    list.push(row);
    rowsByDate.set(row.date, list);
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "강사 스케줄 관리";
  workbook.created = new Date();

  for (const monthKey of Array.from(monthKeys).sort()) {
    const anchor = toDateOnly(`${monthKey}-01`);
    const sheet = workbook.addWorksheet(formatMonthTitle(anchor));
    sheet.columns = WEEKDAY_HEADERS.map(() => ({ width: 30 }));

    const titleRow = sheet.addRow([formatMonthTitle(anchor)]);
    titleRow.font = { bold: true, size: 16, underline: true };
    titleRow.alignment = { horizontal: "center" };
    sheet.mergeCells(titleRow.number, 1, titleRow.number, 7);

    const headerRow = sheet.addRow(WEEKDAY_HEADERS);
    headerRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true, color: { argb: colNumber === 1 ? "FFFF0000" : "FF000000" } };
      cell.alignment = { horizontal: "center" };
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF2F2F2" } };
      cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
    });

    const monthDays = buildMonthGridDays(anchor);
    const currentMonth = anchor.getUTCMonth();
    for (let week = 0; week < 6; week++) {
      const weekDays = monthDays.slice(week * 7, week * 7 + 7);
      const dataRow = sheet.addRow(new Array(7).fill(null));
      weekDays.forEach((day, colIndex) => {
        const cell = dataRow.getCell(colIndex + 1);
        cell.alignment = { wrapText: true, vertical: "top", horizontal: "left" };
        cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };

        const inMonth = day.getUTCMonth() === currentMonth;
        if (!inMonth) return; // 이전/다음 달로 넘어가는 칸은 비워둔다(날짜 숫자도 표시 안 함).

        const dateStr = formatDateOnly(day);
        const runs: RichTextRun[] = [
          {
            text: `${day.getUTCDate()}\n`,
            font: { bold: true, size: 11, color: { argb: colIndex === 0 ? "FFFF0000" : "FF000000" } },
          },
        ];

        for (const row of rowsByDate.get(dateStr) ?? []) {
          const info = instructorBrandInfo.get(row.instructorId);
          if (info?.names) {
            runs.push({ text: `[${info.names}] `, font: { bold: true, size: 9, color: { argb: info.color } } });
          }
          runs.push({ text: `${row.title}\n`, font: { bold: true, size: 9 } });
          runs.push({
            text: `FC/LOS: ${row.lectureRequest?.fcLos ?? "-"} · 시간: ${timeLabelFor(row)}\n`,
            font: { size: 8, color: { argb: "FF666666" } },
          });
          runs.push({
            text: `장소: ${row.location ?? "-"} · 강사명: ${row.instructorName}\n\n`,
            font: { size: 8, color: { argb: "FF666666" } },
          });
        }

        cell.value = { richText: runs };
      });
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const filename = `schedules_${from}_${to}.xlsx`;

  return new NextResponse(buffer, {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
