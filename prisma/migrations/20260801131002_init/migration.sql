-- CreateEnum
CREATE TYPE "InstructorStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "TimeBlock" AS ENUM ('MORNING', 'AFTERNOON', 'EVENING');

-- CreateEnum
CREATE TYPE "ScheduleType" AS ENUM ('LECTURE', 'PERSONAL');

-- CreateEnum
CREATE TYPE "ScheduleStatus" AS ENUM ('CONFIRMED', 'PROVISIONAL');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('INSTRUCTOR', 'TEAM_LEAD', 'MANAGER', 'GENERAL');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "LectureRequestStatus" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED');

-- CreateTable
CREATE TABLE "instructors" (
    "instructor_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "status" "InstructorStatus" NOT NULL DEFAULT 'ACTIVE',
    "team" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "instructors_pkey" PRIMARY KEY ("instructor_id")
);

-- CreateTable
CREATE TABLE "users" (
    "user_id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'APPROVED',
    "name" TEXT,
    "instructor_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("user_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" SERIAL NOT NULL,
    "recipient_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "schedule_id" INTEGER,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateTable
CREATE TABLE "schedules" (
    "schedule_id" SERIAL NOT NULL,
    "instructor_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time_block" "TimeBlock" NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "schedule_type" "ScheduleType" NOT NULL,
    "status" "ScheduleStatus" NOT NULL DEFAULT 'CONFIRMED',
    "title" TEXT NOT NULL,
    "location" TEXT,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "schedules_pkey" PRIMARY KEY ("schedule_id")
);

-- CreateTable
CREATE TABLE "schedule_delete_logs" (
    "log_id" SERIAL NOT NULL,
    "schedule_id" INTEGER NOT NULL,
    "instructor_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time_block" "TimeBlock" NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "schedule_type" "ScheduleType" NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "memo" TEXT,
    "deleted_by" INTEGER NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_delete_logs_pkey" PRIMARY KEY ("log_id")
);

-- CreateTable
CREATE TABLE "lecture_types" (
    "lecture_type_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lecture_types_pkey" PRIMARY KEY ("lecture_type_id")
);

-- CreateTable
CREATE TABLE "instructor_lecture_types" (
    "id" SERIAL NOT NULL,
    "instructor_id" INTEGER NOT NULL,
    "lecture_type_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_lecture_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lecture_requests" (
    "lecture_request_id" SERIAL NOT NULL,
    "requester_id" INTEGER NOT NULL,
    "instructor_id" INTEGER NOT NULL,
    "lecture_type_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time_block" "TimeBlock" NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "fc_los" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "attendee_count" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "status" "LectureRequestStatus" NOT NULL DEFAULT 'PENDING',
    "schedule_id" INTEGER,
    "confirmed_by_user_id" INTEGER,
    "confirmed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lecture_requests_pkey" PRIMARY KEY ("lecture_request_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_instructor_id_key" ON "users"("instructor_id");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_is_read_idx" ON "notifications"("recipient_id", "is_read");

-- CreateIndex
CREATE INDEX "schedules_instructor_id_date_idx" ON "schedules"("instructor_id", "date");

-- CreateIndex
CREATE INDEX "schedule_delete_logs_instructor_id_idx" ON "schedule_delete_logs"("instructor_id");

-- CreateIndex
CREATE UNIQUE INDEX "lecture_types_name_key" ON "lecture_types"("name");

-- CreateIndex
CREATE UNIQUE INDEX "instructor_lecture_types_instructor_id_lecture_type_id_key" ON "instructor_lecture_types"("instructor_id", "lecture_type_id");

-- CreateIndex
CREATE UNIQUE INDEX "lecture_requests_schedule_id_key" ON "lecture_requests"("schedule_id");

-- CreateIndex
CREATE INDEX "lecture_requests_instructor_id_date_idx" ON "lecture_requests"("instructor_id", "date");

-- CreateIndex
CREATE INDEX "lecture_requests_requester_id_idx" ON "lecture_requests"("requester_id");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("instructor_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("user_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("instructor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_lecture_types" ADD CONSTRAINT "instructor_lecture_types_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("instructor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_lecture_types" ADD CONSTRAINT "instructor_lecture_types_lecture_type_id_fkey" FOREIGN KEY ("lecture_type_id") REFERENCES "lecture_types"("lecture_type_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_requests" ADD CONSTRAINT "lecture_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_requests" ADD CONSTRAINT "lecture_requests_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("instructor_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_requests" ADD CONSTRAINT "lecture_requests_lecture_type_id_fkey" FOREIGN KEY ("lecture_type_id") REFERENCES "lecture_types"("lecture_type_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_requests" ADD CONSTRAINT "lecture_requests_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules"("schedule_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lecture_requests" ADD CONSTRAINT "lecture_requests_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users"("user_id") ON DELETE SET NULL ON UPDATE CASCADE;
