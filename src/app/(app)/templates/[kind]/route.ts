import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { studentTemplate, teacherTemplate, xlsxResponse } from "@/lib/excel";

/** Tải tệp Excel mẫu: /templates/hoc-sinh | /templates/giao-vien */
export async function GET(_: Request, { params }: { params: Promise<{ kind: string }> }) {
  const user = await requireUser("SCHOOL_ADMIN", "ACADEMIC", "TEACHER");
  const { kind } = await params;
  const school = user.schoolId ? await db.school.findUnique({ where: { id: user.schoolId } }) : null;
  if (kind === "hoc-sinh") return xlsxResponse(await studentTemplate(school?.defaultPassword), "Mau_nhap_hoc_sinh.xlsx");
  if (kind === "giao-vien" && user.role !== "TEACHER") return xlsxResponse(await teacherTemplate(), "Mau_nhap_giao_vien.xlsx");
  notFound();
}
