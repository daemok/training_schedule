import {
  PrismaClient,
  TimeBlock,
  ScheduleType,
  InstructorStatus,
  UserRole,
} from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import bcrypt from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

/** 시드 계정 공통 데모 비밀번호 — README에도 동일하게 안내됨. */
const DEMO_PASSWORD = "password123";

function d(day: number) {
  return new Date(`2026-07-${String(day).padStart(2, "0")}T00:00:00.000Z`);
}

async function main() {
  await prisma.loginAttempt.deleteMany();
  await prisma.lectureRequest.deleteMany();
  await prisma.instructorLectureType.deleteMany();
  await prisma.lectureType.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.scheduleDeleteLog.deleteMany();
  await prisma.schedule.deleteMany();
  await prisma.user.deleteMany();
  await prisma.instructor.deleteMany();

  const instructors = await Promise.all([
    prisma.instructor.create({
      data: { name: "김민준", team: "A팀", status: InstructorStatus.ACTIVE },
    }),
    prisma.instructor.create({
      data: { name: "이서연", team: "A팀", status: InstructorStatus.ACTIVE },
    }),
    prisma.instructor.create({
      data: { name: "박도윤", team: "B팀", status: InstructorStatus.ACTIVE },
    }),
    prisma.instructor.create({
      data: { name: "최지우", team: "B팀", status: InstructorStatus.INACTIVE },
    }),
    prisma.instructor.create({
      data: { name: "정하은", team: "C팀", status: InstructorStatus.ACTIVE },
    }),
  ]);

  const [minjun, seoyeon, doyun, jiwoo, haeun] = instructors;

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  await prisma.user.createMany({
    data: [
      {
        email: "minjun@example.com",
        passwordHash,
        role: UserRole.INSTRUCTOR,
        instructorId: minjun.id,
      },
      {
        email: "seoyeon@example.com",
        passwordHash,
        role: UserRole.INSTRUCTOR,
        instructorId: seoyeon.id,
      },
      {
        email: "doyun@example.com",
        passwordHash,
        role: UserRole.INSTRUCTOR,
        instructorId: doyun.id,
      },
      {
        email: "jiwoo@example.com",
        passwordHash,
        role: UserRole.INSTRUCTOR,
        instructorId: jiwoo.id,
      },
      {
        email: "haeun@example.com",
        passwordHash,
        role: UserRole.INSTRUCTOR,
        instructorId: haeun.id,
      },
      {
        email: "teamlead@example.com",
        passwordHash,
        role: UserRole.TEAM_LEAD,
        instructorId: null,
      },
      {
        email: "manager@example.com",
        passwordHash,
        role: UserRole.MANAGER,
        instructorId: null,
      },
      {
        email: "general@example.com",
        passwordHash,
        role: UserRole.GENERAL,
        status: "APPROVED",
        name: "일반사용자(승인됨)",
        instructorId: null,
      },
      {
        email: "pending@example.com",
        passwordHash,
        role: UserRole.GENERAL,
        status: "PENDING",
        name: "일반사용자(승인대기)",
        instructorId: null,
      },
    ],
  });

  const leadership = await prisma.lectureType.create({
    data: { name: "리더십 교육", description: "팀 리더 대상 리더십/코칭 강의" },
  });
  const dataAnalysis = await prisma.lectureType.create({
    data: { name: "데이터 분석 입문", description: "비전공자 대상 데이터 분석 기초" },
  });

  await prisma.instructorLectureType.createMany({
    data: [
      { instructorId: minjun.id, lectureTypeId: leadership.id },
      { instructorId: doyun.id, lectureTypeId: dataAnalysis.id },
      { instructorId: haeun.id, lectureTypeId: dataAnalysis.id },
    ],
  });

  await prisma.schedule.createMany({
    data: [
      // 김민준
      {
        instructorId: minjun.id,
        date: d(2),
        timeBlock: TimeBlock.MORNING,
        startTime: "09:00",
        endTime: "12:00",
        scheduleType: ScheduleType.LECTURE,
        title: "React 기초반 강의",
        location: "본사 3층 강의실 A",
        memo: "신규 교재 배포 필요",
      },
      {
        instructorId: minjun.id,
        date: d(9),
        timeBlock: TimeBlock.AFTERNOON,
        startTime: "14:00",
        endTime: "17:00",
        scheduleType: ScheduleType.LECTURE,
        title: "TypeScript 심화반 강의",
        location: "본사 3층 강의실 A",
        memo: null,
      },
      {
        instructorId: minjun.id,
        date: d(15),
        timeBlock: TimeBlock.EVENING,
        startTime: "19:00",
        endTime: "20:30",
        scheduleType: ScheduleType.PERSONAL,
        title: "병원 진료",
        location: null,
        memo: "정기 검진, 다음 강의 시작 전 복귀 예정",
      },
      {
        instructorId: minjun.id,
        date: d(23),
        timeBlock: TimeBlock.MORNING,
        startTime: "10:00",
        endTime: "13:00",
        scheduleType: ScheduleType.LECTURE,
        title: "React 기초반 강의 (2주차)",
        location: "본사 3층 강의실 A",
        memo: null,
      },
      // 이서연
      {
        instructorId: seoyeon.id,
        date: d(3),
        timeBlock: TimeBlock.AFTERNOON,
        startTime: "13:00",
        endTime: "16:00",
        scheduleType: ScheduleType.LECTURE,
        title: "UX 디자인 워크숍",
        location: "본사 5층 워크숍룸",
        memo: null,
      },
      {
        instructorId: seoyeon.id,
        date: d(10),
        timeBlock: TimeBlock.MORNING,
        startTime: "09:30",
        endTime: "11:30",
        scheduleType: ScheduleType.PERSONAL,
        title: "가족 행사 참석",
        location: null,
        memo: "오전만 사용, 오후 강의는 정상 진행",
      },
      {
        instructorId: seoyeon.id,
        date: d(17),
        timeBlock: TimeBlock.EVENING,
        startTime: "18:00",
        endTime: "20:00",
        scheduleType: ScheduleType.LECTURE,
        title: "디자인 시스템 특강",
        location: "온라인 (Zoom)",
        memo: "녹화 진행 예정",
      },
      // 박도윤
      {
        instructorId: doyun.id,
        date: d(6),
        timeBlock: TimeBlock.MORNING,
        startTime: "09:00",
        endTime: "12:00",
        scheduleType: ScheduleType.LECTURE,
        title: "백엔드 기초반 강의",
        location: "본사 4층 강의실 B",
        memo: null,
      },
      {
        instructorId: doyun.id,
        date: d(13),
        timeBlock: TimeBlock.AFTERNOON,
        startTime: "14:00",
        endTime: "15:00",
        scheduleType: ScheduleType.PERSONAL,
        title: "치과 예약",
        location: null,
        memo: null,
      },
      {
        instructorId: doyun.id,
        date: d(20),
        timeBlock: TimeBlock.AFTERNOON,
        startTime: "14:00",
        endTime: "17:00",
        scheduleType: ScheduleType.LECTURE,
        title: "백엔드 기초반 강의 (2주차)",
        location: "본사 4층 강의실 B",
        memo: null,
      },
      {
        instructorId: doyun.id,
        date: d(27),
        timeBlock: TimeBlock.MORNING,
        startTime: "10:00",
        endTime: "12:00",
        scheduleType: ScheduleType.LECTURE,
        title: "데이터베이스 특강",
        location: "본사 4층 강의실 B",
        memo: "실습용 노트북 지참 안내",
      },
      // 최지우 (비활성 강사, 이번 달 잔여 스케줄만 존재)
      {
        instructorId: jiwoo.id,
        date: d(4),
        timeBlock: TimeBlock.AFTERNOON,
        startTime: "13:00",
        endTime: "16:00",
        scheduleType: ScheduleType.LECTURE,
        title: "클라우드 입문 강의",
        location: "본사 5층 강의실 C",
        memo: "휴직 전 마지막 강의",
      },
      {
        instructorId: jiwoo.id,
        date: d(11),
        timeBlock: TimeBlock.MORNING,
        startTime: "09:00",
        endTime: "10:00",
        scheduleType: ScheduleType.PERSONAL,
        title: "인수인계 미팅",
        location: null,
        memo: "후임자에게 강의자료 전달",
      },
      {
        instructorId: jiwoo.id,
        date: d(18),
        timeBlock: TimeBlock.EVENING,
        startTime: "18:30",
        endTime: "19:30",
        scheduleType: ScheduleType.PERSONAL,
        title: "개인 사정",
        location: null,
        memo: "휴직 처리 관련",
      },
      // 정하은
      {
        instructorId: haeun.id,
        date: d(7),
        timeBlock: TimeBlock.MORNING,
        startTime: "09:00",
        endTime: "12:00",
        scheduleType: ScheduleType.LECTURE,
        title: "데이터 분석 기초반 강의",
        location: "본사 6층 강의실 D",
        memo: null,
      },
      {
        instructorId: haeun.id,
        date: d(14),
        timeBlock: TimeBlock.AFTERNOON,
        startTime: "13:30",
        endTime: "17:30",
        scheduleType: ScheduleType.LECTURE,
        title: "데이터 시각화 워크숍",
        location: "본사 6층 강의실 D",
        memo: "노트북 및 어댑터 준비",
      },
      {
        instructorId: haeun.id,
        date: d(21),
        timeBlock: TimeBlock.EVENING,
        startTime: "19:00",
        endTime: "21:00",
        scheduleType: ScheduleType.PERSONAL,
        title: "대학원 수업 청강",
        location: null,
        memo: "다음 학기 강의 준비 목적",
      },
      {
        instructorId: haeun.id,
        date: d(28),
        timeBlock: TimeBlock.MORNING,
        startTime: "10:00",
        endTime: "12:00",
        scheduleType: ScheduleType.LECTURE,
        title: "데이터 분석 기초반 강의 (2주차)",
        location: "본사 6층 강의실 D",
        memo: null,
      },
    ],
  });

  console.log("Seed complete.");
  console.log(`Demo login password for all accounts: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
