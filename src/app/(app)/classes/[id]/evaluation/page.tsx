import Link from "next/link";
import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { RATINGS } from "@/lib/constants";
import { getPeriod } from "@/lib/period";
import { vnNameCompare } from "@/lib/utils";
import { ClassHeader } from "@/components/ClassHeader";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { saveEvaluations } from "@/actions/classroom";

export default async function EvaluationPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ hk?: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  const semester = (await searchParams).hk === "2" ? 2 : 1;
  const period = getPeriod(cls.academicYear, `HK${semester}`);
  const range = { gte: period.from, lt: period.to };
  const students = await db.student.findMany({
    where: { classId: cls.id, status: "ACTIVE" },
    include: {
      evaluations: { where: { academicYearId: cls.academicYearId, semester } },
      attendances: { where: { date: range, status: { in: ["EXCUSED", "UNEXCUSED"] } }, select: { status: true } },
      conductRecords: { where: { date: range }, select: { type: true, points: true } },
    },
  });
  students.sort((a, b) => vnNameCompare(a.fullName, b.fullName));
  const dist = Object.keys(RATINGS).map(
    (k) => [k, students.filter((s) => s.evaluations[0]?.rating === k).length] as const,
  );

  return (
    <>
      <ClassHeader cls={cls} active="evaluation" />
      <div className="card" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
        {[1, 2].map((hk) => (
          <Link key={hk} href={`?hk=${hk}`} className={`btn ${hk === semester ? "" : "secondary"}`}>Học kỳ {hk}</Link>
        ))}
        <span className="muted small" style={{ marginLeft: "auto" }}>
          {dist.map(([k, n]) => `${RATINGS[k as keyof typeof RATINGS]}: ${n}`).join(" · ")}
        </span>
      </div>
      <div className="card">
        <ActionForm action={saveEvaluations}>
          <input type="hidden" name="classId" value={cls.id} />
          <input type="hidden" name="semester" value={semester} />
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Họ tên</th><th>Vắng trong HK (P/KP)</th><th>Khen / Vi phạm trong HK</th><th>Xếp loại rèn luyện</th><th>Nhận xét</th></tr></thead>
              <tbody>
                {students.map((s, i) => {
                  const ev = s.evaluations[0];
                  const p = s.attendances.filter((a) => a.status === "EXCUSED").length;
                  const kp = s.attendances.length - p;
                  const praise = s.conductRecords.filter((c) => c.type === "PRAISE").length;
                  const viol = s.conductRecords.length - praise;
                  return (
                    <tr key={s.id}>
                      <td>{i + 1}</td>
                      <td><strong>{s.fullName}</strong></td>
                      <td>{p} / {kp}</td>
                      <td>{praise} / {viol}</td>
                      <td>
                        <select name={`rating_${s.id}`} defaultValue={ev?.rating ?? ""}>
                          <option value="">—</option>
                          {Object.entries(RATINGS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td><input name={`comment_${s.id}`} defaultValue={ev?.comment ?? ""} style={{ width: "100%", minWidth: 200 }} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {students.length > 0 && <div style={{ marginTop: 14 }}><SubmitButton>Lưu đánh giá học kỳ {semester}</SubmitButton></div>}
        </ActionForm>
      </div>
    </>
  );
}
