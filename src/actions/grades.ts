"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requireClassAccess } from "@/lib/auth";
import { MAX_TX } from "@/lib/grades";
import { str } from "@/lib/utils";
import type { ActionResult } from "./types";

function parseScore(raw: string): number | null | "invalid" {
  if (!raw) return null;
  const n = Number(raw.replace(",", "."));
  if (!Number.isFinite(n) || n < 0 || n > 10) return "invalid";
  return Math.round(n * 100) / 100;
}

/** Lưu toàn bộ điểm của một môn, một học kỳ cho cả lớp (ghi đè). */
export async function saveGrades(_: ActionResult, form: FormData): Promise<ActionResult> {
  const { cls } = await requireClassAccess(str(form, "classId"));
  const semester = Number(str(form, "semester"));
  if (semester !== 1 && semester !== 2) return { error: "Học kỳ không hợp lệ" };
  const subject = await db.subject.findFirst({ where: { id: str(form, "subjectId"), schoolId: cls.schoolId } });
  if (!subject) return { error: "Môn học không hợp lệ" };
  const students = await db.student.findMany({ where: { classId: cls.id, status: "ACTIVE" }, select: { id: true, fullName: true } });

  const data: Prisma.GradeCreateManyInput[] = [];
  const errors: string[] = [];
  const base = { subjectId: subject.id, academicYearId: cls.academicYearId, semester };
  for (const s of students) {
    if (subject.type === "COMMENT") {
      const v = str(form, `dg_${s.id}`);
      if (v === "D" || v === "CD") data.push({ ...base, studentId: s.id, kind: "DG", idx: 0, score: v === "D" ? 1 : 0 });
      continue;
    }
    const cells: [string, number, string][] = [
      ...Array.from({ length: MAX_TX }, (_, i) => ["TX", i + 1, `tx${i + 1}_${s.id}`] as [string, number, string]),
      ["GK", 0, `gk_${s.id}`],
      ["CK", 0, `ck_${s.id}`],
    ];
    for (const [kind, idx, field] of cells) {
      const v = parseScore(str(form, field));
      if (v === "invalid") errors.push(`${s.fullName}: điểm "${str(form, field)}" không hợp lệ`);
      else if (v !== null) data.push({ ...base, studentId: s.id, kind, idx, score: v });
    }
  }
  if (errors.length) return { error: `Chưa lưu. Điểm phải từ 0 đến 10. ${errors.slice(0, 5).join("; ")}` };

  await db.$transaction([
    db.grade.deleteMany({ where: { ...base, studentId: { in: students.map((s) => s.id) } } }),
    db.grade.createMany({ data }),
  ]);
  revalidatePath(`/classes/${cls.id}/grades`);
  return { ok: `Đã lưu điểm ${subject.name} học kỳ ${semester}` };
}
