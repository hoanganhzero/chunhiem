"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSchoolAdmin } from "@/lib/auth";
import { optStr, str } from "@/lib/utils";
import type { ActionResult } from "./types";

export async function createTeacher(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { schoolId } = await requireSchoolAdmin();
  const email = str(form, "email").toLowerCase();
  const name = str(form, "name");
  const password = str(form, "password");
  const role = str(form, "role") === "SCHOOL_ADMIN" ? "SCHOOL_ADMIN" : "TEACHER";
  if (!email || !name) return { error: "Vui lòng nhập họ tên và email" };
  if (password.length < 8) return { error: "Mật khẩu tối thiểu 8 ký tự" };
  if (await db.user.findUnique({ where: { email } })) return { error: "Email đã được sử dụng" };
  await db.user.create({
    data: { schoolId, email, name, role, phone: optStr(form, "phone"), passwordHash: await bcrypt.hash(password, 10) },
  });
  revalidatePath("/school/teachers");
  return { ok: `Đã thêm ${name}` };
}

export async function resetTeacherPassword(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { schoolId } = await requireSchoolAdmin();
  const id = str(form, "id");
  const password = str(form, "password");
  if (password.length < 8) return { error: "Mật khẩu tối thiểu 8 ký tự" };
  const res = await db.user.updateMany({
    where: { id, schoolId },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  return res.count ? { ok: "Đã đặt lại mật khẩu" } : { error: "Không tìm thấy tài khoản" };
}

export async function toggleTeacher(form: FormData) {
  const { user, schoolId } = await requireSchoolAdmin();
  const id = str(form, "id");
  if (id === user.id) return;
  const t = await db.user.findFirst({ where: { id, schoolId } });
  if (!t) return;
  await db.user.update({ where: { id }, data: { active: !t.active } });
  revalidatePath("/school/teachers");
}

export async function createAcademicYear(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { schoolId } = await requireSchoolAdmin();
  const name = str(form, "name");
  if (!/^\d{4}-\d{4}$/.test(name)) return { error: "Năm học có dạng 2026-2027" };
  if (await db.academicYear.findUnique({ where: { schoolId_name: { schoolId, name } } }))
    return { error: "Năm học đã tồn tại" };
  await db.$transaction([
    db.academicYear.updateMany({ where: { schoolId }, data: { isCurrent: false } }),
    db.academicYear.create({ data: { schoolId, name, isCurrent: true } }),
  ]);
  revalidatePath("/school/classes");
  return { ok: `Đã tạo năm học ${name} và đặt làm năm hiện tại` };
}

export async function setCurrentYear(form: FormData) {
  const { schoolId } = await requireSchoolAdmin();
  const id = str(form, "id");
  await db.$transaction([
    db.academicYear.updateMany({ where: { schoolId }, data: { isCurrent: false } }),
    db.academicYear.updateMany({ where: { id, schoolId }, data: { isCurrent: true } }),
  ]);
  revalidatePath("/school/classes");
}

export async function createClass(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { schoolId } = await requireSchoolAdmin();
  const name = str(form, "name").toUpperCase();
  const grade = Number(str(form, "grade"));
  const academicYearId = str(form, "academicYearId");
  const homeroomTeacherId = optStr(form, "homeroomTeacherId");
  if (!name || !Number.isInteger(grade) || grade < 1 || grade > 12) return { error: "Tên lớp / khối không hợp lệ" };
  const year = await db.academicYear.findFirst({ where: { id: academicYearId, schoolId } });
  if (!year) return { error: "Chưa chọn năm học" };
  if (homeroomTeacherId && !(await db.user.findFirst({ where: { id: homeroomTeacherId, schoolId } })))
    return { error: "Giáo viên không hợp lệ" };
  if (await db.class.findUnique({ where: { academicYearId_name: { academicYearId, name } } }))
    return { error: `Lớp ${name} đã có trong năm học ${year.name}` };
  await db.class.create({ data: { schoolId, academicYearId, name, grade, homeroomTeacherId } });
  revalidatePath("/school/classes");
  return { ok: `Đã tạo lớp ${name}` };
}

export async function assignHomeroom(form: FormData) {
  const { schoolId } = await requireSchoolAdmin();
  const id = str(form, "id");
  const homeroomTeacherId = optStr(form, "homeroomTeacherId");
  if (homeroomTeacherId && !(await db.user.findFirst({ where: { id: homeroomTeacherId, schoolId } }))) return;
  await db.class.updateMany({ where: { id, schoolId }, data: { homeroomTeacherId } });
  revalidatePath("/school/classes");
}
