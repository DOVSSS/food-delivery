CREATE TABLE "settings" (
  "id" TEXT NOT NULL DEFAULT 'default',
  "delivery_fee" INTEGER NOT NULL DEFAULT 150,
  "service_fee" INTEGER NOT NULL DEFAULT 50,
  CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "settings" ("id", "delivery_fee", "service_fee") 
VALUES ('default', 150, 50)
ON CONFLICT ("id") DO NOTHING;