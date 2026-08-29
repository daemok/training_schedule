import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { generateTemporaryPassword } from "@/lib/temporary-password";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CREATABLE_ROLES = ["TEAM_LEAD", "MANAGER"] as const;

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

/**
 * POST /api/users — 새 계정 직접 생성 (매니저 전용, 사용자 관리 화면).
 * 팀장/매니저 권한만 부여할 수 있다 — INSTRUCTOR는 "강사 및 강의 관리"의 강사 등록 시
 * 자동으로 계정이 함께 만들어지고(src/app/api/instructors/route.ts), GENERAL은 자가
 * 가입(/signup) 후 승인 절차를 거치므로 이 화면에서 직접 만들 대상이 아니다.
 * 강사 등록과 동일하게 임시 비밀번호를 생성해 응답에 담아 한 번만 보여준다.
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["MANAGER"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const role = body?.role;

  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json({ error: "올바른 이메일을 입력해주세요." }, { status: 400 });
  }
  if (!name) {
    return NextResponse.json({ error: "이름을 입력해주세요." }, { status: 400 });
  }
  if (typeof role !== "string" || !CREATABLE_ROLES.includes(role as (typeof CREATABLE_ROLES)[number])) {
    return NextResponse.json(
      { error: "권한은 팀장 또는 매니저만 지정할 수 있습니다." },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const created = await prisma.user.create({
    data: {
      email,
      name,
      role: role as (typeof CREATABLE_ROLES)[number],
      status: "APPROVED",
      passwordHash,
    },
  });

  return NextResponse.json(
    {
      id: created.id,
      email: created.email,
      name: created.name,
      role: created.role,
      status: created.status,
      temporaryPassword,
    },
    { status: 201 }
  );
}
