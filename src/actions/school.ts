"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireSchoolAdmin, type CurrentUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { SCHOOL_TYPES, SCHOOL_VIEW_ROLES, type Role } from "@/lib/constants";
import { provisionStudents, resetToDefault, summarize, type ProvisionItem } from "@/lib/accounts";
import { STUDENT_COLUMNS, TEACHER_COLUMNS, normKey, readTable, toStudentInput } from "@/lib/excel";
import { optStr, str } from "@/lib/utils";
import type { ActionResult } from "./types";

async function currentYear(schoolId: string) {
  return db.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
}

/** Tìm lớp theo tên trong năm học; chưa có thì tạo (khối lấy từ chữ số đầu tên lớp). */
async function ensureClass(schoolId: string, academicYearId: string, rawName: string) {
  const name = rawName.replace(/\s/g, "").toUpperCase();
  const found = await db.class.findUnique({ where: { academicYearId_name: { academicYearId, name } } });
  if (found) return found;
  const grade = Number(name.match(/^\d{1,2}/)?.[0]);
  if (!grade || grade > 12) return null;
  return db.class.create({ data: { schoolId, academicYearId, name, grade } });
}

// ---------- Cài đặt trường ----------

export async function updateSchoolSettings(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { schoolId } = await requireSchoolAdmin(["SCHOOL_ADMIN"]);
  const type = str(form, "type");
  const name = str(form, "name");
  const defaultPassword = str(form, "defaultPassword");
  if (!name) return { error: "Tên trường không được để trống" };
  if (defaultPassword.length < 6) return { error: "Mật khẩu mặc định tối thiểu 6 ký tự" };
  await db.school.update({
    where: { id: schoolId },
    data: {
      name, defaultPassword,
      ...(type in SCHOOL_TYPES ? { type } : {}),
      address: optStr(form, "address"), phone: optStr(form, "phone"), authority: optStr(form, "authority"),
      principal: optStr(form, "principal"), location: optStr(form, "location"),
    },
  });
  revalidatePath("/school/settings");
  return { ok: "Đã lưu cài đặt" };
}

// ---------- Giáo viên & cán bộ ----------

/**
 * Quản trị được cấp mọi vai trò cán bộ; giáo vụ chỉ được tạo / quản lý tài khoản giáo viên
 * (tránh tự nâng quyền bằng cách đặt lại mật khẩu tài khoản quản trị / BGH).
 */
function assignableRoles(user: CurrentUser): Role[] {
  return user.role === "SCHOOL_ADMIN" ? ["TEACHER", "ACADEMIC", "LEADER", "SCHOOL_ADMIN"] : ["TEACHER"];
}
function canManageAccount(user: CurrentUser, targetRole: string) {
  if (user.role === "SCHOOL_ADMIN") return true;
  return !["SCHOOL_ADMIN", "LEADER", "ACADEMIC", "SUPER_ADMIN"].includes(targetRole);
}
/** Vai trò từ cột "Vai trò" trong Excel */
function roleFromText(text: string): Role {
  const k = normKey(text);
  if (k.includes("quantri")) return "SCHOOL_ADMIN";
  if (k.includes("giamhieu") || k.includes("giamdoc") || k === "bgh" || k === "bgd") return "LEADER";
  if (k.includes("giaovu")) return "ACADEMIC";
  return "TEACHER";
}

export async function createTeacher(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, schoolId } = await requireSchoolAdmin();
  const username = str(form, "username").toLowerCase();
  const name = str(form, "name");
  const role = (str(form, "role") || "TEACHER") as Role;
  if (!assignableRoles(user).includes(role)) return { error: "Bạn không có quyền cấp vai trò này" };
  if (!username || !name) return { error: "Vui lòng nhập họ tên và email" };
  if (await db.user.findUnique({ where: { username } })) return { error: "Tên đăng nhập / email đã được sử dụng" };
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  await db.user.create({
    data: {
      schoolId, username, email: username.includes("@") ? username : null, name, role, phone: optStr(form, "phone"),
      passwordHash: await bcrypt.hash(school.defaultPassword, 10), mustChangePassword: true,
    },
  });
  revalidatePath("/school/teachers");
  return { ok: `Đã thêm ${name} — mật khẩu ban đầu: ${school.defaultPassword}` };
}

