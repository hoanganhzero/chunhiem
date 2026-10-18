"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { requireClassAccess, requireFamilyAccess, requireStudentAccess, requireUser } from "@/lib/auth";
import { CLASS_ROLES, EMU_CATEGORIES } from "@/lib/constants";
import { ensureCriteria, recorderScope } from "@/lib/emulation";
import { optStr, str, toDay } from "@/lib/utils";
import { notifyFamily, notifyHomeroom, notifyRecords } from "@/lib/notify";
import type { ActionResult } from "./types";

function parseDate(form: FormData) {
  const raw = str(form, "date");
  const d = raw ? new Date(raw + "T00:00:00Z") : toDay();
  if (isNaN(d.getTime()) || d > toDay()) return null;
  return d;
}

/**
 * Ghi nhận thi đua cho một hoặc nhiều học sinh.
 * GVCN / cán bộ trường: tính điểm ngay. Cán sự lớp (tổ trưởng, bí thư…): chờ GVCN duyệt.
 */
export async function recordEmulation(_: ActionResult, form: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const ids = form.getAll("sid").map(String).filter(Boolean);
  if (!ids.length) return { error: "Chọn ít nhất một bạn / học sinh" };
  const date = parseDate(form);
  if (!date) return { error: "Ngày không hợp lệ" };

  let classId: string;
  let status: "APPROVED" | "PENDING";
  if (user.role === "STUDENT") {
    const scope = await recorderScope(user.id);
    if (!scope) return { error: "Bạn chưa được GVCN phân công ghi thi đua" };
    const allowed = new Set(scope.targets.map((t) => t.id));
    if (ids.some((id) => !allowed.has(id))) return { error: "Có bạn không thuộc phạm vi bạn được ghi" };
    classId = scope.me.classId;
    status = "PENDING";
  } else {
    const { cls } = await requireClassAccess(str(form, "classId"));
    const n = await db.student.count({ where: { id: { in: ids }, classId: cls.id } });
    if (n !== ids.length) return { error: "Học sinh không thuộc lớp" };
    classId = cls.id;
    status = "APPROVED";
  }
  const c = await db.emulationCriterion.findFirst({ where: { id: str(form, "criterionId"), classId, active: true } });
  if (!c) return { error: "Chọn tiêu chí thi đua" };
  await db.emulationRecord.createMany({
    data: ids.map((studentId) => ({
      classId, studentId, criterionId: c.id, label: c.name, category: c.category, points: c.points,
      note: optStr(form, "note"), date, status, recordedById: user.id,
    })),
  });
  if (status === "APPROVED") await notifyRecords(ids.map((studentId) => ({ studentId, label: c.name, points: c.points })));
  revalidatePath(`/classes/${classId}/emulation`);
  const sign = c.points > 0 ? `+${c.points}` : `${c.points}`;
  return { ok: `Đã ghi “${c.name}” (${sign}) cho ${ids.length} bạn${status === "PENDING" ? " — chờ GVCN duyệt" : ""}` };
}

/** GVCN duyệt / từ chối các ghi nhận của cán sự lớp. */
export async function reviewRecords(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { cls } = await requireClassAccess(str(form, "classId"));
  const approve = str(form, "decision") === "approve";
  const ids = form.getAll("rid").map(String);
  if (!ids.length) return { error: "Chưa chọn ghi nhận nào" };
  const where = { classId: cls.id, status: "PENDING", id: { in: ids } };
  const pending = await db.emulationRecord.findMany({ where });
  const res = await db.emulationRecord.updateMany({ where, data: { status: approve ? "APPROVED" : "REJECTED" } });
  if (approve) await notifyRecords(pending);
  revalidatePath(`/classes/${cls.id}/emulation`);
  return { ok: `Đã ${approve ? "duyệt" : "từ chối"} ${res.count} ghi nhận` };
}

