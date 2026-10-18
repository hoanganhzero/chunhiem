"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { optStr, str } from "@/lib/utils";
import type { ActionResult } from "./types";

/** SUPER_ADMIN: tạo trường mới kèm tài khoản quản trị trường đầu tiên. */
export async function createSchool(_: ActionResult, form: FormData): Promise<ActionResult> {
  await requireUser("SUPER_ADMIN");
  const code = str(form, "code").toUpperCase();
  const name = str(form, "name");
  const adminEmail = str(form, "adminEmail").toLowerCase();
  const adminName = str(form, "adminName");
  const adminPassword = str(form, "adminPassword");
  if (!/^[A-Z0-9_-]{2,20}$/.test(code)) return { error: "Mã trường chỉ gồm chữ, số, - _ (2–20 ký tự)" };
  if (!name || !adminEmail || !adminName) return { error: "Vui lòng nhập đủ thông tin" };
  if (adminPassword.length < 8) return { error: "Mật khẩu tối thiểu 8 ký tự" };
  if (await db.school.findUnique({ where: { code } })) return { error: "Mã trường đã tồn tại" };
  if (await db.user.findUnique({ where: { email: adminEmail } })) return { error: "Email đã được sử dụng" };

  await db.school.create({
    data: {
      code,
      name,
      address: optStr(form, "address"),
      users: {
        create: {
          email: adminEmail,
          name: adminName,
          role: "SCHOOL_ADMIN",
          passwordHash: await bcrypt.hash(adminPassword, 10),
        },
      },
    },
  });
  revalidatePath("/admin/schools");
  return { ok: `Đã tạo trường ${name}` };
}

export async function toggleSchool(form: FormData) {
  await requireUser("SUPER_ADMIN");
  const id = str(form, "id");
  const school = await db.school.findUniqueOrThrow({ where: { id } });
  await db.school.update({ where: { id }, data: { active: !school.active } });
  revalidatePath("/admin/schools");
}
