import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES } from "@/lib/constants";
import { logout } from "@/actions/auth";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const myClasses =
    user.role === "TEACHER"
      ? await db.class.findMany({
          where: { homeroomTeacherId: user.id, academicYear: { isCurrent: true } },
          orderBy: { name: "asc" },
        })
      : [];

  return (
    <div className="shell">
      <nav className="sidebar">
        <div className="brand">📘 Lớp chủ nhiệm</div>
        <div className="school">{user.schoolName ?? "Quản trị hệ thống"}</div>
        <Link href="/dashboard">Tổng quan</Link>

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
            <Link href="/school/teachers">Giáo viên</Link>
          </>
        )}
        {myClasses.length > 0 && (
          <>
            <div className="section">Lớp chủ nhiệm</div>
            {myClasses.map((c) => (
              <Link key={c.id} href={`/classes/${c.id}`}>Lớp {c.name}</Link>
            ))}
          </>
        )}

        <div className="spacer" />
        <div className="user">
          <div><strong>{user.name}</strong></div>
          <div className="small" style={{ color: "#9fb0d4" }}>{ROLES[user.role]}</div>
          <div style={{ display: "flex", gap: 12, marginTop: 6 }}>
            <Link href="/account" style={{ padding: 0, color: "#9fb0d4" }} className="small">Tài khoản</Link>
            <form action={logout}><button className="link">Đăng xuất</button></form>
          </div>
        </div>
      </nav>
      <main className="main">{children}</main>
    </div>
  );
}
