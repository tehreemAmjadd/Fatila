/*
  Warnings:

  - You are about to drop the `lead` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "lead";
PRAGMA foreign_keys=on;

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "company" TEXT,
    "country" TEXT,
    "companySize" INTEGER,
    "score" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT NOT NULL DEFAULT 'Low',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
