import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient() {
  // Nhận cả tên biến của tích hợp Neon / Supabase trên Vercel (xem scripts/db-env.mjs)
  const url = process.env.DATABASE_URL || process.env.POSTGRES_PRISMA_URL;
  const direct = process.env.DIRECT_URL || process.env.DATABASE_URL_UNPOOLED || process.env.POSTGRES_URL_NON_POOLING || url;
  if (direct) process.env.DIRECT_URL = direct; // gán undefined sẽ thành chuỗi "undefined"
  return new PrismaClient({ datasourceUrl: url });
}

function client() {
  return (globalForPrisma.prisma ??= createClient());
}

/**
 * Khởi tạo Prisma ở lần truy vấn đầu tiên thay vì lúc nạp module: nếu cấu hình CSDL sai,
 * lỗi nằm trong truy vấn (bắt được, trang /setup hiển thị) chứ không làm sập cả trang.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const c = client();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});
