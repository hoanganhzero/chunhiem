import Link from "next/link";
import { requireStudentAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { ATTENDANCE, RATINGS } from "@/lib/constants";
import { fmtDate } from "@/lib/utils";
import { StudentFields } from "@/components/StudentFields";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { updateStudent } from "@/actions/classroom";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cls, student } = await requireStudentAccess(id);
  const [absences, records, evaluations] = await Promise.all([
    db.attendance.findMany({ where: { studentId: id, status: { not: "PRESENT" } }, orderBy: { date: "desc" }, take: 50 }),
    db.conductRecord.findMany({ where: { studentId: id }, orderBy: { date: "desc" }, take: 50 }),
    db.conductEvaluation.findMany({ where: { studentId: id }, include: { academicYear: true }, orderBy: [{ academicYear: { name: "desc" } }, { semester: "desc" }] }),
  ]);

  return (
    <>
      <div className="page-head">
        <div>
          <div className="small"><Link href={`/classes/${cls.id}`}>← Lớp {cls.name}</Link></div>
          <h1>{student.fullName}</h1>
          <div className="muted">Mã HS: {student.code}</div>
        </div>
      </div>

      <div className="card">
        <h2>Thông tin học sinh</h2>
        <ActionForm action={updateStudent}>
          <input type="hidden" name="id" value={student.id} />
          <StudentFields s={student} withStatus />
          <SubmitButton>Lưu thay đổi</SubmitButton>
        </ActionForm>
      </div>

      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))" }}>
        <div className="card">
          <h2>Chuyên cần ({absences.length})</h2>
          <table>
            <tbody>
              {absences.map((a) => (
                <tr key={a.id}>
                  <td>{fmtDate(a.date)}</td>
                  <td><span className={`badge ${a.status === "UNEXCUSED" ? "danger" : "warn"}`}>{ATTENDANCE[a.status as keyof typeof ATTENDANCE]}</span></td>
                  <td className="small muted">{a.note}</td>
                </tr>
              ))}
              {absences.length === 0 && <tr><td className="muted">Đi học đầy đủ.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Nề nếp ({records.length})</h2>
          <table>
            <tbody>
              {records.map((r) => (
                <tr key={r.id}>
                  <td>{fmtDate(r.date)}</td>
                  <td><span className={`badge ${r.type === "PRAISE" ? "ok" : "danger"}`}>{r.type === "PRAISE" ? "Khen" : "Vi phạm"}</span></td>
                  <td>{r.content}</td>
                </tr>
              ))}
              {records.length === 0 && <tr><td className="muted">Chưa có ghi nhận.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="card">
          <h2>Đánh giá rèn luyện</h2>
          <table>
            <tbody>
              {evaluations.map((e) => (
                <tr key={e.id}>
                  <td>{e.academicYear.name} · HK{e.semester}</td>
                  <td><strong>{RATINGS[e.rating as keyof typeof RATINGS]}</strong></td>
                  <td className="small muted">{e.comment}</td>
                </tr>
              ))}
              {evaluations.length === 0 && <tr><td className="muted">Chưa có đánh giá.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
