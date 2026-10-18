import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { GENDERS, STUDENT_STATUS } from "@/lib/constants";
import { fmtDate, toCsv } from "@/lib/utils";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  const students = await db.student.findMany({ where: { classId: cls.id }, orderBy: { fullName: "asc" } });
  const csv = toCsv([
    ["STT", "Mã HS", "Họ tên", "Ngày sinh", "Giới tính", "Địa chỉ", "Phụ huynh", "SĐT phụ huynh", "Tình trạng", "Ghi chú"],
    ...students.map((s, i) => [
      i + 1, s.code, s.fullName, fmtDate(s.dob),
      s.gender ? GENDERS[s.gender as keyof typeof GENDERS] : "",
      s.address, s.parentName, s.parentPhone,
      STUDENT_STATUS[s.status as keyof typeof STUDENT_STATUS], s.note,
    ]),
  ]);
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="lop-${encodeURIComponent(cls.name)}-${cls.academicYear.name}.csv"`,
    },
  });
}
