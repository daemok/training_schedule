import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSessionFromRequest } from "@/lib/auth/current-user";
import { toDateOnly } from "@/lib/date";
import { fetchMaskedSchedules } from "@/lib/schedule-query";
import { TIME_BLOCK_LABEL, SCHEDULE_TYPE_LABEL } from "@/lib/schedule-labels";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

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

  const sheet = workbook.addWorksheet("스케줄");
  sheet.columns = [
    { header: "날짜", key: "date", width: 12 },
    { header: "시간블록", key: "timeBlock", width: 10 },
    { header: "시작시각", key: "startTime", width: 10 },
    { header: "종료시각", key: "endTime", width: 10 },
    { header: "구분", key: "scheduleType", width: 10 },
    { header: "강의명", key: "title", width: 32 },
    { header: "강사명", key: "instructorName", width: 12 },
    { header: "장소", key: "location", width: 24 },
  ];
  sheet.getRow(1).font = { bold: true };

  for (const row of rows) {
    sheet.addRow({
      date: row.date,
      timeBlock: TIME_BLOCK_LABEL[row.timeBlock],
      startTime: row.startTime ?? "-",
      endTime: row.endTime ?? "-",
      scheduleType: SCHEDULE_TYPE_LABEL[row.scheduleType],
      title: row.title,
      instructorName: row.instructorName,
      location: row.location ?? "",
    });
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
