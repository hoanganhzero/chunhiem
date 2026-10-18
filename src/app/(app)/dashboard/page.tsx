import Link from "next/link";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { SCHOOL_VIEW_ROLES } from "@/lib/constants";
import { PageHeader, StatCard } from "@/components/ui";
import { SchoolDashboard } from "@/components/dashboards/SchoolDashboard";
import { TeacherDashboard } from "@/components/dashboards/TeacherDashboard";

export const metadata = { title: "Tổng quan" };

export default async function Dashboard() {
  const user = await requireUser();

  if (user.role === "STUDENT" || user.role === "PARENT") {
    const first = await db.student.findFirst({
      where: user.role === "PARENT" ? { parentUserId: user.id } : { userId: user.id },
      orderBy: { fullName: "asc" },
    });
    redirect(first ? `/portal/${first.id}` : "/account");
  }

  if (user.role === "SUPER_ADMIN") {
    const [schools, students, staff] = await Promise.all([
      db.school.count(),
      db.student.count({ where: { status: "ACTIVE" } }),
      db.user.count({ where: { role: { in: ["SCHOOL_ADMIN", "LEADER", "ACADEMIC", "TEACHER"] } } }),
    ]);
    return (
      <>
        <PageHeader title="Tổng quan hệ thống" actions={<Link className="btn" href="/admin/schools">Quản lý đơn vị</Link>} />
        <div className="grid stats">
          <StatCard icon="building" value={schools} label="Trường / trung tâm" />
          <StatCard icon="teachers" value={staff} label="Cán bộ, giáo viên" />
          <StatCard icon="learner" value={students.toLocaleString("vi-VN")} label="Học sinh, học viên" />
        </div>
      </>
    );
  }

  if (SCHOOL_VIEW_ROLES.includes(user.role)) return <SchoolDashboard user={user} />;
  return <TeacherDashboard user={user} />;
}
