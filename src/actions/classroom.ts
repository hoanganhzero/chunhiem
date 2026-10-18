"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireClassAccess, requireStudentAccess } from "@/lib/auth";
import { ATTENDANCE, CONDUCT_TYPES, GENDERS, RATINGS, STUDENT_STATUS } from "@/lib/constants";
import { optStr, parseDob, str, toDay } from "@/lib/utils";
import { syncAttendanceEmulation } from "@/lib/emulation";
import { notifyFamily, notifyRecords } from "@/lib/notify";
import { provisionStudents, resetToDefault, summarize, type ProvisionItem } from "@/lib/accounts";
import { STUDENT_COLUMNS, readTable, toStudentInput } from "@/lib/excel";
import type { ActionResult } from "./types";

function studentFields(form: FormData) {
  const gender = str(form, "gender");
  const status = str(form, "status");
  return {
    fullName: str(form, "fullName"),
    dob: parseDob(str(form, "dob")),
    gender: gender in GENDERS ? gender : null,
    ethnicity: optStr(form, "ethnicity"),
    address: optStr(form, "address"),
    parentName: optStr(form, "parentName"),
    parentRelation: optStr(form, "parentRelation"),
    parentPhone: optStr(form, "parentPhone"),
    note: optStr(form, "note"),
    ...(status in STUDENT_STATUS ? { status } : {}),
  };
}

