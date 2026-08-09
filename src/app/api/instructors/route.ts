import bcrypt from "bcryptjs";
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireRole } from "@/lib/require-role";
import { generateTemporaryPassword } from "@/lib/temporary-password";

const VALID_STATUSES = ["ACTIVE", "INACTIVE"] as const;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function GET() {
  const instructors = await prisma.instructor.findMany({
    orderBy: { name: "asc" },
  });
  return NextResponse.json(instructors);
}

/**
 * POST /api/instructors — 새 강사 등록 (강사 관리 화면, 팀장/매니저 전용).
 * 강사(Instructor)와 로그인 계정(User, role=INSTRUCTOR)을 한 트랜잭션으로 함께 만든다 —
 * 로그인 계정이 없으면 강사 본인이 스케줄을 관리할 방법이 없기 때문이다. 응답에는 생성
 * 직후에만 확인 가능한 임시 비밀번호가 포함된다(해시만 저장하므로 이후에는 다시 볼 수 없음).
 */
export async function POST(request: NextRequest) {
  const auth = await requireRole(request, ["TEAM_LEAD", "MANAGER"]);
  if (!auth.ok) return auth.response;

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const team = typeof body?.team === "string" ? body.team.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const status =
    typeof body?.status === "string" && VALID_STATUSES.includes(body.status as never)
      ? (body.status as (typeof VALID_STATUSES)[number])
      : "ACTIVE";

  if (!name) {
    return NextResponse.json({ error: "강사 이름을 입력해주세요." }, { status: 400 });
  }
  if (!team) {
    return NextResponse.json({ error: "소속 팀을 입력해주세요." }, { status: 400 });
  }
  if (!email || !EMAIL_RE.test(email)) {
    return NextResponse.json(
      { error: "로그인에 사용할 올바른 이메일을 입력해주세요." },
      { status: 400 }
    );
  }

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) {
    return NextResponse.json({ error: "이미 사용 중인 이메일입니다." }, { status: 409 });
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 10);

  const created = await prisma.$transaction(async (tx) => {
    const instructor = await tx.instructor.create({ data: { name, team, status } });
    await tx.user.create({
      data: {
        email,
        passwordHash,
        role: "INSTRUCTOR",
        status: "APPROVED",
        instructorId: instructor.id,
      },
    });
    return instructor;
  });

  return NextResponse.json({ ...created, email, temporaryPassword }, { status: 201 });
}
