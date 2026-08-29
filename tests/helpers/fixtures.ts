import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { createSessionToken } from "@/lib/auth/session";

export const TEST_PASSWORD = "test-password-123";

/**
 * 매 테스트 전 DB를 비우고 강사 2명 + 계정 5개(강사A/강사B/팀장/매니저/일반 사용자)
 * + 강의 유형 1개(강사A만 배정)를 만든다.
 */
export async function resetDb() {
  await prisma.loginAttempt.deleteMany();
  await prisma.monthlyAnnouncement.deleteMany();
  await prisma.requestLock.deleteMany();
  await prisma.lectureRequest.deleteMany();
  await prisma.instructorLectureType.deleteMany();
  await prisma.lectureType.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.scheduleDeleteLog.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.user.deleteMany();
  await prisma.instructorLectureBrand.deleteMany();
  await prisma.instructor.deleteMany();
  await prisma.lectureBrand.deleteMany();

  // 라운드를 낮춰 테스트 속도를 확보한다(운영 코드의 해시 비용과는 무관).
  const passwordHash = await bcrypt.hash(TEST_PASSWORD, 4);

  const brandA = await prisma.lectureBrand.create({ data: { name: "A브랜드" } });
  const brandB = await prisma.lectureBrand.create({ data: { name: "B브랜드" } });

  const instructorA = await prisma.instructor.create({
    data: { name: "테스트강사A", brands: { create: [{ brandId: brandA.id }] } },
  });
  const instructorB = await prisma.instructor.create({
    data: { name: "테스트강사B", brands: { create: [{ brandId: brandB.id }] } },
  });

  const userInstructorA = await prisma.user.create({
    data: {
      email: "instructora@test.local",
      passwordHash,
      role: "INSTRUCTOR",
      instructorId: instructorA.id,
    },
  });
  const userInstructorB = await prisma.user.create({
    data: {
      email: "instructorb@test.local",
      passwordHash,
      role: "INSTRUCTOR",
      instructorId: instructorB.id,
    },
  });
  const userTeamLead = await prisma.user.create({
    data: { email: "teamlead@test.local", passwordHash, role: "TEAM_LEAD" },
  });
  const userManager = await prisma.user.create({
    data: { email: "manager@test.local", passwordHash, role: "MANAGER" },
  });
  const userGeneral = await prisma.user.create({
    data: {
      email: "general@test.local",
      passwordHash,
      role: "GENERAL",
      status: "APPROVED",
      name: "테스트일반사용자",
    },
  });
  const userGeneralPending = await prisma.user.create({
    data: {
      email: "general-pending@test.local",
      passwordHash,
      role: "GENERAL",
      status: "PENDING",
      name: "승인대기사용자",
    },
  });

  const lectureBrand = await prisma.lectureBrand.create({ data: { name: "테스트 브랜드" } });
  const lectureType = await prisma.lectureType.create({
    data: { name: "리더십 교육" },
  });
  await prisma.instructorLectureType.create({
    data: { instructorId: instructorA.id, lectureTypeId: lectureType.id },
  });

  return {
    instructorA,
    instructorB,
    userInstructorA,
    userInstructorB,
    userTeamLead,
    userManager,
    userGeneral,
    userGeneralPending,
    lectureBrand,
    lectureType,
  };
}

type FixtureUser = {
  id: number;
  email: string;
  role: "INSTRUCTOR" | "TEAM_LEAD" | "MANAGER" | "GENERAL";
  instructorId: number | null;
};

/** 로그인 서버 액션을 거치지 않고, 주어진 계정에 대한 유효한 세션 쿠키 문자열을 만든다. */
export async function sessionCookieFor(user: FixtureUser): Promise<string> {
  const token = await createSessionToken({
    userId: user.id,
    email: user.email,
    role: user.role,
    instructorId: user.instructorId,
  });
  return `session=${token}`;
}