/** GVCN xoá bất kỳ ghi nhận nào của lớp; cán sự chỉ xoá ghi nhận của mình còn chờ duyệt. */
export async function deleteEmulation(form: FormData) {
  const user = await requireUser();
  const rec = await db.emulationRecord.findUnique({ where: { id: str(form, "id") } });
  if (!rec) return;
  if (user.role === "STUDENT") {
    if (rec.recordedById !== user.id || rec.status !== "PENDING") return;
  } else {
    await requireClassAccess(rec.classId);
  }
  await db.emulationRecord.delete({ where: { id: rec.id } });
  revalidatePath(`/classes/${rec.classId}/emulation`);
}

// ---------- Thiết lập: tổ, cán sự, tiêu chí ----------

export async function createGroups(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { cls } = await requireClassAccess(str(form, "classId"));
  const n = Number(str(form, "count"));
  if (!Number.isInteger(n) || n < 1 || n > 10) return { error: "Số tổ từ 1 đến 10" };
  const existing = await db.classGroup.count({ where: { classId: cls.id } });
  await db.classGroup.createMany({
    data: Array.from({ length: n }, (_, i) => ({ classId: cls.id, name: `Tổ ${existing + i + 1}`, order: existing + i })),
  });
  revalidatePath(`/classes/${cls.id}/emulation/setup`);
  return { ok: `Đã tạo ${n} tổ` };
}

export async function renameGroup(form: FormData) {
  const g = await db.classGroup.findUnique({ where: { id: str(form, "id") } });
  if (!g) return;
  await requireClassAccess(g.classId);
  const name = str(form, "name");
  if (str(form, "op") === "delete") await db.classGroup.delete({ where: { id: g.id } });
  else if (name) await db.classGroup.update({ where: { id: g.id }, data: { name } });
  revalidatePath(`/classes/${g.classId}/emulation/setup`);
}

/** Lưu phân tổ + chức vụ cán sự cho cả lớp một lần. */
export async function saveAssignments(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { cls } = await requireClassAccess(str(form, "classId"));
  const [students, groups] = await Promise.all([
    db.student.findMany({ where: { classId: cls.id, status: "ACTIVE" }, select: { id: true, fullName: true } }),
    db.classGroup.findMany({ where: { classId: cls.id }, select: { id: true } }),
  ]);
  const gids = new Set(groups.map((g) => g.id));
  const plan = students.map((s) => {
    const groupId = str(form, `group_${s.id}`);
    const role = str(form, `role_${s.id}`);
    return { ...s, groupId: gids.has(groupId) ? groupId : null, classRole: role in CLASS_ROLES ? role : null };
  });
  for (const p of plan) if (p.classRole === "TO_TRUONG" && !p.groupId) return { error: `${p.fullName}: tổ trưởng phải thuộc một tổ` };
  for (const g of gids) {
    if (plan.filter((p) => p.groupId === g && p.classRole === "TO_TRUONG").length > 1) return { error: "Mỗi tổ chỉ có một tổ trưởng" };
  }
  for (const r of ["LOP_TRUONG", "BI_THU"]) {
    if (plan.filter((p) => p.classRole === r).length > 1) return { error: `Lớp chỉ có một ${CLASS_ROLES[r as keyof typeof CLASS_ROLES].label.toLowerCase()}` };
  }
  await db.$transaction(plan.map((p) => db.student.update({ where: { id: p.id }, data: { groupId: p.groupId, classRole: p.classRole } })));
  revalidatePath(`/classes/${cls.id}/emulation/setup`);
  return { ok: "Đã lưu phân tổ và cán sự lớp" };
}

