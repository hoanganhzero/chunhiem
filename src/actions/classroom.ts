"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireClassAccess, requireStudentAccess } from "@/lib/auth";
import { ATTENDANCE, CONDUCT_TYPES, GENDERS, RATINGS, STUDENT_STATUS } from "@/lib/constants";
import { optStr, parseCsv, parseDob, str, toDay } from "@/lib/utils";
import type { ActionResult } from "./types";

function studentFields(form: FormData) {
  const gender = str(form, "gender");
  const status = str(form, "status");
  return {
    fullName: str(form, "fullName"),
    dob: parseDob(str(form, "dob")),
    gender: gender in GENDERS ? gender : null,
    address: optStr(form, "address"),
    parentName: optStr(form, "parentName"),
    parentPhone: optStr(form, "parentPhone"),
    note: optStr(form, "note"),
    ...(status in STUDENT_STATUS ? { status } : {}),
  };
}

export async function createStudent(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { cls } = await requireClassAccess(str(form, "classId"));
  const code = str(form, "code").toUpperCase();
  const data = studentFields(form);
  if (!code || !data.fullName) return { error: "Vui lòng nhập mã và họ tên học sinh" };
  if (await db.student.findUnique({ where: { schoolId_code: { schoolId: cls.schoolId, code } } }))
    return { error: `Mã học sinh ${code} đã tồn tại trong trường` };
  await db.student.create({ data: { ...data, code, schoolId: cls.schoolId, classId: cls.id } });
  revalidatePath(`/classes/${cls.id}`);
  return { ok: `Đã thêm ${data.fullName}` };
}

export async function updateStudent(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { student } = await requireStudentAccess(str(form, "id"));
  const data = studentFields(form);
  if (!data.fullName) return { error: "Họ tên không được để trống" };
  await db.student.update({ where: { id: student.id }, data });
  revalidatePath(`/students/${student.id}`);
  revalidatePath(`/classes/${student.classId}`);
  return { ok: "Đã lưu thông tin" };
}

/**
 * Nhập danh sách từ CSV. Cột: Mã HS, Họ tên, Ngày sinh (dd/mm/yyyy), Giới tính (Nam/Nữ),
 * Địa chỉ, Họ tên phụ huynh, SĐT phụ huynh. Dòng đầu là tiêu đề.
 */
export async function importStudents(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { cls } = await requireClassAccess(str(form, "classId"));
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Chưa chọn tệp CSV" };
  if (file.size > 2_000_000) return { error: "Tệp quá lớn (tối đa 2MB)" };
  const rows = parseCsv(await file.text()).slice(1);
  let created = 0;
  let updated = 0;
  const errors: string[] = [];
  for (const [i, r] of rows.entries()) {
    const [code, fullName, dob, gender, address, parentName, parentPhone] = r;
    if (!code || !fullName) { errors.push(`Dòng ${i + 2}: thiếu mã hoặc họ tên`); continue; }
    const g = gender?.toLowerCase();
    const data = {
      fullName,
      dob: parseDob(dob ?? ""),
      gender: g === "nam" ? "NAM" : g === "nữ" || g === "nu" ? "NU" : null,
      address: address || null,
      parentName: parentName || null,
      parentPhone: parentPhone || null,
    };
    const key = { schoolId_code: { schoolId: cls.schoolId, code: code.toUpperCase() } };
    const existing = await db.student.findUnique({ where: key });
    if (existing && existing.classId !== cls.id) {
      errors.push(`Dòng ${i + 2}: mã ${code} đang thuộc lớp khác`);
      continue;
    }
    if (existing) { await db.student.update({ where: key, data }); updated++; }
    else {
      await db.student.create({ data: { ...data, code: code.toUpperCase(), schoolId: cls.schoolId, classId: cls.id } });
      created++;
    }
  }
  revalidatePath(`/classes/${cls.id}`);
  const msg = `Thêm mới ${created}, cập nhật ${updated} học sinh.`;
  return errors.length ? { error: `${msg} Lỗi: ${errors.slice(0, 5).join("; ")}${errors.length > 5 ? "…" : ""}` } : { ok: msg };
}

export async function saveAttendance(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { cls } = await requireClassAccess(str(form, "classId"));
  const date = new Date(str(form, "date") + "T00:00:00Z");
  if (isNaN(date.getTime())) return { error: "Ngày không hợp lệ" };
  if (date > toDay()) return { error: "Không thể điểm danh cho ngày trong tương lai" };
  const students = await db.student.findMany({ where: { classId: cls.id, status: "ACTIVE" }, select: { id: true } });
  await db.$transaction(
    students.map((s) => {
      const raw = str(form, `status_${s.id}`);
      const status = raw in ATTENDANCE ? raw : "PRESENT";
      const note = optStr(form, `note_${s.id}`);
      return db.attendance.upsert({
        where: { studentId_date: { studentId: s.id, date } },
        create: { studentId: s.id, classId: cls.id, date, status, note },
        update: { status, note },
      });
    }),
  );
  revalidatePath(`/classes/${cls.id}`);
  return { ok: "Đã lưu điểm danh" };
}

export async function addConductRecord(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, student } = await requireStudentAccess(str(form, "studentId"));
  const type = str(form, "type");
  const content = str(form, "content");
  const date = new Date((str(form, "date") || toDay().toISOString().slice(0, 10)) + "T00:00:00Z");
  if (!(type in CONDUCT_TYPES) || !content) return { error: "Vui lòng chọn loại và nhập nội dung" };
  const points = Math.abs(Number(str(form, "points")) || 0) * (type === "VIOLATION" ? -1 : 1);
  await db.conductRecord.create({ data: { studentId: student.id, type, content, date, points, createdById: user.id } });
  revalidatePath(`/classes/${student.classId}/conduct`);
  revalidatePath(`/students/${student.id}`);
  return { ok: "Đã ghi nhận" };
}

export async function deleteConductRecord(form: FormData) {
  const rec = await db.conductRecord.findUnique({ where: { id: str(form, "id") } });
  if (!rec) return;
  const { student } = await requireStudentAccess(rec.studentId);
  await db.conductRecord.delete({ where: { id: rec.id } });
  revalidatePath(`/classes/${student.classId}/conduct`);
  revalidatePath(`/students/${student.id}`);
}

export async function saveEvaluations(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { cls } = await requireClassAccess(str(form, "classId"));
  const semester = Number(str(form, "semester"));
  if (semester !== 1 && semester !== 2) return { error: "Học kỳ không hợp lệ" };
  const students = await db.student.findMany({ where: { classId: cls.id }, select: { id: true } });
  const ops = students.flatMap((s) => {
    const rating = str(form, `rating_${s.id}`);
    if (!(rating in RATINGS)) return [];
    const comment = optStr(form, `comment_${s.id}`);
    const key = { studentId: s.id, academicYearId: cls.academicYearId, semester };
    return [
      db.conductEvaluation.upsert({
        where: { studentId_academicYearId_semester: key },
        create: { ...key, rating, comment },
        update: { rating, comment },
      }),
    ];
  });
  await db.$transaction(ops);
  revalidatePath(`/classes/${cls.id}/evaluation`);
  return { ok: `Đã lưu đánh giá học kỳ ${semester} (${ops.length} học sinh)` };
}
