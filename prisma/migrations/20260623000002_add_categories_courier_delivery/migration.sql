-- Категории
CREATE TABLE "categories" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "name" TEXT NOT NULL,
  "slug" TEXT NOT NULL,
  "emoji" TEXT NOT NULL DEFAULT '🍽️',
  CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- Категория в Product
ALTER TABLE "product" ADD COLUMN "category_id" TEXT;
ALTER TABLE "product" ADD CONSTRAINT "product_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Курьер и геолокация в Order
ALTER TABLE "orders" ADD COLUMN "courier_id" TEXT;
ALTER TABLE "orders" ADD COLUMN "courier_lat" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "courier_lng" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "courier_updated_at" TIMESTAMP(3);
ALTER TABLE "orders" ADD CONSTRAINT "orders_courier_id_fkey"
  FOREIGN KEY ("courier_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "orders_courier_id_idx" ON "orders"("courier_id");

-- Стоимость доставки в Order
ALTER TABLE "orders" ADD COLUMN "delivery_fee" INTEGER NOT NULL DEFAULT 150;

-- OrderItem: productId и productImage опциональные
ALTER TABLE "order_items" ALTER COLUMN "product_id" DROP NOT NULL;
ALTER TABLE "order_items" ALTER COLUMN "product_image" DROP NOT NULL;
ALTER TABLE "order_items" DROP CONSTRAINT IF EXISTS "order_items_product_id_fkey";
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "product"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;