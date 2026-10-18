import Link from "next/link";
import { db } from "@/lib/db";
import { MANAGER_ROLES, roleLabel, terms } from "@/lib/constants";
import { toDay } from "@/lib/utils";
import type { CurrentUser } from "@/lib/auth";
import { BarChart, Empty, PageHeader, QuickAction, StatCard } from "@/components/ui";
import { Icon } from "@/components/Icon";

/** Trang tổng quan cho BGH / Ban Giám đốc, giáo vụ, quản trị. */
export async function SchoolDashboard({ user }: { user: CurrentUser }) {
  const schoolId = user.schoolId!;
  const t = terms(user.schoolType);
  const today = toDay();
  const from = new Date(today.getTime() - 13 * 86400000);
  const isManager = MANAGER_ROLES.includes(user.role);

  const year = await db.academicYear.findFirst({ where: { schoolId, isCurrent: true } });
  const classes = year
    ? await db.class.findMany({
        where: { academicYearId: year.id },
        orderBy: [{ grade: "asc" }, { name: "asc" }],
        include: { homeroomTeacher: { select: { name: true } }, _count: { select: { students: { where: { status: "ACTIVE" } } } } },
      })
    : [];
  const ids = classes.map((c) => c.id);
  const [todayAtt, series, teachers, noAccount, announcements] = await Promise.all([
    db.attendance.groupBy({ by: ["classId", "status"], where: { classId: { in: ids }, date: today }, _count: true }),
    db.attendance.groupBy({
      by: ["date"], where: { classId: { in: ids }, date: { gte: from, lte: today }, status: { in: ["EXCUSED", "UNEXCUSED"] } }, _count: true,
    }),
    db.user.count({ where: { schoolId, role: { in: ["TEACHER", "LEADER", "ACADEMIC", "SCHOOL_ADMIN"] }, active: true } }),
    isManager ? db.student.count({ where: { schoolId, status: "ACTIVE", OR: [{ userId: null }, { parentUserId: null }] } }) : 0,
    db.announcement.findMany({ where: { schoolId, classId: null }, orderBy: { createdAt: "desc" }, take: 3 }),
  ]);

  const count = (cid: string, st: string[]) => todayAtt.filter((a) => a.classId === cid && st.includes(a.status)).reduce((n, a) => n + a._count, 0);
  const taken = classes.filter((c) => todayAtt.some((a) => a.classId === c.id));
  const totalStudents = classes.reduce((n, c) => n + c._count.students, 0);
  const takenStudents = taken.reduce((n, c) => n + c._count.students, 0);
  const absentP = ids.reduce((n, id) => n + count(id, ["EXCUSED"]), 0);
  const absentKP = ids.reduce((n, id) => n + count(id, ["UNEXCUSED"]), 0);
  const rate = takenStudents ? Math.round(((takenStudents - absentP - absentKP) / takenStudents) * 1000) / 10 : null;
  const noHomeroom = classes.filter((c) => !c.homeroomTeacherId);

  const days = Array.from({ length: 14 }, (_, i) => new Date(from.getTime() + i * 86400000));
  const chart = days.map((d) => ({
    label: `${d.getUTCDate()}`,
    full: d.toLocaleDateString("vi-VN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "numeric" }),
    value: series.find((s) => s.date.getTime() === d.getTime())?._count ?? 0,
  }));

  return (
    <>
      <PageHeader
        eyebrow={`${roleLabel(user.role, user.schoolType)} · ${user.schoolName}`}
        title="Tổng quan"
        sub={<>Năm học {year?.name ?? "—"} · {today.toLocaleDateString("vi-VN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "numeric", year: "numeric" })}</>}
        actions={<Link className="btn secondary" href="/school/stats">Thống kê học tập</Link>}
      />

      <div className="grid stats">
        <StatCard icon="learner" value={totalStudents.toLocaleString("vi-VN")} label={`${t.learner} đang học`} sub={`${classes.length} lớp · ${teachers} cán bộ, GV`} />
        <StatCard icon="attendance" tone="ok" value={rate == null ? "—" : `${rate}%`} label="Chuyên cần hôm nay" sub={`${takenStudents.toLocaleString("vi-VN")} ${t.learnerLower} đã điểm danh`} />
        <StatCard icon="conduct" tone={absentKP ? "danger" : undefined} value={absentP + absentKP} label="Vắng hôm nay" sub={`${absentP} có phép · ${absentKP} không phép`} />
        <StatCard icon="tasks" tone={classes.length - taken.length ? "warn" : "ok"} value={`${taken.length}/${classes.length}`} label="Lớp đã điểm danh" />
      </div>

      <div className="grid two">
        <div className="card">
          <div className="card-head"><h2>Lượt vắng 14 ngày qua</h2><span className="small muted">Có phép + không phép</span></div>
          <BarChart data={chart} unit="lượt vắng" />
        </div>
        <div className="card">
          <div className="card-head">
            <h2>Thông báo toàn {t.unitLower}</h2>
            <Link className="btn secondary sm" href="/school/announcements">Gửi thông báo</Link>
          </div>
          {announcements.length === 0 ? <Empty icon="announce">Chưa có thông báo.</Empty> : (
            <div className="list">
              {announcements.map((a) => (
                <div className="list-item" key={a.id}>
                  <div className="li-icon"><Icon name="announce" size={18} /></div>
                  <div className="li-body">
                    <div className="li-title">{a.title}</div>
                    <div className="li-text">{a.content.length > 140 ? a.content.slice(0, 140) + "…" : a.content}</div>
                    <div className="li-meta">{a.createdAt.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {isManager && (noHomeroom.length > 0 || noAccount > 0 || !year) && (
        <div className="card">
          <h2>Việc cần xử lý</h2>
          <div className="list">
            {!year && <div className="list-item"><div className="li-body"><Link href="/school/classes">Tạo năm học hiện tại</Link> để bắt đầu.</div></div>}
            {noHomeroom.length > 0 && (
              <div className="list-item">
                <div className="li-body">
                  <div className="li-title">{noHomeroom.length} lớp chưa phân công GVCN</div>
                  <div className="li-meta">{noHomeroom.map((c) => c.name).join(", ")} · <Link href="/school/classes">Phân công</Link></div>
                </div>
              </div>
            )}
            {noAccount > 0 && (
              <div className="list-item">
                <div className="li-body">
                  <div className="li-title">{noAccount} {t.learnerLower} chưa đủ tài khoản {t.learnerLower} / phụ huynh</div>
                  <div className="li-meta">GVCN vào tab “Tài khoản” của lớp → “Tạo tài khoản còn thiếu”</div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {isManager && (
        <div className="card">
          <h2>Thao tác nhanh</h2>
          <div className="quick">
            <QuickAction href="/school/import" icon="upload" label={`Nhập ${t.learnerLower}`} sub="Từ tệp Excel" />
            <QuickAction href="/school/teachers" icon="teachers" label="Cán bộ, giáo viên" sub="Tài khoản, phân quyền" />
            <QuickAction href="/school/classes" icon="school" label="Năm học & lớp" sub="Phân công GVCN" />
            <QuickAction href="/school/reports" icon="reports" label="Mẫu báo cáo" sub="Biểu mẫu của đơn vị" />
          </div>
        </div>
      )}

      <div className="card flush">
        <div className="card-head"><h2>Điểm danh hôm nay theo lớp</h2></div>
        {classes.length === 0 ? <Empty icon="school">Chưa có lớp trong năm học hiện tại.</Empty> : (
          <div className="table-wrap" style={{ marginTop: 12 }}>
            <table className="responsive">
              <thead><tr><th>Lớp</th><th>GVCN</th><th>Sĩ số</th><th>Trạng thái</th><th>Vắng P</th><th>Vắng KP</th><th></th></tr></thead>
              <tbody>
                {classes.map((c) => {
                  const done = taken.includes(c);
                  return (
                    <tr key={c.id}>
                      <td className="primary"><strong>Lớp {c.name}</strong></td>
                      <td data-label="GVCN">{c.homeroomTeacher?.name ?? <span className="badge warn">Chưa phân công</span>}</td>
                      <td data-label="Sĩ số">{c._count.students}</td>
                      <td data-label="Điểm danh">{done ? <span className="badge ok">Đã điểm danh</span> : <span className="badge gray">Chưa</span>}</td>
                      <td data-label="Vắng có phép">{count(c.id, ["EXCUSED"]) || "–"}</td>
                      <td data-label="Vắng không phép">{count(c.id, ["UNEXCUSED"]) ? <span className="badge danger">{count(c.id, ["UNEXCUSED"])}</span> : "–"}</td>
                      <td data-label=""><Link href={`/classes/${c.id}`}>Xem lớp →</Link></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
