-- CreateTable
CREATE TABLE "schedule_delete_logs" (
    "log_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "schedule_id" INTEGER NOT NULL,
    "instructor_id" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "time_block" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "schedule_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "memo" TEXT,
    "deleted_by" INTEGER NOT NULL,
    "deleted_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "schedule_delete_logs_instructor_id_idx" ON "schedule_delete_logs"("instructor_id");
