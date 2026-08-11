-- CreateTable
CREATE TABLE "monthly_announcements" (
    "announcement_id" SERIAL NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_announcements_pkey" PRIMARY KEY ("announcement_id")
);
