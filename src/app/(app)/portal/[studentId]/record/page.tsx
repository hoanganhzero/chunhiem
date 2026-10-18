import { notFound } from "next/navigation";
import { requireFamilyAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { CLASS_ROLES } from "@/lib/constants";
import { ensureCriteria, recorderScope } from "@/lib/emulation";
import { fmtDate, isoDay, toDay } from "@/lib/utils";
import { EmulationRecorder } from "@/components/EmulationRecorder";
import { Empty, PageHeader } from "@/components/ui";
import { deleteEmulation } from "@/actions/emulation";

export const metadata = { title: "Ghi thi đua" };
const STATUS: Record<string, [string, string]> = { PENDING: ["Chờ duyệt", "warn"], APPROVED: ["Đã duyệt", "ok"], REJECTED: ["Không duyệt", "gray"] };

/** Cán sự lớp (tổ trưởng, lớp trưởng, bí thư…) ghi thi đua cho các bạn — GVCN duyệt. */
export default async function RecordPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { user, student } = await requireFamilyAccess(studentId);
  if (user.role !== "STUDENT") notFound();
  const scope = await recorderScope(user.id);
  if (!scope) {
    return (
      <>
        <PageHeader title="Ghi thi đua" />
        <div className="card"><Empty icon="record">Em chưa được GVCN phân công ghi thi đua (tổ trưởng, lớp trưởng, lớp phó, bí thư).</Empty></div>
      </>
    );
  }
  await ensureCriteria(student.classId);
  const [criteria, groups, mine] = await Promise.all([
    db.emulationCriterion.findMany({ where: { classId: student.classId, active: true }, orderBy: { order: "asc" } }),
    db.classGroup.findMany({ where: { classId: student.classId } }),
    db.emulationRecord.findMany({
      where: { recordedById: user.id }, orderBy: { createdAt: "desc" }, take: 30, include: { student: { select: { fullName: true } } },
    }),
  ]);
  const gname = (id: string | null) => groups.find((g) => g.id === id)?.name ?? null;
  const role = CLASS_ROLES[scope.role];

  return (
    <>
      <PageHeader
        eyebrow={`${role.label} · Lớp ${student.class.name}`}
        title="Ghi thi đua"
        sub={role.scope === "group" ? `Ghi cho các bạn trong ${gname(scope.me.groupId)}` : "Ghi cho các bạn trong lớp"}
      />
      <div className="alert info">Ghi trung thực, công bằng. Ghi nhận được GVCN duyệt rồi mới tính điểm. Em có thể xoá ghi nhận của mình khi chưa được duyệt.</div>
      <div className="card">
        <EmulationRecorder
          today={isoDay(toDay())}
          students={scope.targets.map((s) => ({ id: s.id, name: s.fullName, group: role.scope === "group" ? null : gname(s.groupId) }))}
          criteria={criteria.map((c) => ({ id: c.id, name: c.name, category: c.category, points: c.points }))}
          note="Chờ GVCN duyệt"
        />
      </div>
      <div className="card">
        <h2>Em đã ghi</h2>
        {mine.length === 0 ? <Empty icon="record">Chưa có.</Empty> : (
          <div className="list">
            {mine.map((r) => (
              <div key={r.id} className="list-item">
                <span className={`pts-pill ${r.points > 0 ? "plus" : "minus"}`}>{r.points > 0 ? `+${r.points}` : r.points}</span>
                <div className="li-body">
                  <div className="li-title">{r.student.fullName}</div>
                  <div className="li-meta">{r.label} · {fmtDate(r.date)}</div>
                </div>
                <span className={`badge ${STATUS[r.status][1]}`}>{STATUS[r.status][0]}</span>
                {r.status === "PENDING" && (
                  <form action={deleteEmulation}><input type="hidden" name="id" value={r.id} /><button className="ghost sm" title="Xoá">✕</button></form>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