export async function createStudent(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { cls } = await requireClassAccess(str(form, "classId"));
  const code = str(form, "code").replace(/\s/g, "").toUpperCase();
  const data = studentFields(form);
  if (!code || !data.fullName) return { error: "Vui lòng nhập mã và họ tên học sinh" };
  if (await db.student.findUnique({ where: { schoolId_code: { schoolId: cls.schoolId, code } } }))
    return { error: `Mã học sinh ${code} đã tồn tại trong trường` };
  const res = await provisionStudents({ schoolId: cls.schoolId, items: [{ row: 0, classId: cls.id, data: { ...data, code } }] });
  revalidatePath(`/classes/${cls.id}`);
  if (res.errors.length) return { error: res.errors.join("; ") };
  return { ok: `Đã thêm ${data.fullName}. ${summarize(res)}${res.warnings.length ? " " + res.warnings.join("; ") : ""}` };
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

/** Nhập danh sách lớp từ tệp Excel (.xlsx) theo mẫu chuẩn hoặc CSV; tạo luôn tài khoản HS + PH. */
export async function importStudents(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { cls } = await requireClassAccess(str(form, "classId"));
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Chưa chọn tệp" };
  if (file.size > 5_000_000) return { error: "Tệp quá lớn (tối đa 5MB)" };
  const { rows, error } = await readTable(file, STUDENT_COLUMNS, ["code", "fullName"]);
  if (error) return { error };
  const items: ProvisionItem[] = [];
  const errors: string[] = [];
  for (const { row, values } of rows) {
    if (!values.code || !values.fullName) { errors.push(`Dòng ${row}: thiếu mã hoặc họ tên`); continue; }
    const other = values.className && values.className.replace(/\s/g, "").toUpperCase() !== cls.name;
    if (other) { errors.push(`Dòng ${row}: thuộc lớp ${values.className}, bỏ qua`); continue; }
    items.push({ row, classId: cls.id, data: toStudentInput(values) });
  }
  const res = await provisionStudents({ schoolId: cls.schoolId, items });
  revalidatePath(`/classes/${cls.id}`);
  const all = [...errors, ...res.errors, ...res.warnings];
  const msg = summarize(res);
  return all.length ? { error: `${msg} Cần kiểm tra: ${all.slice(0, 8).join("; ")}${all.length > 8 ? ` … (+${all.length - 8})` : ""}` } : { ok: msg };
}

/** Bổ sung tài khoản HS / PH cho các học sinh trong lớp chưa có. */
export async function createMissingAccounts(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { cls } = await requireClassAccess(str(form, "classId"));
  const students = await db.student.findMany({
    where: { classId: cls.id, OR: [{ userId: null }, { parentUserId: null }] },
  });
  if (!students.length) return { ok: "Tất cả học sinh đã có đủ tài khoản" };
  const res = await provisionStudents({
    schoolId: cls.schoolId,
    updateInfo: false,
    items: students.map((s) => ({ row: 0, classId: cls.id, data: { ...s, code: s.code } })),
  });
  revalidatePath(`/classes/${cls.id}/accounts`);
  return res.warnings.length
    ? { error: `Đã tạo ${res.studentAccounts} TK học sinh, ${res.parentAccounts} TK phụ huynh. ${res.warnings.join("; ")}` }
    : { ok: `Đã tạo ${res.studentAccounts} tài khoản học sinh, ${res.parentAccounts} tài khoản phụ huynh` };
}

/** GVCN đặt lại mật khẩu mặc định cho tài khoản học sinh / phụ huynh của lớp mình. */
export async function resetFamilyPassword(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { student } = await requireStudentAccess(str(form, "studentId"));
  const which = str(form, "which");
  const id = which === "parent" ? student.parentUserId : student.userId;
  if (!id) return { error: "Học sinh chưa có tài khoản này" };
  await resetToDefault([id], student.schoolId);
  return { ok: `Đã đặt lại mật khẩu ${which === "parent" ? "phụ huynh" : "học sinh"} về mặc định` };
}

export async function saveAttendance(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, cls } = await requireClassAccess(str(form, "classId"));
  const date = new Date(str(form, "date") + "T00:00:00Z");
  if (isNaN(date.getTime())) return { error: "Ngày không hợp lệ" };
  if (date > toDay()) return { error: "Không thể điểm danh cho ngày trong tương lai" };
  const [students, before] = await Promise.all([
    db.student.findMany({ where: { classId: cls.id, status: "ACTIVE" }, select: { id: true, fullName: true, userId: true, parentUserId: true } }),
    db.attendance.findMany({ where: { classId: cls.id, date }, select: { studentId: true, status: true } }),
  ]);
  const statuses = new Map(
    students.map((s) => {
      const raw = str(form, `status_${s.id}`);
      return [s.id, raw in ATTENDANCE ? raw : "PRESENT"] as const;
    }),
  );
  await db.$transaction(
    students.map((s) => {
      const status = statuses.get(s.id)!;
      const note = optStr(form, `note_${s.id}`);
      return db.attendance.upsert({
        where: { studentId_date: { studentId: s.id, date } },
        create: { studentId: s.id, classId: cls.id, date, status, note },
        update: { status, note },
      });
    }),
  );
  // Tự trừ điểm thi đua: vắng không phép, đi muộn
  await syncAttendanceEmulation(cls.id, date, statuses, user.id);

  // Báo phụ huynh khi con vắng / đi muộn — chỉ khi trạng thái thay đổi (lưu lại không gửi trùng)
  const prev = new Map(before.map((b) => [b.studentId, b.status]));
  const dateText = date.toLocaleDateString("vi-VN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "numeric" });
  const msg: Record<string, [string, string]> = {
    UNEXCUSED: ["❗", "vắng học không phép"],
    EXCUSED: ["📅", "vắng học có phép"],
    LATE: ["⏰", "đi học muộn"],
  };
  let notified = 0;
  for (const s of students) {
    const st = statuses.get(s.id)!;
    if (!msg[st] || prev.get(s.id) === st) continue;
    const note = optStr(form, `note_${s.id}`);
    await notifyFamily(s, {
      kind: "ATTENDANCE",
      title: `${msg[st][0]} ${s.fullName} ${msg[st][1]}`,
      body: `${dateText}, lớp ${cls.name}${note ? ` — ${note}` : ""}. Phụ huynh có thể nhắn GVCN ngay trong ứng dụng.`,
      path: "/messages",
    });
    notified++;
  }
  revalidatePath(`/classes/${cls.id}`);
  return { ok: `Đã lưu điểm danh${notified ? ` · đã báo ${notified} phụ huynh` : ""}` };
}

export async function addConductRecord(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, student } = await requireStudentAccess(str(form, "studentId"));
  const type = str(form, "type");
  const content = str(form, "content");
  const date = new Date((str(form, "date") || toDay().toISOString().slice(0, 10)) + "T00:00:00Z");
  if (!(type in CONDUCT_TYPES) || !content) return { error: "Vui lòng chọn loại và nhập nội dung" };
  const points = Math.abs(Number(str(form, "points")) || 0) * (type === "VIOLATION" ? -1 : 1);
  await db.conductRecord.create({ data: { studentId: student.id, type, content, date, points, createdById: user.id } });
  await notifyRecords([{ studentId: student.id, label: content, points, positive: type === "PRAISE" }]);
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
