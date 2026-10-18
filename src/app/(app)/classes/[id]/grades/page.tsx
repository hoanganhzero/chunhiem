import Link from "next/link";
import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { MAX_TX, commentResult, semesterAverage } from "@/lib/grades";
import { vnNameCompare } from "@/lib/utils";
import { ClassHeader } from "@/components/ClassHeader";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { saveGrades } from "@/actions/grades";

export default async function GradesPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ mon?: string; hk?: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  const sp = await searchParams;
  const semester = sp.hk === "2" ? 2 : 1;
  const subjects = await db.subject.findMany({ where: { schoolId: cls.schoolId, active: true }, orderBy: [{ order: "asc" }, { name: "asc" }] });
  const subject = subjects.find((s) => s.id === sp.mon) ?? subjects[0];

  const students = await db.student.findMany({ where: { classId: cls.id, status: "ACTIVE" } });
  students.sort((a, b) => vnNameCompare(a.fullName, b.fullName));
  const grades = subject
    ? await db.grade.findMany({ where: { subjectId: subject.id, academicYearId: cls.academicYearId, semester, studentId: { in: students.map((s) => s.id) } } })
    : [];
  const of = (sid: string) => grades.filter((g) => g.studentId === sid);
  const val = (sid: string, kind: string, idx = 0) => of(sid).find((g) => g.kind === kind && g.idx === idx)?.score;
  const q = (o: Record<string, string>) => "?" + new URLSearchParams({ mon: subject?.id ?? "", hk: String(semester), ...o });

  return (
    <>
      <ClassHeader cls={cls} active="grades" />
      <div className="card">
        <div className="card-head" style={{ marginBottom: 10 }}>
          <div className="chips" style={{ margin: 0 }}>
            {[1, 2].map((hk) => (
              <Link key={hk} href={q({ hk: String(hk) })} className={`chip ${hk === semester ? "active" : ""}`}>Học kỳ {hk}</Link>
            ))}
          </div>
          <Link className="btn secondary sm" href={`/classes/${cls.id}/grades/summary?hk=${semester}`}>Tổng hợp & xếp loại</Link>
        </div>
        <div className="chips" style={{ margin: 0 }} aria-label="Chọn môn">
          {subjects.map((s) => (
            <Link key={s.id} href={q({ mon: s.id })} className={`chip ${s.id === subject?.id ? "active" : ""}`}>{s.name}</Link>
          ))}
        </div>
      </div>

      {!subject ? (
        <div className="card muted">Trường chưa khai báo môn học.</div>
      ) : (
        <div className="card">
          <h2>{subject.name} — Học kỳ {semester}</h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            {subject.type === "SCORE"
              ? "ĐTB = (ΣTX + 2×GK + 3×CK) / (số bài TX + 5) theo TT22. Ô trống = chưa có điểm; dùng dấu chấm hoặc phẩy."
              : "Môn đánh giá bằng nhận xét: Đạt (Đ) / Chưa đạt (CĐ)."}
          </p>
          <ActionForm action={saveGrades}>
            <input type="hidden" name="classId" value={cls.id} />
            <input type="hidden" name="subjectId" value={subject.id} />
            <input type="hidden" name="semester" value={semester} />
            <div className="table-wrap">
              <table className="grade-table">
                <thead>
                  <tr>
                    <th>#</th><th className="name">Họ tên</th>
                    {subject.type === "SCORE" ? (
                      <>
                        {Array.from({ length: MAX_TX }, (_, i) => <th key={i}>TX{i + 1}</th>)}
                        <th>GK</th><th>CK</th><th>ĐTB</th>
                      </>
                    ) : <th>Kết quả</th>}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s, i) => {
                    const avg = semesterAverage(of(s.id));
                    const dg = commentResult(of(s.id));
                    return (
                      <tr key={s.id}>
                        <td>{i + 1}</td>
                        <td className="name">{s.fullName}</td>
                        {subject.type === "SCORE" ? (
                          <>
                            {Array.from({ length: MAX_TX }, (_, k) => (
                              <td key={k}><input className="grade-input" name={`tx${k + 1}_${s.id}`} defaultValue={val(s.id, "TX", k + 1) ?? ""} inputMode="decimal" /></td>
                            ))}
                            <td><input className="grade-input" name={`gk_${s.id}`} defaultValue={val(s.id, "GK") ?? ""} inputMode="decimal" /></td>
                            <td><input className="grade-input" name={`ck_${s.id}`} defaultValue={val(s.id, "CK") ?? ""} inputMode="decimal" /></td>
                            <td className={`avg ${avg != null && avg < 5 ? "low" : ""}`}>{avg?.toFixed(1) ?? ""}</td>
                          </>
                        ) : (
                          <td>
                            <select name={`dg_${s.id}`} defaultValue={dg == null ? "" : dg ? "D" : "CD"}>
                              <option value="">—</option><option value="D">Đạt</option><option value="CD">Chưa đạt</option>
                            </select>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {students.length > 0 && <div className="sticky-actions"><SubmitButton>Lưu điểm {subject.name}</SubmitButton><span className="small muted">Học kỳ {semester}</span></div>}
          </ActionForm>
        </div>
      )}
    </>
  );
}
