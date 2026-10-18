import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { ATTENDANCE, ATTENDANCE_SHORT } from "@/lib/constants";
import { dayFromParam, isoDay, toDay } from "@/lib/utils";
import { ClassHeader } from "@/components/ClassHeader";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { saveAttendance } from "@/actions/classroom";

export default async function AttendancePage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  const date = dayFromParam((await searchParams).date);
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

  const [students, records, monthly] = await Promise.all([
    db.student.findMany({ where: { classId: cls.id, status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    db.attendance.findMany({ where: { classId: cls.id, date } }),
    db.attendance.groupBy({
      by: ["studentId", "status"],
      where: { classId: cls.id, date: { gte: monthStart, lt: monthEnd }, status: { not: "PRESENT" } },
      _count: true,
    }),
  ]);
  const byStudent = new Map(records.map((r) => [r.studentId, r]));
  const monthCount = (sid: string, st: string) => monthly.find((m) => m.studentId === sid && m.status === st)?._count ?? 0;
  const summary = Object.keys(ATTENDANCE).map((k) => [k, records.filter((r) => r.status === k).length] as const);

  return (
    <>
      <ClassHeader cls={cls} active="attendance" />
      <div className="card">
        <form className="inline" method="get">
          <div className="field"><label>Ngày điểm danh</label><input type="date" name="date" defaultValue={isoDay(date)} max={isoDay(toDay())} /></div>
          <button className="secondary">Xem</button>
          <span className="muted small" style={{ marginLeft: "auto" }}>
            {records.length ? summary.map(([k, n]) => `${ATTENDANCE[k as keyof typeof ATTENDANCE]}: ${n}`).join(" · ") : "Chưa điểm danh ngày này"}
          </span>
        </form>
      </div>
      <div className="card">
        <ActionForm action={saveAttendance}>
          <input type="hidden" name="classId" value={cls.id} />
          <input type="hidden" name="date" value={isoDay(date)} />
          <div className="table-wrap">
            <table>
              <thead>
                <tr><th>#</th><th>Họ tên</th><th>Trạng thái</th><th className="hide-sm">Ghi chú</th><th className="hide-sm" title="Trong tháng">Tháng: P / KP / Muộn</th></tr>
              </thead>
              <tbody>
                {students.map((s, i) => {
                  const cur = byStudent.get(s.id)?.status ?? "PRESENT";
                  return (
                    <tr key={s.id}>
                      <td>{i + 1}</td>
                      <td><strong>{s.fullName}</strong></td>
                      <td>
                        <div className="att-options">
                          {Object.entries(ATTENDANCE).map(([k, v]) => (
                            <label key={k}>
                              <input type="radio" name={`status_${s.id}`} value={k} defaultChecked={cur === k} />
                              <span className="full">{v}</span>
                              <span className="short">{ATTENDANCE_SHORT[k as keyof typeof ATTENDANCE]}</span>
                            </label>
                          ))}
                        </div>
                      </td>
                      <td className="hide-sm"><input name={`note_${s.id}`} defaultValue={byStudent.get(s.id)?.note ?? ""} placeholder="Lý do…" /></td>
                      <td className="small hide-sm">{monthCount(s.id, "EXCUSED")} / {monthCount(s.id, "UNEXCUSED")} / {monthCount(s.id, "LATE")}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {students.length > 0 ? <div style={{ marginTop: 14 }}><SubmitButton>Lưu điểm danh</SubmitButton></div> : <p className="muted">Lớp chưa có học sinh.</p>}
        </ActionForm>
      </div>
    </>
  );
}
