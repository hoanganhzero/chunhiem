"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireClassAccess, requireFamilyAccess, requireStudentAccess } from "@/lib/auth";
import { ATTENDANCE } from "@/lib/constants";
import { fmtDate, str } from "@/lib/utils";
import type { ActionResult } from "./types";

export async function postAnnouncement(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, cls } = await requireClassAccess(str(form, "classId"));
  const title = str(form, "title");
  const content = str(form, "content");
  if (!title || !content) return { error: "Nhập tiêu đề và nội dung" };
  await db.announcement.create({ data: { classId: cls.id, authorId: user.id, title, content } });
  revalidatePath(`/classes/${cls.id}/messages`);
  return { ok: "Đã gửi thông báo đến phụ huynh và học sinh cả lớp" };
}

export async function deleteAnnouncement(form: FormData) {
  const a = await db.announcement.findUnique({ where: { id: str(form, "id") } });
  if (!a) return;
  await requireClassAccess(a.classId);
  await db.announcement.delete({ where: { id: a.id } });
  revalidatePath(`/classes/${a.classId}/messages`);
}

/** Giáo viên nhắn cho phụ huynh của một học sinh. */
export async function teacherSendMessage(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, student } = await requireStudentAccess(str(form, "studentId"));
  const content = str(form, "content");
  if (!content) return { error: "Nội dung trống" };
  await db.message.create({ data: { studentId: student.id, senderId: user.id, fromFamily: false, content } });
  revalidatePath(`/classes/${student.classId}/messages/${student.id}`);
  return { ok: "Đã gửi" };
}

/** Phụ huynh nhắn cho GVCN. */
export async function familySendMessage(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, student } = await requireFamilyAccess(str(form, "studentId"));
  if (user.role !== "PARENT") return { error: "Chỉ tài khoản phụ huynh được gửi tin cho GVCN" };
  const content = str(form, "content");
  if (!content) return { error: "Nội dung trống" };
  await db.message.create({ data: { studentId: student.id, senderId: user.id, fromFamily: true, content } });
  revalidatePath(`/portal/${student.id}/messages`);
  return { ok: "Đã gửi cho giáo viên chủ nhiệm" };
}

/**
 * Gửi báo cáo tình hình học sinh (chuyên cần, nề nếp) trong khoảng ngày đến phụ huynh từng em.
 * Mỗi học sinh nhận một tin riêng trong sổ liên lạc.
 */
export async function sendPeriodicReports(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, cls } = await requireClassAccess(str(form, "classId"));
  const from = new Date(str(form, "from") + "T00:00:00Z");
  const to = new Date(str(form, "to") + "T00:00:00Z");
  if (isNaN(from.getTime()) || isNaN(to.getTime()) || from > to) return { error: "Khoảng ngày không hợp lệ" };
  const range = { gte: from, lte: to };
  const students = await db.student.findMany({
    where: { classId: cls.id, status: "ACTIVE", parentUserId: { not: null } },
    include: {
      attendances: { where: { date: range, status: { not: "PRESENT" } }, orderBy: { date: "asc" } },
      conductRecords: { where: { date: range }, orderBy: { date: "asc" } },
    },
  });
  const extra = str(form, "extra");
  const data = students.map((s) => {
    const lines = [`Báo cáo tình hình học sinh ${s.fullName} từ ${fmtDate(from)} đến ${fmtDate(to)}:`];
    if (!s.attendances.length) lines.push("• Chuyên cần: đi học đầy đủ, đúng giờ.");
    else {
      lines.push("• Chuyên cần:");
      for (const a of s.attendances)
        lines.push(`   - ${fmtDate(a.date)}: ${ATTENDANCE[a.status as keyof typeof ATTENDANCE]}${a.note ? ` (${a.note})` : ""}`);
    }
    const praise = s.conductRecords.filter((c) => c.type === "PRAISE");
    const viol = s.conductRecords.filter((c) => c.type === "VIOLATION");
    if (praise.length) lines.push(`• Khen thưởng: ${praise.map((c) => `${c.content} (${fmtDate(c.date)})`).join("; ")}`);
    if (viol.length) lines.push(`• Cần nhắc nhở: ${viol.map((c) => `${c.content} (${fmtDate(c.date)})`).join("; ")}`);
    if (!praise.length && !viol.length) lines.push("• Nề nếp: thực hiện tốt nội quy.");
    if (extra) lines.push("", extra);
    return { studentId: s.id, senderId: user.id, fromFamily: false, content: lines.join("\n") };
  });
  await db.message.createMany({ data });
  revalidatePath(`/classes/${cls.id}/messages`);
  return { ok: `Đã gửi báo cáo cho phụ huynh ${data.length} học sinh` };
}
