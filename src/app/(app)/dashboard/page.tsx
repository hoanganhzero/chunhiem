import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toDay } from "@/lib/utils";

export default async function Dashboard() {
  const user = await requireUser();
  const today = toDay();

  if (user.role === "STUDENT" || user.role === "PARENT") {
    const first = await db.student.findFirst({
      where: user.role === "PARENT" ? { parentUserId: user.id } : { userId: user.id },
      orderBy: { fullName: "asc" },
    });
    redirect(first ? `/portal/${first.id}` : "/account");
  }

  if (user.role === "SUPER_ADMIN") {
    const [schools, students, teachers] = await Promise.all([
      db.school.count(),
      db.student.count({ where: { status: "ACTIVE" } }),
      db.user.count({ where: { role: { in: ["SCHOOL_ADMIN", "TEACHER"] } } }),
    ]);
    return (
      <>
        <div className="page-head"><h1>Tổng quan hệ thống</h1></div>
        <div className="grid stats">
          <Stat num={schools} label="Trường" />
          <Stat num={teachers} label="Tài khoản giáo viên / quản trị" />
          <Stat num={students} label="Học sinh đang học" />
        </div>
        <Link className="btn" href="/admin/schools">Quản lý trường</Link>
      </>
    );
  }

  const classWhere =
    user.role === "SCHOOL_ADMIN"
      ? { schoolId: user.schoolId!, academicYear: { isCurrent: true } }
      : { homeroomTeacherId: user.id, academicYear: { isCurrent: true } };

  const classes = await db.class.findMany({
    where: classWhere,
    orderBy: [{ grade: "asc" }, { name: "asc" }],
    include: {
      homeroomTeacher: { select: { name: true } },
      _count: { select: { students: { where: { status: "ACTIVE" } } } },
    },
  });
  const ids = classes.map((c) => c.id);
  const todayAtt = await db.attendance.groupBy({
    by: ["classId", "status"],
    where: { classId: { in: ids }, date: today },
    _count: true,
  });
  const absentBy = (id: string) =>
    todayAtt.filter((a) => a.classId === id && (a.status === "EXCUSED" || a.status === "UNEXCUSED")).reduce((n, a) => n + a._count, 0);
  const takenBy = (id: string) => todayAtt.some((a) => a.classId === id);
  const totalStudents = classes.reduce((n, c) => n + c._count.students, 0);
  const totalAbsent = ids.reduce((n, id) => n + absentBy(id), 0);
  const notTaken = classes.filter((c) => !takenBy(c.id)).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Xin chào, {user.name}</h1>
          <div className="muted">Hôm nay {today.toLocaleDateString("vi-VN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "numeric", year: "numeric" })}</div>
        </div>
      </div>
      <div className="grid stats">
        <Stat num={classes.length} label="Lớp năm học hiện tại" />
        <Stat num={totalStudents} label="Học sinh đang học" />
        <Stat num={totalAbsent} label="Vắng hôm nay" />
        <Stat num={notTaken} label="Lớp chưa điểm danh hôm nay" />
      </div>
      <div className="card">
        <h2>Lớp {user.role === "TEACHER" ? "chủ nhiệm" : "trong trường"}</h2>
        {classes.length === 0 ? (
          <p className="muted">
            {user.role === "SCHOOL_ADMIN"
              ? <>Chưa có lớp nào. <Link href="/school/classes">Tạo năm học và lớp</Link>.</>
              : "Bạn chưa được phân công chủ nhiệm lớp nào trong năm học hiện tại."}
          </p>
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Lớp</th><th>GVCN</th><th>Sĩ số</th><th>Vắng hôm nay</th><th>Điểm danh</th><th></th></tr></thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.homeroomTeacher?.name ?? <span className="muted">Chưa phân công</span>}</td>
                    <td>{c._count.students}</td>
                    <td>{absentBy(c.id)}</td>
                    <td>{takenBy(c.id) ? <span className="badge ok">Đã điểm danh</span> : <span className="badge warn">Chưa</span>}</td>
                    <td><Link href={`/classes/${c.id}`}>Mở lớp →</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function Stat({ num, label }: { num: number; label: string }) {
  return (
    <div className="card stat">
      <div className="num">{num}</div>
      <div className="label">{label}</div>
    </div>
  );
}
