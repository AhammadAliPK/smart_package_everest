-- CreateEnum
CREATE TYPE "PackageStatus" AS ENUM ('STORED', 'RETRIEVED');

-- CreateTable
CREATE TABLE "stored_package" (
    "id" TEXT NOT NULL,
    "pickup_code" TEXT NOT NULL,
    "customer_ref" TEXT,
    "stored_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retrieved_at" TIMESTAMP(3),
    "status" "PackageStatus" NOT NULL DEFAULT 'STORED',

    CONSTRAINT "stored_package_pkey" PRIMARY KEY ("id")
);

-- CreateIndex (AD-6): a pickup code is unique among *unretrieved* packages —
-- partial, so RETRIEVED rows release their code for no reuse confusion while
-- active codes stay collision-free.
CREATE UNIQUE INDEX "stored_package_pickup_code_stored_key"
    ON "stored_package"("pickup_code")
    WHERE "status" = 'STORED';

-- CreateIndex (AD-8): one package per locker is a schema fact — occupied_by
-- may reference at most one active package, so a lost CAS race cannot
-- double-occupy a locker.
CREATE UNIQUE INDEX "locker_occupied_by_active_key"
    ON "locker"("occupied_by")
    WHERE "occupied_by" IS NOT NULL;
