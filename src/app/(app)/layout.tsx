import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { logout } from "@/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const isFamily = user.role === "STUDENT" || user.role === "PARENT";

  const myClasses =
    user.role === "TEACHER"
      ? await db.class.findMany({
          where: { homeroomTeacherId: user.id, academicYear: { isCurrent: true } },
          orderBy: { name: "asc" },
        })
      : [];
  const unreadByClass = myClasses.length
    ? await db.message.groupBy({
        by: ["studentId"],
        where: { fromFamily: true, read: false, student: { classId: { in: myClasses.map((c) => c.id) } } },
        _count: true,
      }).then(async (g) => {
        const st = await db.student.findMany({ where: { id: { in: g.map((x) => x.studentId) } }, select: { id: true, classId: true } });
        const m = new Map<string, number>();
        for (const x of g) {
          const cid = st.find((s) => s.id === x.studentId)!.classId;
          m.set(cid, (m.get(cid) ?? 0) + x._count);
        }
        return m;
      })
    : new Map<string, number>();

  const children_ = isFamily
    ? await db.student.findMany({
        where: user.role === "PARENT" ? { parentUserId: user.id } : { userId: user.id },
        orderBy: { fullName: "asc" },
        include: {
          _count: { select: { messages: { where: { fromFamily: false, read: false } } } },
        },
      })
    : [];

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">📘 Lớp chủ nhiệm</div>
        <div className="school">{user.schoolName ?? "Quản trị hệ thống"}</div>
        {!isFamily && <Link href="/dashboard">Tổng quan</Link>}

        {user.role === "SUPER_ADMIN" && (
          <>
            <div className="section">Hệ thống</div>
            <Link href="/admin/schools">Danh sách trường</Link>
          </>
        )}
        {user.role === "SCHOOL_ADMIN" && (
          <>
            <div className="section">Nhà trường</div>
            <Link href="/school/classes">Năm học & lớp</Link>
            <Link href="/school/import">Nhập học sinh toàn trường</Link>
            <Link href="/school/teachers">Giáo viên</Link>
            <Link href="/school/subjects">Môn học</Link>
            <Link href="/school/reports">Mẫu báo cáo</Link>
            <Link href="/school/settings">Cài đặt trường</Link>
          </>
        )}
        {myClasses.length > 0 && (
          <>
            <div className="section">Lớp chủ nhiệm</div>
            {myClasses.map((c) => (
              <Link key={c.id} href={`/classes/${c.id}`}>
                Lớp {c.name}
                {unreadByClass.get(c.id) ? <span className="count" title="Tin nhắn mới">{unreadByClass.get(c.id)}</span> : null}
              </Link>
            ))}
          </>
        )}
        {isFamily && (
          <>
            <div className="section">{user.role === "PARENT" ? "Con của tôi" : "Học tập"}</div>
            {children_.map((s) => (
              <span key={s.id}>
                <Link href={`/portal/${s.id}`}>{user.role === "PARENT" ? s.fullName : "Kết quả học tập"}</Link>
                <Link href={`/portal/${s.id}/messages`} style={{ paddingLeft: 22, fontSize: ".88rem" }}>
                  Liên lạc{s._count.messages ? <span className="count">{s._count.messages}</span> : null}
                </Link>
              </span>
            ))}
          </>
        )}

        <div className="spacer" />
        <div className="user">
          <div><strong>{user.name}</strong></div>
          <div className="small" style={{ color: "#9fb0d4" }}>{ROLES[user.role]}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
            <Link href="/account" style={{ padding: 0, color: "#9fb0d4" }} className="small">Đổi mật khẩu</Link>
            <form action={logout}><button className="link">Đăng xuất</button></form>
          </div>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
