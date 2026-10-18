import Link from "next/link";
import { db } from "@/lib/db";
import { terms } from "@/lib/constants";
import { toDay } from "@/lib/utils";
import type { CurrentUser } from "@/lib/auth";
import { Empty, QuickAction } from "@/components/ui";
import { PushBanner } from "@/components/Push";
import { vapidPublicKey } from "@/lib/notify";

export async function TeacherDashboard({ user }: { user: CurrentUser }) {
  const t = terms(user.schoolType);
  const today = toDay();
  const classes = await db.class.findMany({
    where: { homeroomTeacherId: user.id, academicYear: { isCurrent: true } },
    orderBy: { name: "asc" },
    include: { _count: { select: { students: { where: { status: "ACTIVE" } } } } },
  });
  const ids = classes.map((c) => c.id);
  const [att, unread, announcements] = await Promise.all([
    db.attendance.groupBy({ by: ["classId", "status"], where: { classId: { in: ids }, date: today }, _count: true }),
    db.message.findMany({ where: { fromFamily: true, read: false, student: { classId: { in: ids } } }, select: { student: { select: { classId: true } } } }),
    user.schoolId
      ? db.announcement.findMany({ where: { schoolId: user.schoolId, classId: null }, orderBy: { createdAt: "desc" }, take: 3 })
      : [],
  ]);
  const hour = Number(new Date().toLocaleString("en-US", { timeZone: "Asia/Ho_Chi_Minh", hour: "numeric", hour12: false }));
  const greet = hour < 11 ? "Chào buổi sáng" : hour < 14 ? "Chào buổi trưa" : hour < 18 ? "Chào buổi chiều" : "Chào buổi tối";

  return (
    <>
      <div className="card hero">
        <div className="hero-sub small">{today.toLocaleDateString("vi-VN", { timeZone: "UTC", weekday: "long", day: "numeric", month: "numeric", year: "numeric" })}</div>
        <h1 style={{ margin: "4px 0 2px" }}>{greet}, {user.name.split(" ").pop()}!</h1>
        <div className="hero-sub">{user.schoolName}</div>
      </div>

      <PushBanner vapidKey={vapidPublicKey} text="Nhận tin ngay khi phụ huynh nhắn tin, xác nhận báo cáo hay cam kết với mục tiêu của con." />

      {classes.length === 0 && (
        <div className="card"><Empty icon="school">Bạn chưa được phân công chủ nhiệm lớp nào trong năm học hiện tại.</Empty></div>
      )}

      {classes.map((c) => {
        const mine = att.filter((a) => a.classId === c.id);
        const done = mine.length > 0;
        const absent = mine.filter((a) => a.status === "EXCUSED" || a.status === "UNEXCUSED").reduce((n, a) => n + a._count, 0);
        const late = mine.filter((a) => a.status === "LATE").reduce((n, a) => n + a._count, 0);
        const msgs = unread.filter((m) => m.student.classId === c.id).length;
        const base = `/classes/${c.id}`;
        return (
          <div className="card" key={c.id}>
            <div className="card-head">
              <div>
                <h2 style={{ marginBottom: 2 }}>Lớp {c.name}</h2>
                <div className="small muted">Sĩ số {c._count.students} {t.learnerLower}</div>
              </div>
              <Link className="btn secondary sm" href={base}>Danh sách lớp</Link>
            </div>
            {!done ? (
              <div className="alert warn" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ flex: 1 }}>Hôm nay lớp chưa được điểm danh.</span>
                <Link className="btn sm" href={`${base}/attendance`}>Điểm danh ngay</Link>
              </div>
            ) : (
              <div className="alert success">Đã điểm danh hôm nay · Vắng {absent} · Đi muộn {late}</div>
            )}
            {msgs > 0 && (
              <div className="alert info" style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                <span style={{ flex: 1 }}>Có {msgs} tin nhắn mới từ phụ huynh.</span>
                <Link className="btn secondary sm" href={`${base}/messages`}>Xem tin nhắn</Link>
              </div>
            )}
            <div className="quick">
              <QuickAction href={`${base}/attendance`} icon="attendance" label="Điểm danh" />
              <QuickAction href={`${base}/conduct`} icon="conduct" label="Ghi nề nếp" />
              <QuickAction href={`${base}/grades`} icon="grades" label="Nhập điểm" />
              <QuickAction href={`${base}/messages`} icon="messages" label="Liên lạc PH" />
              <QuickAction href={`${base}/evaluation`} icon="evaluation" label="Rèn luyện" />
              <QuickAction href={`${base}/reports`} icon="reports" label="Báo cáo" />
            </div>
          </div>
        );
      })}

      {announcements.length > 0 && (
        <div className="card">
          <h2>Thông báo của {t.unitLower}</h2>
          <div className="list">
            {announcements.map((a) => (
              <div className="list-item" key={a.id}>
                <div className="li-body">
                  <div className="li-title">{a.title}</div>
                  <div className="li-text">{a.content}</div>
                  <div className="li-meta">{a.createdAt.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
