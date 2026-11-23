-- AlterTable
ALTER TABLE "orders" ADD COLUMN "service_fee" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "orders" ADD COLUMN "service_fee_settlement_id" TEXT;

-- Backfill: active food orders created before this migration still owe the fee once delivered.
-- Already delivered orders stay at 0 so past deliveries don't become debt.
UPDATE "orders" o
SET "service_fee" = GREATEST(
  0,
  o."total" - o."delivery_fee" - COALESCE(
    (SELECT SUM(i."price" * i."quantity") FROM "order_items" i WHERE i."orderId" = o."id"),
    0
  )
)
WHERE o."type" = 'FOOD'
  AND o."status" NOT IN ('DELIVERED', 'CANCELLED');

-- CreateTable
CREATE TABLE "service_fee_settlements" (
    "id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" INTEGER NOT NULL,
    "courier_name" TEXT NOT NULL,
    "courier_id" TEXT,
    "confirmed_by_id" TEXT,

    CONSTRAINT "service_fee_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "service_fee_settlements_courier_id_idx" ON "service_fee_settlements"("courier_id");

-- CreateIndex
CREATE INDEX "service_fee_settlements_created_at_idx" ON "service_fee_settlements"("created_at");

-- CreateIndex
CREATE INDEX "orders_service_fee_settlement_id_idx" ON "orders"("service_fee_settlement_id");

-- AddForeignKey
ALTER TABLE "service_fee_settlements" ADD CONSTRAINT "service_fee_settlements_courier_id_fkey" FOREIGN KEY ("courier_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_fee_settlements" ADD CONSTRAINT "service_fee_settlements_confirmed_by_id_fkey" FOREIGN KEY ("confirmed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "orders" ADD CONSTRAINT "orders_service_fee_settlement_id_fkey" FOREIGN KEY ("service_fee_settlement_id") REFERENCES "service_fee_settlements"("id") ON DELETE SET NULL ON UPDATE CASCADE;
