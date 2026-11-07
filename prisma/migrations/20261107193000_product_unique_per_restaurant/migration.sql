-- Different restaurants must be able to add dishes with the same name.
-- Slug uniqueness is scoped to a restaurant instead of the whole table.
DROP INDEX IF EXISTS "product_name_key";
DROP INDEX IF EXISTS "product_slug_key";

CREATE UNIQUE INDEX "product_restaurantId_slug_key" ON "product"("restaurantId", "slug");
