/**
 * Chuẩn hoá biến môi trường CSDL rồi chạy lệnh, vd: node scripts/db-env.mjs prisma migrate deploy
 * Nhận tên biến của tích hợp Neon / Supabase trên Vercel, nên không cần tự sao chép chuỗi kết nối:
 *   DATABASE_URL ← DATABASE_URL | POSTGRES_PRISMA_URL
 *   DIRECT_URL   ← DIRECT_URL | DATABASE_URL_UNPOOLED | POSTGRES_URL_NON_POOLING | DATABASE_URL
 */
import { spawnSync } from "node:child_process";

const env = process.env;
env.DATABASE_URL ||= env.POSTGRES_PRISMA_URL;
env.DIRECT_URL ||= env.DATABASE_URL_UNPOOLED || env.POSTGRES_URL_NON_POOLING || env.DATABASE_URL;
if (!env.DATABASE_URL) {
  console.error("Thiếu chuỗi kết nối CSDL: đặt DATABASE_URL (hoặc kết nối Neon / Supabase vào dự án Vercel).");
  process.exit(1);
}
const [cmd, ...args] = process.argv.slice(2);
const r = spawnSync(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
process.exit(r.status ?? 1);
