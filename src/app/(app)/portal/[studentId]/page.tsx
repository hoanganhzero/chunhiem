import Link from "next/link";
import { requireFamilyAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/utils";
import { StudentRecord } from "@/components/StudentRecord";

export default async function PortalStudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { user, student } = await requireFamilyAccess(studentId);
  const cls = student.class;
  const [announcements, unread] = await Promise.all([
    db.announcement.findMany({ where: { classId: cls.id }, orderBy: { createdAt: "desc" }, take: 3 }),
    db.message.count({ where: { studentId, fromFamily: false, read: false } }),
  ]);
  return (
    <>
      <div className="page-head">
        <div>
          <h1>{student.fullName}</h1>
          <div className="muted">
            Lớp {cls.name} · Năm học {cls.academicYear.name} · GVCN: {cls.homeroomTeacher?.name ?? "—"}
            {cls.homeroomTeacher?.phone && <> · <a href={`tel:${cls.homeroomTeacher.phone}`}>{cls.homeroomTeacher.phone}</a></>}
          </div>
        </div>
        <Link className="btn" href={`/portal/${student.id}/messages`}>
          💬 {user.role === "PARENT" ? "Liên lạc với GVCN" : "Thông báo lớp"}{unread && user.role === "PARENT" ? ` (${unread} tin mới)` : ""}
        </Link>
      </div>
      {announcements.length > 0 && (
        <div className="card">
          <h2>📢 Thông báo mới của lớp</h2>
          {announcements.map((a) => (
            <div key={a.id} style={{ marginBottom: 10 }}>
              <strong>{a.title}</strong> <span className="small muted">· {fmtDate(a.createdAt)}</span>
              <div style={{ whiteSpace: "pre-wrap" }}>{a.content}</div>
            </div>
          ))}
        </div>
      )}
      <StudentRecord studentId={student.id} academicYearId={cls.academicYearId} schoolId={student.schoolId} />
    </>
  );
}
