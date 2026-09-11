import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSessionFromRequest } from "@/lib/auth/current-user";
import { toDateOnly, formatDateOnly } from "@/lib/date";
import { fetchMaskedSchedules, type MaskedScheduleRow } from "@/lib/schedule-query";
import { TIME_BLOCK_LABEL } from "@/lib/schedule-labels";
import { buildMonthGridDays, formatMonthTitle } from "@/app/calendar/date-utils";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY_HEADERS = ["일", "월", "화", "수", "목", "금", "토"];

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
 * 선택된 기간 + 선택된 강사(또는 전체) 기준으로, 확정된(CONFIRMED) 강의(LECTURE)만
 * 실제 달력처럼 보이는 엑셀(.xlsx)로 내려준다 — 개인일정과 미확정 건은 제외한다.
 * 월별로 한 시트씩, 요일 헤더 아래 주 단위 행마다 그 날짜의 모든 강의를 한 칸 안에
 * 강의 1건당 2줄(1줄: "FC/LOS {값} {시간}", 2줄: "{장소} / {강사명}")로 줄바꿈해 쌓는다
 * (강의 프로그램명/브랜드는 표시하지 않는다). /api/schedules와 동일한 조회+마스킹
 * (fetchMaskedSchedules)을 재사용한 뒤 이 라우트에서 CONFIRMED LECTURE만 걸러낸다.
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

  const allRows = await fetchMaskedSchedules({
    from: toDateOnly(from),
    to: toDateOnly(to),
    instructorId,
    viewer: { role: user.role, instructorId: user.instructorId ?? undefined },
  });
  const rows = allRows.filter((r) => r.scheduleType === "LECTURE" && r.status === "CONFIRMED");

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
          runs.push({
            text: `FC/LOS ${row.lectureRequest?.fcLos ?? "-"} ${timeLabelFor(row)}\n`,
            font: { bold: true, size: 9 },
          });
          runs.push({
            text: `${row.location ?? "-"} / ${row.instructorName}\n\n`,
            font: { size: 9, color: { argb: "FF666666" } },
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
