-- Taxi orders: type FOOD|TAXI (default FOOD for existing rows), destination fields
ALTER TABLE "orders" ADD COLUMN "type" TEXT NOT NULL DEFAULT 'FOOD';
ALTER TABLE "orders" ADD COLUMN "destination_address" TEXT;
ALTER TABLE "orders" ADD COLUMN "destination_lat" DOUBLE PRECISION;
ALTER TABLE "orders" ADD COLUMN "destination_lng" DOUBLE PRECISION;

CREATE INDEX "orders_type_idx" ON "orders"("type");
