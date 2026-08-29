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
    include: { brands: { include: { brand: { select: { id: true, name: true } } } } },
  });
  return NextResponse.json(
    instructors.map((i) => ({ ...i, brands: i.brands.map((b) => b.brand) }))
  );
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
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const status =
    typeof body?.status === "string" && VALID_STATUSES.includes(body.status as never)
      ? (body.status as (typeof VALID_STATUSES)[number])
      : "ACTIVE";

  if (!name) {
    return NextResponse.json({ error: "강사 이름을 입력해주세요." }, { status: 400 });
  }
  const brandIds = Array.isArray(body?.brandIds)
    ? (body.brandIds as unknown[]).map((v) => Number(v))
    : [];
  if (brandIds.length === 0 || !brandIds.every((id) => Number.isInteger(id))) {
    return NextResponse.json({ error: "브랜드를 1개 이상 선택해주세요." }, { status: 400 });
  }
  const uniqueBrandIds = Array.from(new Set(brandIds));
  const foundBrands = await prisma.lectureBrand.findMany({
    where: { id: { in: uniqueBrandIds } },
  });
  if (foundBrands.length !== uniqueBrandIds.length) {
    return NextResponse.json({ error: "브랜드를 찾을 수 없습니다." }, { status: 404 });
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
    const instructor = await tx.instructor.create({
      data: {
        name,
        status,
        brands: { create: uniqueBrandIds.map((brandId) => ({ brandId })) },
      },
      include: { brands: { include: { brand: { select: { id: true, name: true } } } } },
    });
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

  return NextResponse.json(
    { ...created, brands: created.brands.map((b) => b.brand), email, temporaryPassword },
    { status: 201 }
  );
}
