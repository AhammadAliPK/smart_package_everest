-- CreateTable
CREATE TABLE "pricing_config" (
    "size" "LockerSize" NOT NULL,
    "base_fee" INTEGER NOT NULL,

    CONSTRAINT "pricing_config_pkey" PRIMARY KEY ("size")
);

-- Seed ships inside the migration (AD-8: `migrate deploy` applies it with the
-- table, so no deploy can run fee-less). SMALL keeps the historical default
-- so existing stays price exactly as before; MEDIUM/LARGE differentiate.
INSERT INTO "pricing_config" ("size", "base_fee") VALUES ('SMALL', 10), ('MEDIUM', 15), ('LARGE', 20);
