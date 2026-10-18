import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { ATTENDANCE } from "@/lib/constants";
import { dayFromParam, isoDay, toDay, vnNameCompare } from "@/lib/utils";
import { ClassHeader } from "@/components/ClassHeader";
import { AttendanceForm } from "@/components/AttendanceForm";
import { Empty } from "@/components/ui";

export const metadata = { title: "Điểm danh" };

export default async function AttendancePage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ date?: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  const date = dayFromParam((await searchParams).date);
  const monthStart = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
  const monthEnd = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1));

  const [students, records, monthly] = await Promise.all([
    db.student.findMany({ where: { classId: cls.id, status: "ACTIVE" } }),
    db.attendance.findMany({ where: { classId: cls.id, date } }),
    db.attendance.groupBy({
      by: ["studentId", "status"],
      where: { classId: cls.id, date: { gte: monthStart, lt: monthEnd }, status: { not: "PRESENT" } },
      _count: true,
    }),
  ]);
  students.sort((a, b) => vnNameCompare(a.fullName, b.fullName));
  const byStudent = new Map(records.map((r) => [r.studentId, r]));
  const mc = (sid: string, st: string) => monthly.find((m) => m.studentId === sid && m.status === st)?._count ?? 0;
  const summary = (Object.keys(ATTENDANCE) as (keyof typeof ATTENDANCE)[]).map((k) => [k, records.filter((r) => r.status === k).length] as const);
  const tone: Record<string, string> = { PRESENT: "ok", LATE: "warn", EXCUSED: "", UNEXCUSED: "danger" };
  const today = toDay();

  return (
    <>
      <ClassHeader cls={cls} active="attendance" />
      <div className="card">
        <form className="att-toolbar" method="get">
          <div className="field" style={{ flex: "0 1 200px" }}>
            <label>Ngày điểm danh</label>
            <input type="date" name="date" defaultValue={isoDay(date)} max={isoDay(today)} />
          </div>
          <button className="secondary">Xem</button>
          <div className="att-summary">
            {records.length
              ? summary.map(([k, n]) => <span key={k} className={`badge ${tone[k]}`}>{ATTENDANCE[k]}: {n}</span>)
              : <span className="badge gray">Chưa điểm danh ngày {date.toLocaleDateString("vi-VN", { timeZone: "UTC" })}</span>}
          </div>
        </form>
      </div>
      <div className="card att-card">
        {students.length === 0 ? <Empty icon="students">Lớp chưa có học sinh.</Empty> : (
          <AttendanceForm
            classId={cls.id}
            date={isoDay(date)}
            rows={students.map((s) => ({
              id: s.id,
              name: s.fullName,
              status: byStudent.get(s.id)?.status ?? "PRESENT",
              note: byStudent.get(s.id)?.note ?? "",
              month: `${mc(s.id, "EXCUSED")}P · ${mc(s.id, "UNEXCUSED")}KP · ${mc(s.id, "LATE")}M`,
            }))}
          />
        )}
      </div>
    </>
  );
}