export async function importTeachers(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user: me, schoolId } = await requireSchoolAdmin();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Chưa chọn tệp" };
  const { rows, error } = await readTable(file, TEACHER_COLUMNS, ["name", "username"]);
  if (error) return { error };
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  const year = await currentYear(schoolId);
  const passwordHash = await bcrypt.hash(school.defaultPassword, 10);
  let created = 0, updated = 0, assigned = 0;
  const errors: string[] = [];
  for (const { row, values: v } of rows) {
    const username = v.username.toLowerCase();
    if (!/^[^\s@]+@[^\s@]+$/.test(username)) { errors.push(`Dòng ${row}: email không hợp lệ`); continue; }
    const role = roleFromText(v.role);
    if (!assignableRoles(me).includes(role)) { errors.push(`Dòng ${row}: không có quyền cấp vai trò "${v.role}"`); continue; }
    const existing = await db.user.findUnique({ where: { username } });
    if (existing && existing.schoolId !== schoolId) { errors.push(`Dòng ${row}: ${username} thuộc đơn vị khác`); continue; }
    if (existing && !canManageAccount(me, existing.role)) { errors.push(`Dòng ${row}: không có quyền sửa tài khoản ${username}`); continue; }
    const user = existing
      ? await db.user.update({ where: { id: existing.id }, data: { name: v.name, phone: v.phone || existing.phone } })
      : await db.user.create({
          data: { schoolId, username, email: username, name: v.name, phone: v.phone || null, role, passwordHash, mustChangePassword: true },
        });
    existing ? updated++ : created++;
    if (v.className) {
      if (!year) { errors.push(`Dòng ${row}: chưa có năm học hiện tại để phân công chủ nhiệm`); continue; }
      const cls = await ensureClass(schoolId, year.id, v.className);
      if (!cls) { errors.push(`Dòng ${row}: tên lớp "${v.className}" không hợp lệ`); continue; }
      await db.class.update({ where: { id: cls.id }, data: { homeroomTeacherId: user.id } });
      assigned++;
    }
  }
  revalidatePath("/school/teachers");
  const msg = `Thêm mới ${created}, cập nhật ${updated} giáo viên, phân công chủ nhiệm ${assigned} lớp. Mật khẩu ban đầu: ${school.defaultPassword}.`;
  return errors.length ? { error: `${msg} Lỗi: ${errors.slice(0, 8).join("; ")}` } : { ok: msg };
}

/** Đặt lại mật khẩu bất kỳ tài khoản trong trường về mật khẩu mặc định. */
export async function resetPasswordToDefault(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, schoolId } = await requireSchoolAdmin();
  const target = await db.user.findFirst({ where: { id: str(form, "id"), schoolId } });
  if (!target) return { error: "Không tìm thấy tài khoản" };
  if (!canManageAccount(user, target.role)) return { error: "Bạn không có quyền đặt lại mật khẩu tài khoản này" };
  const res = await resetToDefault([target.id], schoolId);
  return res.count ? { ok: "Đã đặt lại về mật khẩu mặc định" } : { error: "Không tìm thấy tài khoản" };
}

export async function toggleTeacher(form: FormData) {
  const { user, schoolId } = await requireSchoolAdmin();
  const id = str(form, "id");
  if (id === user.id) return;
  const t = await db.user.findFirst({ where: { id, schoolId } });
  if (!t || !canManageAccount(user, t.role)) return;
  await db.user.update({ where: { id }, data: { active: !t.active } });
  revalidatePath("/school/teachers");
}

// ---------- Năm học & lớp ----------

export async function createAcademicYear(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { schoolId } = await requireSchoolAdmin();
  const name = str(form, "name");
  const m = name.match(/^(\d{4})-(\d{4})$/);
  if (!m || +m[2] !== +m[1] + 1) return { error: "Năm học có dạng 2026-2027" };
  if (await db.academicYear.findUnique({ where: { schoolId_name: { schoolId, name } } }))
    return { error: "Năm học đã tồn tại" };
  await db.$transaction([
    db.academicYear.updateMany({ where: { schoolId }, data: { isCurrent: false } }),
    db.academicYear.create({
      data: { schoolId, name, isCurrent: true, semester2Start: new Date(Date.UTC(+m[2], 0, 15)) },
    }),
  ]);
  revalidatePath("/school/classes");
  return { ok: `Đã tạo năm học ${name} và đặt làm năm hiện tại` };
}

