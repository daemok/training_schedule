import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";

/**
 * GET /api/users — 로그인 가능한 전체 계정 목록 (매니저 전용, 최고 관리자 화면).
 * 강사/팀장/매니저/일반 사용자를 역할 구분 없이 모두 반환한다 — 강사 계정은 연결된
 * Instructor.name도 함께 내려줘 목록에서 바로 식별할 수 있게 한다.
 */
export async function GET(request: NextRequest) {
  const auth = await requireRole(request, ["MANAGER"]);
  if (!auth.ok) return auth.response;

  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      role: true,
      status: true,
      instructorId: true,
      instructor: { select: { name: true } },
      createdAt: true,
    },
    orderBy: [{ role: "asc" }, { email: "asc" }],
  });

  return NextResponse.json(
    users.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      role: u.role,
      status: u.status,
      instructorName: u.instructor?.name ?? null,
      createdAt: u.createdAt.toISOString(),
    }))
  );
}
