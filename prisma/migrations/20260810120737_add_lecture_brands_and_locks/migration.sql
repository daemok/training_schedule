-- CreateTable
CREATE TABLE "lecture_brands" (
    "lecture_brand_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lecture_brands_pkey" PRIMARY KEY ("lecture_brand_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "lecture_brands_name_key" ON "lecture_brands"("name");

-- Backfill: create a legacy brand and migrate any existing lecture types under it
-- (unlimited application period — nulls, matches "무제한" for pre-existing data).
INSERT INTO "lecture_brands" ("name", "is_active", "updated_at")
VALUES ('레거시', true, CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "lecture_types" ADD COLUMN     "application_end_date" TIMESTAMP(3),
ADD COLUMN     "application_start_date" TIMESTAMP(3),
ADD COLUMN     "lecture_brand_id" INTEGER;

UPDATE "lecture_types"
SET "lecture_brand_id" = (SELECT "lecture_brand_id" FROM "lecture_brands" WHERE "name" = '레거시');

ALTER TABLE "lecture_types" ALTER COLUMN "lecture_brand_id" SET NOT NULL;

-- CreateTable
CREATE TABLE "request_locks" (
    "request_lock_id" SERIAL NOT NULL,
    "instructor_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "time_block" "TimeBlock" NOT NULL,
    "locked_by_user_id" INTEGER NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "request_locks_pkey" PRIMARY KEY ("request_lock_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "request_locks_instructor_id_date_time_block_key" ON "request_locks"("instructor_id", "date", "time_block");

-- CreateIndex
CREATE INDEX "lecture_types_lecture_brand_id_idx" ON "lecture_types"("lecture_brand_id");

-- AddForeignKey
ALTER TABLE "lecture_types" ADD CONSTRAINT "lecture_types_lecture_brand_id_fkey" FOREIGN KEY ("lecture_brand_id") REFERENCES "lecture_brands"("lecture_brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;
