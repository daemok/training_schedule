-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "recipient_id" INTEGER NOT NULL,
    "message" TEXT NOT NULL,
    "schedule_id" INTEGER,
    "is_read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users" ("user_id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "notifications_recipient_id_is_read_idx" ON "notifications"("recipient_id", "is_read");
