import Link from "next/link";
import { requireSchoolAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { assignHomeroom, createAcademicYear, createClass, setCurrentYear } from "@/actions/school";

export default async function ClassesAdminPage({ searchParams }: { searchParams: Promise<{ year?: string }> }) {
  const { schoolId } = await requireSchoolAdmin();
  const { year: yearParam } = await searchParams;
  const years = await db.academicYear.findMany({ where: { schoolId }, orderBy: { name: "desc" } });
  const year = years.find((y) => y.id === yearParam) ?? years.find((y) => y.isCurrent) ?? years[0];
  const [classes, teachers] = await Promise.all([
    year
      ? db.class.findMany({
          where: { academicYearId: year.id },
          orderBy: [{ grade: "asc" }, { name: "asc" }],
          include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } },
        })
      : [],
    db.user.findMany({ where: { schoolId, active: true }, orderBy: { name: "asc" } }),
  ]);

  return (
    <>
      <div className="page-head"><h1>Năm học & lớp</h1></div>

      <div className="card">
        <h2>Năm học</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
          {years.map((y) => (
            <Link key={y.id} href={`?year=${y.id}`} className={`btn ${y.id === year?.id ? "" : "secondary"}`}>
              {y.name}{y.isCurrent ? " (hiện tại)" : ""}
            </Link>
          ))}
          {year && !year.isCurrent && (
            <form action={setCurrentYear}>
              <input type="hidden" name="id" value={year.id} />
              <button className="secondary">Đặt {year.name} làm năm hiện tại</button>
            </form>
          )}
        </div>
        <ActionForm action={createAcademicYear} className="inline" resetOnSuccess>
          <div className="field"><label>Thêm năm học</label><input name="name" placeholder="2026-2027" required /></div>
          <SubmitButton className="secondary">Thêm</SubmitButton>
        </ActionForm>
      </div>

      {year && (
        <>
          <div className="card">
            <h2>Thêm lớp — năm học {year.name}</h2>
            <ActionForm action={createClass} className="inline" resetOnSuccess>
              <input type="hidden" name="academicYearId" value={year.id} />
              <div className="field"><label>Tên lớp</label><input name="name" placeholder="10A1" required style={{ width: 110 }} /></div>
              <div className="field"><label>Khối</label><input name="grade" type="number" min={1} max={12} required style={{ width: 80 }} /></div>
              <div className="field">
                <label>GV chủ nhiệm</label>
                <select name="homeroomTeacherId" defaultValue="">
                  <option value="">— Chưa phân công —</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <SubmitButton>Tạo lớp</SubmitButton>
            </ActionForm>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Lớp</th><th>Khối</th><th>Sĩ số</th><th>Giáo viên chủ nhiệm</th><th></th></tr></thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.grade}</td>
                    <td>{c._count.students}</td>
                    <td>
                      <form action={assignHomeroom} className="inline">
                        <input type="hidden" name="id" value={c.id} />
                        <select name="homeroomTeacherId" defaultValue={c.homeroomTeacherId ?? ""}>
                          <option value="">— Chưa phân công —</option>
                          {teachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                        </select>
                        <button className="secondary">Lưu</button>
                      </form>
                    </td>
                    <td><Link href={`/classes/${c.id}`}>Xem lớp →</Link></td>
                  </tr>
                ))}
                {classes.length === 0 && <tr><td colSpan={5} className="muted">Chưa có lớp nào.</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}
