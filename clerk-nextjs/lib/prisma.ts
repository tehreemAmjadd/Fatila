import { PrismaClient } from "@prisma/client";

// Create a singleton to avoid multiple instances in dev
const globalForPrisma = global as typeof globalThis & {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ["query"], // optional: logs queries for debugging
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;