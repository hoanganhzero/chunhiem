"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, cookieOptions, signSession } from "@/lib/session";
import { str } from "@/lib/utils";
import type { ActionResult } from "./types";

/**
 * Khởi tạo lần đầu trên web: tạo tài khoản Quản trị hệ thống khi CSDL chưa có tài khoản nào.
 * Nếu đặt biến môi trường SETUP_CODE thì phải nhập đúng mã này.
 */
export async function setupAdmin(_: ActionResult, form: FormData): Promise<ActionResult> {
  const code = process.env.SETUP_CODE;
  if (code && str(form, "code") !== code) return { error: "Mã khởi tạo không đúng" };
  const username = str(form, "username").toLowerCase();
  const name = str(form, "name") || "Quản trị hệ thống";
  const password = str(form, "password");
  if (!/^[a-z0-9._@-]{3,64}$/.test(username)) return { error: "Tên đăng nhập 3–64 ký tự, không dấu, không khoảng trắng" };
  if (password.length < 10) return { error: "Mật khẩu quản trị hệ thống tối thiểu 10 ký tự" };
  if (password !== str(form, "confirm")) return { error: "Nhập lại mật khẩu không khớp" };

  const passwordHash = await bcrypt.hash(password, 10);
  // Khoá theo giao dịch để hai yêu cầu đồng thời không cùng tạo được quản trị
  const user = await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(2026101801)`;
    if ((await tx.user.count()) > 0) return null;
    return tx.user.create({ data: { username, name, role: "SUPER_ADMIN", passwordHash } });
  });
  if (!user) return { error: "Hệ thống đã được khởi tạo. Vui lòng đăng nhập." };

  (await cookies()).set(SESSION_COOKIE, await signSession({ userId: user.id }), cookieOptions);
  redirect("/admin/schools");
}
