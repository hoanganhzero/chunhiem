import Link from "next/link";
import { MessageCircle, Phone, TrendingUp } from "lucide-react";
import { requireFamilyAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { RATINGS, terms } from "@/lib/constants";
import { classify, subjectResult } from "@/lib/grades";
import { getPeriod, semesterOf } from "@/lib/period";
import { toDay } from "@/lib/utils";
import { StudentRecord } from "@/components/StudentRecord";
import { Icon } from "@/components/Icon";
import { StatCard } from "@/components/ui";

export const metadata = { title: "Kết quả học tập" };

export default async function PortalStudentPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { user, student } = await requireFamilyAccess(studentId);
  const cls = student.class;
  const school = await db.school.findUniqueOrThrow({ where: { id: student.schoolId } });
  const t = terms(school.type);
  const hk = semesterOf(cls.academicYear, toDay());
  const period = getPeriod(cls.academicYear, `HK${hk}`);
  const range = { gte: period.from, lt: period.to };

  const [siblings, announcements, unread, att, conduct, subjects, grades] = await Promise.all([
    user.role === "PARENT" ? db.student.findMany({ where: { parentUserId: user.id }, orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }) : [],
    db.announcement.findMany({
      where: { schoolId: student.schoolId, OR: [{ classId: cls.id }, { classId: null }] },
      orderBy: { createdAt: "desc" }, take: 4,
    }),
    db.message.count({ where: { studentId, fromFamily: false, read: false } }),
    db.attendance.groupBy({ by: ["status"], where: { studentId, date: range }, _count: true }),
    db.conductRecord.groupBy({ by: ["type"], where: { studentId, date: range }, _count: true }),
    db.subject.findMany({ where: { schoolId: student.schoolId, active: true } }),
    db.grade.findMany({ where: { studentId, academicYearId: cls.academicYearId } }),
  ]);
  const a = (s: string) => att.find((x) => x.status === s)?._count ?? 0;
  const c = (s: string) => conduct.find((x) => x.type === s)?._count ?? 0;
  const used = subjects.filter((s) => grades.some((g) => g.subjectId === s.id && g.semester === hk));
  const rank = classify(used.map((s) => subjectResult(s.type, grades.filter((g) => g.subjectId === s.id), hk)));
  const teacher = cls.homeroomTeacher;

  return (
    <>
      {siblings.length > 1 && (
        <div className="chips" aria-label="Chọn con">
          {siblings.map((s) => (
            <Link key={s.id} href={`/portal/${s.id}`} className={`chip ${s.id === student.id ? "active" : ""}`}>{s.fullName}</Link>
          ))}
        </div>
      )}

      <div className="card hero">
        <div className="hero-sub small">{t.learner} · {school.name}</div>
        <h1 style={{ margin: "4px 0 6px" }}>{student.fullName}</h1>
        <div className="hero-sub">Lớp {cls.name} · Năm học {cls.academicYear.name} · Mã {t.learnerShort}: {student.code}</div>
        <div style={{ display: "flex", gap: 8, marginTop: 14, flexWrap: "wrap", position: "relative", zIndex: 1 }}>
          <Link className="btn light sm" href={`/portal/${student.id}/messages`}>
            <MessageCircle size={16} /> {user.role === "PARENT" ? "Nhắn GVCN" : "Thông báo"}{unread && user.role === "PARENT" ? ` (${unread})` : ""}
          </Link>
          <Link className="btn light sm" href={`/portal/${student.id}/progress`}><TrendingUp size={16} /> Thi đua & tiến bộ</Link>
          {teacher?.phone && (
            <a className="btn light sm" href={`tel:${teacher.phone}`}><Phone size={16} /> Gọi cô/thầy {teacher.name.split(" ").pop()}</a>
          )}
        </div>
      </div>

      <h2 style={{ margin: "4px 0 10px" }}>{period.label}</h2>
      <div className="grid stats">
        <StatCard icon="attendance" tone={a("UNEXCUSED") ? "danger" : "ok"} value={a("EXCUSED") + a("UNEXCUSED")} label="Buổi vắng"
          sub={`${a("EXCUSED")} có phép · ${a("UNEXCUSED")} không phép · ${a("LATE")} muộn`} />
        <StatCard icon="evaluation" tone="ok" value={c("PRAISE")} label="Lần được khen" />
        <StatCard icon="conduct" tone={c("VIOLATION") ? "warn" : undefined} value={c("VIOLATION")} label="Lần vi phạm" />
        <StatCard icon="grades" value={rank ? RATINGS[rank] : "—"} label="Kết quả học tập"
          sub={rank ? `Theo ${used.length} môn đã có điểm` : `${used.length} môn đã có điểm`} />
      </div>

      {announcements.length > 0 && (
        <div className="card">
          <div className="card-head"><h2>Thông báo mới</h2><Link className="small" href={`/portal/${student.id}/messages`}>Xem tất cả</Link></div>
          <div className="list">
            {announcements.map((n) => (
              <div className="list-item" key={n.id}>
                <div className="li-icon"><Icon name={n.classId ? "students" : "announce"} size={18} /></div>
                <div className="li-body">
                  <div className="li-title">{n.title} {!n.classId && <span className="badge gray">{t.unit}</span>}</div>
                  <div className="li-text">{n.content}</div>
                  <div className="li-meta">{n.createdAt.toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <StudentRecord studentId={student.id} academicYearId={cls.academicYearId} schoolId={student.schoolId} />
    </>
  );
}
