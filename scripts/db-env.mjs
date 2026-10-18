/**
 * Chuẩn hoá biến môi trường CSDL rồi chạy lệnh, vd: node scripts/db-env.mjs prisma migrate deploy
 * Nhận tên biến của tích hợp Neon / Supabase trên Vercel, nên không cần tự sao chép chuỗi kết nối:
 *   DATABASE_URL ← DATABASE_URL | POSTGRES_PRISMA_URL
 *   DIRECT_URL   ← DIRECT_URL | DATABASE_URL_UNPOOLED | POSTGRES_URL_NON_POOLING | DATABASE_URL
 */
import { spawnSync } from "node:child_process";

const env = process.env;
// Gán process.env.X = undefined sẽ thành chuỗi "undefined" → chỉ gán khi có giá trị
const pick = (...keys) => keys.map((k) => env[k]?.trim()).find(Boolean);
const url = pick("DATABASE_URL", "POSTGRES_PRISMA_URL");
const direct = pick("DIRECT_URL", "DATABASE_URL_UNPOOLED", "POSTGRES_URL_NON_POOLING") || url;
const args = process.argv.slice(2);
const optional = args[0] === "--optional"; // vercel-build: chưa có CSDL thì bỏ qua, để trang /setup báo thiếu gì
if (optional) args.shift();
if (!url) {
  console.error("\n✖ Thiếu chuỗi kết nối CSDL: đặt DATABASE_URL, hoặc trên Vercel vào Storage → Create Database → Neon → Connect.\n");
  if (optional) {
    console.error("⚠ Bỏ qua bước tạo bảng. Sau khi gắn CSDL, hãy Redeploy để tạo bảng.\n");
    process.exit(0);
  }
  process.exit(1);
}
for (const [k, v] of [["DATABASE_URL", url], ["DIRECT_URL", direct]]) {
  if (!/^postgres(ql)?:\/\//.test(v)) {
    console.error(`\n✖ ${k} phải bắt đầu bằng postgresql:// (đừng dán cả lệnh psql hay dấu nháy).\n`);
    process.exit(1);
  }
  env[k] = v;
}
const [cmd, ...rest] = args;
const r = spawnSync(cmd, rest, { stdio: "inherit", env, shell: process.platform === "win32" });
process.exit(r.status ?? 1);
