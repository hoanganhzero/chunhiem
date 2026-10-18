/**
 * Tạo (hoặc đặt lại mật khẩu) tài khoản Quản trị hệ thống — dùng khi triển khai lần đầu.
 *   npm run admin:create -- <tên đăng nhập> <mật khẩu>
 * Sau đó đăng nhập, vào "Đơn vị" để tạo trường / trung tâm và tài khoản quản trị của đơn vị.
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const [username, password] = process.argv.slice(2);
  if (!username || !password) {
    console.error("Cách dùng: npm run admin:create -- <tên đăng nhập> <mật khẩu>");
    process.exit(1);
  }
  if (password.length < 10) {
    console.error("Mật khẩu quản trị hệ thống tối thiểu 10 ký tự.");
    process.exit(1);
  }
  const db = new PrismaClient();
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await db.user.upsert({
    where: { username: username.toLowerCase() },
    update: { passwordHash, role: "SUPER_ADMIN", active: true, mustChangePassword: false },
    create: { username: username.toLowerCase(), name: "Quản trị hệ thống", role: "SUPER_ADMIN", passwordHash },
  });
  console.log(`Đã tạo / cập nhật quản trị hệ thống: ${user.username}`);
  await db.$disconnect();
}

main();
