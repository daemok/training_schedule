-- Instructor <-> LectureBrand becomes many-to-many (an instructor can belong to 2+ brands).
-- Create the join table first and backfill it from the existing single brandId column, then
-- drop the old column/FK/index — this preserves every instructor's current brand assignment.

-- CreateTable
CREATE TABLE "instructor_lecture_brands" (
    "id" SERIAL NOT NULL,
    "instructor_id" INTEGER NOT NULL,
    "lecture_brand_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "instructor_lecture_brands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "instructor_lecture_brands_instructor_id_lecture_brand_id_key" ON "instructor_lecture_brands"("instructor_id", "lecture_brand_id");

-- AddForeignKey
ALTER TABLE "instructor_lecture_brands" ADD CONSTRAINT "instructor_lecture_brands_instructor_id_fkey" FOREIGN KEY ("instructor_id") REFERENCES "instructors"("instructor_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "instructor_lecture_brands" ADD CONSTRAINT "instructor_lecture_brands_lecture_brand_id_fkey" FOREIGN KEY ("lecture_brand_id") REFERENCES "lecture_brands"("lecture_brand_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill: copy every instructor's existing single brand into the join table.
INSERT INTO "instructor_lecture_brands" ("instructor_id", "lecture_brand_id")
SELECT "instructor_id", "lecture_brand_id" FROM "instructors" WHERE "lecture_brand_id" IS NOT NULL;

-- DropForeignKey
ALTER TABLE "instructors" DROP CONSTRAINT "instructors_lecture_brand_id_fkey";

-- DropIndex
DROP INDEX "instructors_lecture_brand_id_idx";

-- AlterTable
ALTER TABLE "instructors" DROP COLUMN "lecture_brand_id";
