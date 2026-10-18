import { db } from "@/lib/db";
import { ATTENDANCE, RATINGS } from "@/lib/constants";
import { MAX_TX, classify, formatResult, subjectResult } from "@/lib/grades";
import { fmtDate } from "@/lib/utils";

/** Hồ sơ học tập của một học sinh: điểm, chuyên cần, nề nếp, rèn luyện. Dùng chung cho GV và phụ huynh. */
export async function StudentRecord({ studentId, academicYearId, schoolId }: { studentId: string; academicYearId: string; schoolId: string }) {
  const [subjects, grades, absences, records, evaluations] = await Promise.all([
    db.subject.findMany({ where: { schoolId, active: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
    db.grade.findMany({ where: { studentId, academicYearId } }),
    db.attendance.findMany({ where: { studentId, status: { not: "PRESENT" } }, orderBy: { date: "desc" }, take: 50 }),
    db.conductRecord.findMany({ where: { studentId }, orderBy: { date: "desc" }, take: 50 }),
    db.conductEvaluation.findMany({ where: { studentId }, include: { academicYear: true }, orderBy: [{ academicYear: { name: "desc" } }, { semester: "desc" }] }),
  ]);
  const used = subjects.filter((s) => grades.some((g) => g.subjectId === s.id));
  const res = (sid: string, type: string, hk: 0 | 1 | 2) => subjectResult(type, grades.filter((g) => g.subjectId === sid), hk);
  const rank = (hk: 0 | 1 | 2) => {
    const r = classify(used.filter((s) => hk === 0 || grades.some((g) => g.subjectId === s.id && g.semester === hk)).map((s) => res(s.id, s.type, hk)));
    return r ? RATINGS[r] : "—";
  };
  const detail = (sid: string, hk: number) => {
    const g = grades.filter((x) => x.subjectId === sid && x.semester === hk);
    const tx = Array.from({ length: MAX_TX }, (_, i) => g.find((x) => x.kind === "TX" && x.idx === i + 1)?.score).filter((x) => x != null);
    const gk = g.find((x) => x.kind === "GK")?.score;
    const ck = g.find((x) => x.kind === "CK")?.score;
    return [tx.join("  "), gk ?? "", ck ?? ""];
  };

  return (
    <>
      <div className="card table-wrap">
        <h2>Kết quả học tập năm học hiện tại</h2>
        {used.length === 0 ? <p className="muted">Chưa có điểm.</p> : (
          <table className="grade-table">
            <thead>
              <tr><th className="name">Môn</th><th>HK1: TX</th><th>GK</th><th>CK</th><th>ĐTB HK1</th><th>HK2: TX</th><th>GK</th><th>CK</th><th>ĐTB HK2</th><th>Cả năm</th></tr>
            </thead>
            <tbody>
              {used.map((s) => (
                <tr key={s.id}>
                  <td className="name">{s.name}</td>
                  {s.type === "SCORE" ? detail(s.id, 1).map((v, i) => <td key={i}>{v}</td>) : <td colSpan={3} />}
                  <td className="avg">{formatResult(res(s.id, s.type, 1))}</td>
                  {s.type === "SCORE" ? detail(s.id, 2).map((v, i) => <td key={i}>{v}</td>) : <td colSpan={3} />}
                  <td className="avg">{formatResult(res(s.id, s.type, 2))}</td>
                  <td className="avg">{formatResult(res(s.id, s.type, 0))}</td>
                </tr>
              ))}
              <tr>
                <td className="name"><strong>Kết quả học tập</strong></td>
                <td colSpan={4}><strong>{rank(1)}</strong></td>
                <td colSpan={4}><strong>{rank(2)}</strong></td>
                <td><strong>{rank(0)}</strong></td>
              </tr>
            </tbody>
          </table>
        )}
      </div>
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))" }}>
        <div className="card">
          <h2>Chuyên cần ({absences.length})</h2>
          <table><tbody>
            {absences.map((a) => (
              <tr key={a.id}>
                <td>{fmtDate(a.date)}</td>
                <td><span className={`badge ${a.status === "UNEXCUSED" ? "danger" : "warn"}`}>{ATTENDANCE[a.status as keyof typeof ATTENDANCE]}</span></td>
                <td className="small muted">{a.note}</td>
              </tr>
            ))}
            {absences.length === 0 && <tr><td className="muted">Đi học đầy đủ.</td></tr>}
          </tbody></table>
        </div>
        <div className="card">
          <h2>Nề nếp ({records.length})</h2>
          <table><tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.date)}</td>
                <td><span className={`badge ${r.type === "PRAISE" ? "ok" : "danger"}`}>{r.type === "PRAISE" ? "Khen" : "Vi phạm"}</span></td>
                <td>{r.content}</td>
              </tr>
            ))}
            {records.length === 0 && <tr><td className="muted">Chưa có ghi nhận.</td></tr>}
          </tbody></table>
        </div>
        <div className="card">
          <h2>Rèn luyện</h2>
          <table><tbody>
            {evaluations.map((e) => (
              <tr key={e.id}>
                <td>{e.academicYear.name} · HK{e.semester}</td>
                <td><strong>{RATINGS[e.rating as keyof typeof RATINGS]}</strong></td>
                <td className="small muted">{e.comment}</td>
              </tr>
            ))}
            {evaluations.length === 0 && <tr><td className="muted">Chưa có đánh giá.</td></tr>}
          </tbody></table>
        </div>
      </div>
    </>
  );
}
