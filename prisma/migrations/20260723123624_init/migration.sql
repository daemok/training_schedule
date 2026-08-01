-- CreateTable
CREATE TABLE "instructors" (
    "instructor_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "team" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "schedules" (
    "schedule_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "instructor_id" INTEGER NOT NULL,
    "date" DATETIME NOT NULL,
    "time_block" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "schedule_type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "location" TEXT,
    "memo" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "schedules_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors" ("instructor_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "schedules_instructor_id_date_idx" ON "schedules"("instructor_id", "date");