export async function saveCriterion(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { cls } = await requireClassAccess(str(form, "classId"));
  await ensureCriteria(cls.id);
  const id = optStr(form, "id");
  const name = str(form, "name");
  const category = str(form, "category");
  const points = Math.trunc(Number(str(form, "points")));
  if (!name || !(category in EMU_CATEGORIES)) return { error: "Nhập tên và chọn nhóm tiêu chí" };
  if (!points || Math.abs(points) > 20) return { error: "Điểm từ -20 đến 20 (khác 0)" };
  if (id) {
    await db.emulationCriterion.updateMany({ where: { id, classId: cls.id }, data: { name, category, points, active: form.get("active") === "on" } });
  } else {
    const n = await db.emulationCriterion.count({ where: { classId: cls.id } });
    await db.emulationCriterion.create({ data: { classId: cls.id, name, category, points, order: n } });
  }
  revalidatePath(`/classes/${cls.id}/emulation/setup`);
  return { ok: id ? "Đã lưu" : `Đã thêm tiêu chí “${name}”` };
}

// ---------- Mục tiêu rèn luyện ----------

export async function saveGoal(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { user, student } = await requireStudentAccess(str(form, "studentId"));
  const title = str(form, "title");
  if (!title) return { error: "Nhập nội dung mục tiêu" };
  const due = str(form, "dueDate");
  await db.goal.create({
    data: { studentId: student.id, title, dueDate: due ? new Date(due + "T00:00:00Z") : null, createdById: user.id },
  });
  await notifyFamily(student, { kind: "GOAL", title: `🎯 Mục tiêu mới cho ${student.fullName}`, body: `${title}. Gia đình có thể bấm “Cam kết đồng hành” trong mục Tiến bộ.`, path: "/progress" }, true);
  revalidatePath(`/students/${student.id}`);
  return { ok: "Đã đặt mục tiêu — phụ huynh và học sinh sẽ thấy trong mục Tiến bộ" };
}

export async function setGoalStatus(form: FormData) {
  const goal = await db.goal.findUnique({ where: { id: str(form, "id") } });
  if (!goal) return;
  await requireStudentAccess(goal.studentId);
  const status = str(form, "status");
  if (status === "delete") await db.goal.delete({ where: { id: goal.id } });
  else if (["ACTIVE", "DONE", "MISSED"].includes(status)) await db.goal.update({ where: { id: goal.id }, data: { status } });
  revalidatePath(`/students/${goal.studentId}`);
}

/** Phụ huynh / học sinh cam kết đồng hành hoặc góp ý cho một mục tiêu — GVCN nhận thông báo. */
export async function commentGoal(_: ActionResult, form: FormData): Promise<ActionResult> {
  const goal = await db.goal.findUnique({ where: { id: str(form, "goalId") } });
  if (!goal) return { error: "Không tìm thấy mục tiêu" };
  const { user, student } = await requireFamilyAccess(goal.studentId);
  const kind = str(form, "kind") === "COMMIT" ? "COMMIT" : "COMMENT";
  const who = user.role === "PARENT" ? "Phụ huynh" : "Học sinh";
  const content = str(form, "content") || (kind === "COMMIT"
    ? user.role === "PARENT" ? "Gia đình cam kết đồng hành, nhắc nhở con thực hiện mục tiêu." : "Em cam kết cố gắng thực hiện mục tiêu."
    : "");
  if (!content) return { error: "Nhập nội dung" };
  if (kind === "COMMIT" && (await db.goalComment.count({ where: { goalId: goal.id, userId: user.id, kind: "COMMIT" } })))
    return { error: "Bạn đã cam kết với mục tiêu này" };
  await db.goalComment.create({ data: { goalId: goal.id, userId: user.id, kind, content } });
  await notifyHomeroom(student.id, {
    kind: "FEEDBACK",
    title: `${kind === "COMMIT" ? "🤝" : "💬"} ${who} ${student.fullName} ${kind === "COMMIT" ? "cam kết đồng hành" : "góp ý"}`,
    body: `Mục tiêu “${goal.title}”: ${content}`.slice(0, 180),
    url: `/students/${student.id}`,
  });
  revalidatePath(`/portal/${student.id}/progress`);
  return { ok: kind === "COMMIT" ? "Đã gửi cam kết tới GVCN" : "Đã gửi ý kiến tới GVCN" };
}