export async function updateSemester2Start(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { schoolId } = await requireSchoolAdmin();
  const d = new Date(str(form, "semester2Start") + "T00:00:00Z");
  if (isNaN(d.getTime())) return { error: "Ngày không hợp lệ" };
  await db.academicYear.updateMany({ where: { id: str(form, "id"), schoolId }, data: { semester2Start: d } });
  revalidatePath("/school/classes");
  return { ok: "Đã lưu ngày bắt đầu học kỳ II" };
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
  const name = str(form, "name").replace(/\s/g, "").toUpperCase();
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

// ---------- Nhập học sinh toàn trường ----------

export async function importSchoolStudents(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { schoolId } = await requireSchoolAdmin();
  const year = await currentYear(schoolId);
  if (!year) return { error: "Chưa có năm học hiện tại. Hãy tạo năm học trước." };
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Chưa chọn tệp" };
  if (file.size > 10_000_000) return { error: "Tệp quá lớn (tối đa 10MB)" };
  const { rows, error } = await readTable(file, STUDENT_COLUMNS, ["className", "code", "fullName"]);
  if (error) return { error };

  const classIds = new Map<string, string>();
  const items: ProvisionItem[] = [];
  const errors: string[] = [];
  for (const { row, values } of rows) {
    if (!values.code || !values.fullName || !values.className) { errors.push(`Dòng ${row}: thiếu lớp, mã hoặc họ tên`); continue; }
    const key = values.className.replace(/\s/g, "").toUpperCase();
    if (!classIds.has(key)) {
      const cls = await ensureClass(schoolId, year.id, key);
      if (!cls) { errors.push(`Dòng ${row}: tên lớp "${values.className}" không hợp lệ`); continue; }
      classIds.set(key, cls.id);
    }
    items.push({ row, classId: classIds.get(key)!, data: toStudentInput(values) });
  }
  const res = await provisionStudents({ schoolId, items, allowMove: true });
  revalidatePath("/school/classes");
  const all = [...errors, ...res.errors, ...res.warnings];
  const msg = `${classIds.size} lớp. ${summarize(res)}`;
  return all.length ? { error: `${msg} Cần kiểm tra: ${all.slice(0, 10).join("; ")}${all.length > 10 ? ` … (+${all.length - 10})` : ""}` } : { ok: msg };
}

// ---------- Môn học ----------

export async function saveSubject(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { schoolId } = await requireSchoolAdmin();
  const id = optStr(form, "id");
  const code = str(form, "code").toUpperCase().replace(/[^A-Z0-9_]/g, "");
  const name = str(form, "name");
  const type = str(form, "type") === "COMMENT" ? "COMMENT" : "SCORE";
  const order = Number(str(form, "order")) || 0;
  if (!code || !name) return { error: "Nhập mã và tên môn (mã chỉ gồm chữ không dấu, số)" };
  const dup = await db.subject.findUnique({ where: { schoolId_code: { schoolId, code } } });
  if (dup && dup.id !== id) return { error: `Mã môn ${code} đã tồn tại` };
  if (id) await db.subject.updateMany({ where: { id, schoolId }, data: { code, name, type, order, active: form.get("active") === "on" } });
  else await db.subject.create({ data: { schoolId, code, name, type, order } });
  revalidatePath("/school/subjects");
  return { ok: id ? "Đã lưu" : `Đã thêm môn ${name}` };
}

// ---------- Mẫu báo cáo ----------

export async function uploadTemplate(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { schoolId } = await requireSchoolAdmin();
  const name = str(form, "name");
  const file = form.get("file");
  if (!name) return { error: "Nhập tên mẫu" };
  if (!(file instanceof File) || !file.name.toLowerCase().endsWith(".xlsx")) return { error: "Chọn tệp mẫu .xlsx" };
  if (file.size > 5_000_000) return { error: "Tệp mẫu tối đa 5MB" };
  const data = Buffer.from(await file.arrayBuffer());
  if (!(await hasTokens(data))) {
    return { error: "Không tìm thấy ô {{...}} nào trong mẫu. Xem bảng mã trường dữ liệu bên dưới." };
  }
  await db.reportTemplate.create({ data: { schoolId, name, fileName: file.name, data } });
  revalidatePath("/school/reports");
  return { ok: `Đã thêm mẫu "${name}"` };
}

async function hasTokens(buf: Buffer) {
  const ExcelJS = (await import("exceljs")).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf as unknown as ArrayBuffer);
  let found = false;
  wb.eachSheet((ws) => ws.eachRow((r) => r.eachCell((c) => { if (String(c.text).includes("{{")) found = true; })));
  return found;
}

export async function deleteTemplate(form: FormData) {
  const { schoolId } = await requireSchoolAdmin();
  await db.reportTemplate.deleteMany({ where: { id: str(form, "id"), schoolId } });
  revalidatePath("/school/reports");
}

// ---------- Thông báo toàn trường ----------

export async function postSchoolAnnouncement(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, schoolId } = await requireSchoolAdmin(SCHOOL_VIEW_ROLES);
  const title = str(form, "title");
  const content = str(form, "content");
  if (!title || !content) return { error: "Nhập tiêu đề và nội dung" };
  await db.announcement.create({ data: { schoolId, classId: null, authorId: user.id, title, content } });
  const everyone = await db.user.findMany({ where: { schoolId, active: true, id: { not: user.id } }, select: { id: true } });
  await notify(everyone.map((u) => u.id), { kind: "ANNOUNCE", title: `📢 ${title}`, body: content.slice(0, 160), url: "/dashboard" });
  revalidatePath("/school/announcements");
  return { ok: "Đã gửi thông báo đến toàn bộ giáo viên, học sinh và phụ huynh" };
}

export async function deleteSchoolAnnouncement(form: FormData) {
  const { schoolId } = await requireSchoolAdmin(SCHOOL_VIEW_ROLES);
  await db.announcement.deleteMany({ where: { id: str(form, "id"), schoolId, classId: null } });
  revalidatePath("/school/announcements");
}
