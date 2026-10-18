import { PrismaClient } from "@prisma/client";

// Nhận cả tên biến của tích hợp Neon / Supabase trên Vercel (xem scripts/db-env.mjs)
const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
process.env.DIRECT_URL ||= process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || url;

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db = globalForPrisma.prisma ?? new PrismaClient({ datasourceUrl: url });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
