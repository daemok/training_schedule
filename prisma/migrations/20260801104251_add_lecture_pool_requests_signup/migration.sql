-- CreateTable
CREATE TABLE "lecture_types" (
    "lecture_type_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "instructor_lecture_types" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instructor_id" INTEGER NOT NULL,
    "lecture_type_id" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "instructor_lecture_types_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors" ("instructor_id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "instructor_lecture_types_lecture_type_id_fkey" FOREIGN KEY ("lecture_type_id") REFERENCES "lecture_types" ("lecture_type_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "lecture_requests" (
    "lecture_request_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "requester_id" INTEGER NOT NULL,
    "instructor_id" INTEGER NOT NULL,
    "lecture_type_id" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "time_block" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "fc_los" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "attendee_count" INTEGER NOT NULL,
    "content" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "schedule_id" INTEGER,
    "confirmed_by_user_id" INTEGER,
    "confirmed_at" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "lecture_requests_requester_id_fkey" FOREIGN KEY ("requester_id") REFERENCES "users" ("user_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lecture_requests_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors" ("instructor_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lecture_requests_lecture_type_id_fkey" FOREIGN KEY ("lecture_type_id") REFERENCES "lecture_types" ("lecture_type_id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "lecture_requests_schedule_id_fkey" FOREIGN KEY ("schedule_id") REFERENCES "schedules" ("schedule_id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "lecture_requests_confirmed_by_user_id_fkey" FOREIGN KEY ("confirmed_by_user_id") REFERENCES "users" ("user_id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_schedule_delete_logs" (
    "log_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "schedule_id" INTEGER NOT NULL,
    "instructor_id" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "time_block" TEXT NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "schedule_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "memo" TEXT,
    "deleted_by" INTEGER NOT NULL,
    "deleted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_schedule_delete_logs" ("date", "deleted_at", "deleted_by", "end_time", "instructor_id", "location", "log_id", "memo", "schedule_id", "schedule_type", "start_time", "time_block", "title") SELECT "date", "deleted_at", "deleted_by", "end_time", "instructor_id", "location", "log_id", "memo", "schedule_id", "schedule_type", "start_time", "time_block", "title" FROM "schedule_delete_logs";
DROP TABLE "schedule_delete_logs";
ALTER TABLE "new_schedule_delete_logs" RENAME TO "schedule_delete_logs";
CREATE INDEX "schedule_delete_logs_instructor_id_idx" ON "schedule_delete_logs"("instructor_id");
CREATE TABLE "new_schedules" (
    "schedule_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instructor_id" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "time_block" TEXT NOT NULL,
    "start_time" TEXT,
    "end_time" TEXT,
    "schedule_type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'CONFIRMED',
    "title" TEXT NOT NULL,
    "location" TEXT,
    "memo" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "schedules_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors" ("instructor_id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_schedules" ("created_at", "date", "end_time", "instructor_id", "location", "memo", "schedule_id", "schedule_type", "start_time", "time_block", "title", "updated_at") SELECT "created_at", "date", "end_time", "instructor_id", "location", "memo", "schedule_id", "schedule_type", "start_time", "time_block", "title", "updated_at" FROM "schedules";
DROP TABLE "schedules";
ALTER TABLE "new_schedules" RENAME TO "schedules";
CREATE INDEX "schedules_instructor_id_date_idx" ON "schedules"("instructor_id", "date");
CREATE TABLE "new_users" (
    "user_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'APPROVED',
    "name" TEXT,
    "instructor_id" INTEGER,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "users_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors" ("instructor_id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_users" ("created_at", "email", "instructor_id", "password_hash", "role", "updated_at", "user_id") SELECT "created_at", "email", "instructor_id", "password_hash", "role", "updated_at", "user_id" FROM "users";
DROP TABLE "users";
ALTER TABLE "new_users" RENAME TO "users";
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");
CREATE UNIQUE INDEX "users_instructor_id_key" ON "users"("instructor_id");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

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
