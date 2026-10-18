"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { AUTH_SECRET_ERROR, SESSION_COOKIE, authSecretReady, cookieOptions, signSession } from "@/lib/session";
import { requireUser } from "@/lib/auth";
import { str } from "@/lib/utils";
import type { ActionResult } from "./types";

export async function login(_: ActionResult, form: FormData): Promise<ActionResult> {
  if (!authSecretReady()) return { error: AUTH_SECRET_ERROR };
  const username = str(form, "username").toLowerCase();
  const password = str(form, "password");
  const user = await db.user.findUnique({ where: { username }, include: { school: true } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Tên đăng nhập hoặc mật khẩu không đúng" };
  }
  if (!user.active || (user.school && !user.school.active)) {
    return { error: "Tài khoản đã bị khoá" };
  }
  const token = await signSession({ userId: user.id, mcp: user.mustChangePassword });
  (await cookies()).set(SESSION_COOKIE, token, cookieOptions);
  redirect(user.mustChangePassword ? "/account" : "/dashboard");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

export async function changePassword(_: ActionResult, form: FormData): Promise<ActionResult> {
  const me = await requireUser();
  const current = str(form, "current");
  const next = str(form, "next");
  if (next.length < 8) return { error: "Mật khẩu mới phải có ít nhất 8 ký tự" };
  if (next !== str(form, "confirm")) return { error: "Nhập lại mật khẩu mới không khớp" };
  if (next === current) return { error: "Mật khẩu mới phải khác mật khẩu hiện tại" };
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id }, include: { school: true } });
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Mật khẩu hiện tại không đúng" };
  if (user.school && next === user.school.defaultPassword) return { error: "Không được dùng lại mật khẩu mặc định" };
  await db.user.update({
    where: { id: me.id },
    data: { passwordHash: await bcrypt.hash(next, 10), mustChangePassword: false },
  });
  (await cookies()).set(SESSION_COOKIE, await signSession({ userId: me.id }), cookieOptions);
  if (user.mustChangePassword) redirect("/dashboard");
  return { ok: "Đã đổi mật khẩu" };
}
