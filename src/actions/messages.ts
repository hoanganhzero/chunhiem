"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireClassAccess, requireFamilyAccess, requireStudentAccess } from "@/lib/auth";
import { ATTENDANCE } from "@/lib/constants";
import { fmtDate, str } from "@/lib/utils";
import { notify, notifyFamily, notifyHomeroom } from "@/lib/notify";
import { buildProgress, classBoards, progressSummary } from "@/lib/progress";
import type { ActionResult } from "./types";

export async function postAnnouncement(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, cls } = await requireClassAccess(str(form, "classId"));
  const title = str(form, "title");
  const content = str(form, "content");
  if (!title || !content) return { error: "Nhập tiêu đề và nội dung" };
  await db.announcement.create({ data: { schoolId: cls.schoolId, classId: cls.id, authorId: user.id, title, content } });
  const fam = await db.student.findMany({ where: { classId: cls.id, status: "ACTIVE" }, select: { userId: true, parentUserId: true } });
  await notify(fam.flatMap((f) => [f.userId, f.parentUserId]), { kind: "ANNOUNCE", title: `📢 Lớp ${cls.name}: ${title}`, body: content.slice(0, 160), url: "/dashboard" });
  revalidatePath(`/classes/${cls.id}/messages`);
  return { ok: "Đã gửi thông báo đến phụ huynh và học sinh cả lớp" };
}

export async function deleteAnnouncement(form: FormData) {
  const a = await db.announcement.findUnique({ where: { id: str(form, "id") } });
  if (!a?.classId) return;
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
  await notifyFamily(student, { kind: "MESSAGE", title: `💬 GVCN nhắn về ${student.fullName}`, body: content.slice(0, 160), path: "/messages" });
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
  await notifyHomeroom(student.id, { kind: "MESSAGE", title: `💬 Phụ huynh ${student.fullName}`, body: content.slice(0, 160), path: `/messages/${student.id}` });
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
  // Phần thi đua, ưu điểm, hạn chế, mục tiêu cho từng em
  const boards = await classBoards(cls.id);
  const summaries = new Map(
    await Promise.all(students.map(async (s) => [s.id, progressSummary(await buildProgress(s.id, boards))] as const)),
  );
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
    const progress = summaries.get(s.id);
    if (progress?.length) lines.push("", "Thi đua & tiến bộ:", ...progress);
    if (extra) lines.push("", extra);
    return { studentId: s.id, senderId: user.id, fromFamily: false, kind: "REPORT", content: lines.join("\n") };
  });
  await db.message.createMany({ data });
  for (const s of students) {
    await notifyFamily(s, {
      kind: "REPORT", title: `📝 Báo cáo tình hình ${s.fullName}`,
      body: `Từ ${fmtDate(from)} đến ${fmtDate(to)}. Mở để xem và bấm “Đã xem” xác nhận với GVCN.`, path: "/messages",
    });
  }
  revalidatePath(`/classes/${cls.id}/messages`);
  return { ok: `Đã gửi báo cáo cho phụ huynh ${data.length} học sinh` };
}

/** Phụ huynh xác nhận đã xem báo cáo định kỳ, có thể kèm phản hồi cho GVCN. */
export async function ackReport(_: ActionResult, form: FormData): Promise<ActionResult> {
  const msg = await db.message.findUnique({ where: { id: str(form, "id") } });
  if (!msg || msg.kind !== "REPORT") return { error: "Không tìm thấy báo cáo" };
  const { user, student } = await requireFamilyAccess(msg.studentId);
  if (user.role !== "PARENT") return { error: "Chỉ phụ huynh xác nhận báo cáo" };
  const feedback = str(form, "feedback");
  await db.message.update({ where: { id: msg.id }, data: { ackAt: msg.ackAt ?? new Date(), read: true } });
  if (feedback) {
    await db.message.create({ data: { studentId: student.id, senderId: user.id, fromFamily: true, content: `Phản hồi báo cáo: ${feedback}` } });
  }
  await notifyHomeroom(student.id, {
    kind: "FEEDBACK",
    title: `✓ Phụ huynh ${student.fullName} đã xem báo cáo`,
    body: feedback ? feedback.slice(0, 160) : "Phụ huynh đã xác nhận đã xem báo cáo.",
    path: `/messages/${student.id}`,
  });
  revalidatePath(`/portal/${student.id}/messages`);
  return { ok: feedback ? "Đã xác nhận và gửi phản hồi cho GVCN" : "Đã xác nhận đã xem — cảm ơn phụ huynh!" };
}
