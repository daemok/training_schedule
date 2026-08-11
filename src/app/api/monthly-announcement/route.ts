import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { getSessionFromRequest } from "@/lib/auth/current-user";

const MAX_LENGTH = 1000;

/** GET /api/monthly-announcement — 이달의 교육 프로그램 안내 조회. 로그인한 모든 역할이 조회할 수 있다. */
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  const announcement = await prisma.monthlyAnnouncement.findFirst();
  return NextResponse.json({ content: announcement?.content ?? "" });
}

/**
 * PATCH /api/monthly-announcement — 이달의 교육 프로그램 안내 등록/수정 (팀장/매니저 전용).
 * 싱글턴 행을 upsert한다 — 기존 행이 있으면 갱신, 없으면 새로 만든다.
 */
export async function PATCH(request: NextRequest) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const content = typeof body?.content === "string" ? body.content : "";
  if (content.length > MAX_LENGTH) {
    return NextResponse.json(
      { error: `최대 ${MAX_LENGTH}자까지 입력할 수 있습니다.` },
      { status: 400 }
    );
  }

  const existing = await prisma.monthlyAnnouncement.findFirst();
  const saved = existing
    ? await prisma.monthlyAnnouncement.update({ where: { id: existing.id }, data: { content } })
    : await prisma.monthlyAnnouncement.create({ data: { content } });

  return NextResponse.json({ content: saved.content });
}
