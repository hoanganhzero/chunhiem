"use server";

import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SESSION_COOKIE, cookieOptions, signSession } from "@/lib/session";
import { requireUser } from "@/lib/auth";
import { str } from "@/lib/utils";
import type { ActionResult } from "./types";

export async function login(_: ActionResult, form: FormData): Promise<ActionResult> {
  const email = str(form, "email").toLowerCase();
  const password = str(form, "password");
  const user = await db.user.findUnique({ where: { email }, include: { school: true } });
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
    return { error: "Email hoặc mật khẩu không đúng" };
  }
  if (!user.active || (user.school && !user.school.active)) {
    return { error: "Tài khoản đã bị khoá" };
  }
  (await cookies()).set(SESSION_COOKIE, await signSession({ userId: user.id }), cookieOptions);
  redirect("/dashboard");
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
  const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
  if (!(await bcrypt.compare(current, user.passwordHash))) return { error: "Mật khẩu hiện tại không đúng" };
  await db.user.update({ where: { id: me.id }, data: { passwordHash: await bcrypt.hash(next, 10) } });
  return { ok: "Đã đổi mật khẩu" };
}
