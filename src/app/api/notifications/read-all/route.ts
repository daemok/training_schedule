import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth/current-user";

/** POST /api/notifications/read-all — 로그인한 계정의 모든 알림을 읽음 처리 */
export async function POST(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  await prisma.notification.updateMany({
    where: { recipientId: user.userId, isRead: false },
    data: { isRead: true },
  });

  return NextResponse.json({ ok: true });
}
