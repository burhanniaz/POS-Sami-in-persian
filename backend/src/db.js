import { PrismaClient } from "@prisma/client";

// Single shared Prisma client — single source of truth against the shared PostgreSQL DB.
export const prisma = new PrismaClient();
