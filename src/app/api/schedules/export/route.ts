import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSessionFromRequest } from "@/lib/auth/current-user";
import { toDateOnly } from "@/lib/date";
import { fetchMaskedSchedules } from "@/lib/schedule-query";
import { TIME_BLOCK_LABEL } from "@/lib/schedule-labels";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const WEEKDAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

function formatDateHeader(dateStr: string): string {
  const weekday = WEEKDAY_LABELS[new Date(`${dateStr}T00:00:00.000Z`).getUTCDay()];
  return `${dateStr} (${weekday})`;
}

/**
 * GET /api/schedules/export?from=2026-07-01&to=2026-08-01&instructor=ALL
 *
 * 선택된 기간 + 선택된 강사(또는 전체) 기준으로 스케줄을 엑셀(.xlsx)로 내려준다.
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

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "강사 스케줄 관리";
  workbook.created = new Date();

  // 캘린더 형태로 읽히도록, 표 대신 날짜별로 묶어 강의 1건당 2줄(강의명/FC·LOS/시간 →
  // 장소/강사명)로 라벨을 셀에 그대로 표기한다.
  const sheet = workbook.addWorksheet("스케줄");
  sheet.columns = [{ width: 34 }, { width: 22 }, { width: 22 }];

  let currentDate: string | null = null;
  for (const row of rows) {
    if (row.date !== currentDate) {
      currentDate = row.date;
      const headerRow = sheet.addRow([`■ ${formatDateHeader(row.date)}`]);
      headerRow.font = { bold: true };
      sheet.mergeCells(headerRow.number, 1, headerRow.number, 3);
    }

    const timeLabel =
      row.startTime && row.endTime
        ? `${row.startTime}~${row.endTime}`
        : `${TIME_BLOCK_LABEL[row.timeBlock]}(블록)`;

    sheet.addRow([
      `강의명: ${row.title}`,
      `FC/LOS: ${row.lectureRequest?.fcLos ?? "-"}`,
      `시간: ${timeLabel}`,
    ]);
    sheet.addRow([`장소: ${row.location ?? "-"}`, `강사명: ${row.instructorName}`]);
    sheet.addRow([]);
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
