ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "category_id" TEXT;

ALTER TABLE "product" DROP CONSTRAINT IF EXISTS "product_category_id_fkey";

ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;