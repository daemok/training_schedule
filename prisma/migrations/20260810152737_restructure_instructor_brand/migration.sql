-- Replace Instructor.team (free-text) with Instructor.brandId (FK to lecture_brands),
-- and remove the brand relation from lecture_types (brand is now solely an instructor
-- affiliation, no longer a lecture-program category).

-- AlterTable: add nullable brand column to instructors first (existing rows need backfill)
ALTER TABLE "instructors" ADD COLUMN "lecture_brand_id" INTEGER;

-- Backfill: create one brand per distinct existing team value (preserves current groupings;
-- team_leads/managers can rename or consolidate these afterward from 강사 및 강의 관리).
INSERT INTO "lecture_brands" ("name", "is_active", "updated_at")
SELECT DISTINCT i."team", true, CURRENT_TIMESTAMP
FROM "instructors" i
WHERE NOT EXISTS (
  SELECT 1 FROM "lecture_brands" b WHERE b."name" = i."team"
);

UPDATE "instructors" i
SET "lecture_brand_id" = b."lecture_brand_id"
FROM "lecture_brands" b
WHERE b."name" = i."team";

ALTER TABLE "instructors" ALTER COLUMN "lecture_brand_id" SET NOT NULL;

-- DropColumn
ALTER TABLE "instructors" DROP COLUMN "team";

-- CreateIndex
CREATE INDEX "instructors_lecture_brand_id_idx" ON "instructors"("lecture_brand_id");

-- AddForeignKey
ALTER TABLE "instructors" ADD CONSTRAINT "instructors_lecture_brand_id_fkey" FOREIGN KEY ("lecture_brand_id") REFERENCES "lecture_brands"("lecture_brand_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DropForeignKey
ALTER TABLE "lecture_types" DROP CONSTRAINT "lecture_types_lecture_brand_id_fkey";

-- DropIndex
DROP INDEX "lecture_types_lecture_brand_id_idx";

-- AlterTable
ALTER TABLE "lecture_types" DROP COLUMN "lecture_brand_id";
