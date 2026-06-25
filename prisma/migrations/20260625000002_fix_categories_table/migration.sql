CREATE TABLE IF NOT EXISTS "categories" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "emoji" TEXT NOT NULL DEFAULT '🍽️',
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "categories_name_key" ON "categories"("name");
CREATE UNIQUE INDEX IF NOT EXISTS "categories_slug_key" ON "categories"("slug");

ALTER TABLE "product" ADD COLUMN IF NOT EXISTS "category_id" TEXT;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'product_category_id_fkey'
  ) THEN
    ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey"
      FOREIGN KEY ("category_id") REFERENCES "categories"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;