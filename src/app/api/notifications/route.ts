import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSessionFromRequest } from "@/lib/auth/current-user";

/** GET /api/notifications — 로그인한 계정 앞으로 온 알림 목록 (최근 20건, 최신순) */
export async function GET(request: NextRequest) {
  const user = await getSessionFromRequest(request);
  if (!user) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }

  const notifications = await prisma.notification.findMany({
    where: { recipientId: user.userId },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  return NextResponse.json(
    notifications.map((n) => ({
      id: n.id,
      message: n.message,
      isRead: n.isRead,
      createdAt: n.createdAt.toISOString(),
    }))
  );
}
