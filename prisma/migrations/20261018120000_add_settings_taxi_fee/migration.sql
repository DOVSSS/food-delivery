-- Taxi price is set separately from food delivery fee; service fee does not apply to taxi
ALTER TABLE "settings" ADD COLUMN "taxi_fee" INTEGER NOT NULL DEFAULT 200;
