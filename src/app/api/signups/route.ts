import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";

/** GET /api/signups — 승인 대기 중인 일반 사용자 가입 목록 (팀장/매니저 전용) */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const pending = await prisma.user.findMany({
    where: { role: "GENERAL", status: "PENDING" },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(pending);
}
