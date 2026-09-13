-- CreateEnum
CREATE TYPE "LockerSize" AS ENUM ('SMALL', 'MEDIUM', 'LARGE');

-- CreateTable
CREATE TABLE "locker" (
    "id" TEXT NOT NULL,
    "size" "LockerSize" NOT NULL,
    "occupied_by" TEXT,

    CONSTRAINT "locker_pkey" PRIMARY KEY ("id")
);
