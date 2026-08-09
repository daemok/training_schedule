import { prisma } from "@/lib/prisma";
import { TIME_BLOCK_LABEL } from "@/lib/schedule-labels";
import type { Schedule } from "@/generated/prisma";

/**
 * 강사(또는 강사를 대신해 등록한 팀장/매니저)가 신규 일정을 등록하면 모든 팀장(TEAM_LEAD)
 * 계정에게 알림을 남긴다. 팀장은 개인일정 상세를 열람할 권한이 있으므로 실제 제목을 그대로
 * 담는다. `excludeUserId`가 주어지면(등록을 수행한 사람이 팀장 본인인 경우) 해당 팀장에게는
 * 알림을 보내지 않는다.
 */
export async function notifyTeamLeadsOfNewSchedule(
  schedule: Schedule,
  instructorName: string,
  excludeUserId?: number
): Promise<void> {
  const teamLeads = await prisma.user.findMany({
    where: { role: "TEAM_LEAD", ...(excludeUserId ? { id: { not: excludeUserId } } : {}) },
    select: { id: true },
  });
  if (teamLeads.length === 0) return;

  const message = `${instructorName} 강사가 새 일정을 등록했습니다: ${schedule.title} (${schedule.date
    .toISOString()
    .slice(0, 10)} ${TIME_BLOCK_LABEL[schedule.timeBlock]})`;

  await prisma.notification.createMany({
    data: teamLeads.map((u) => ({
      recipientId: u.id,
      message,
      scheduleId: schedule.id,
    })),
  });
}

/**
 * 강사가 개인일정을 여러 날짜에 걸쳐 일괄 등록하면, row 개수만큼 알림을 쏟아내는 대신
 * 팀장마다 요약 알림 1건만 남긴다(예: 30일 × 3블록 = 90건이 개별 알림으로 쌓이는 것을 방지).
 */
export async function notifyTeamLeadsOfBulkPersonalSchedule(
  instructorName: string,
  dateCount: number,
  scheduleCount: number
): Promise<void> {
  const teamLeads = await prisma.user.findMany({
    where: { role: "TEAM_LEAD" },
    select: { id: true },
  });
  if (teamLeads.length === 0) return;

  const message = `${instructorName} 강사가 개인일정 ${dateCount}일(${scheduleCount}건)을 일괄 등록했습니다.`;

  await prisma.notification.createMany({
    data: teamLeads.map((u) => ({
      recipientId: u.id,
      message,
    })),
  });
}

/**
 * 일반 사용자가 강의를 신청하면, 확정 권한이 있는 대상(신청 대상 강사 본인 + 모든 팀장)에게
 * 알림을 남긴다. 신청 즉시 스케줄이 "가신청" 상태로 그 시간을 점유하므로, 확인 후 확정/거절이
 * 필요하다는 점을 알린다.
 */
export async function notifyLectureRequestCreated(params: {
  scheduleId: number;
  instructorId: number;
  instructorName: string;
  lectureTypeName: string;
  date: Date;
  timeBlock: keyof typeof TIME_BLOCK_LABEL;
}): Promise<void> {
  const recipients = await prisma.user.findMany({
    where: {
      OR: [{ role: "TEAM_LEAD" }, { role: "MANAGER" }, { instructorId: params.instructorId }],
    },
    select: { id: true },
  });
  if (recipients.length === 0) return;

  const message = `${params.instructorName} 강사 앞으로 [${params.lectureTypeName}] 강의 신청이 접수되었습니다 (가신청): ${params.date
    .toISOString()
    .slice(0, 10)} ${TIME_BLOCK_LABEL[params.timeBlock]}. 확정/거절이 필요합니다.`;

  await prisma.notification.createMany({
    data: recipients.map((u) => ({
      recipientId: u.id,
      message,
      scheduleId: params.scheduleId,
    })),
  });
}

/** 강의 신청이 확정/거절되면 신청한 일반 사용자에게 결과를 알린다. */
export async function notifyLectureRequestResolved(params: {
  requesterUserId: number;
  lectureTypeName: string;
  instructorName: string;
  date: Date;
  timeBlock: keyof typeof TIME_BLOCK_LABEL;
  confirmed: boolean;
}): Promise<void> {
  const message = params.confirmed
    ? `[${params.lectureTypeName}] ${params.instructorName} 강사 강의 신청이 확정되었습니다: ${params.date
        .toISOString()
        .slice(0, 10)} ${TIME_BLOCK_LABEL[params.timeBlock]}`
    : `[${params.lectureTypeName}] ${params.instructorName} 강사 강의 신청이 거절되었습니다: ${params.date
        .toISOString()
        .slice(0, 10)} ${TIME_BLOCK_LABEL[params.timeBlock]}`;

  await prisma.notification.create({
    data: { recipientId: params.requesterUserId, message },
  });
}
