/** Prisma client singleton. Falls back to an in-memory store when DATABASE_URL is absent so local dev works without a DB (§86). */
import { PrismaClient } from '@prisma/client';

declare global { var _prisma: PrismaClient | undefined; }

export function hasDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export const db = global._prisma ?? (hasDatabase() ? new PrismaClient() : (null as unknown as PrismaClient));
if (hasDatabase()) global._prisma = db;
