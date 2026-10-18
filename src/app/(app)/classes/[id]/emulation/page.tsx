import Link from "next/link";
import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { CLASS_ROLES, EMU_CATEGORIES } from "@/lib/constants";
import { ensureCriteria, leaderboard, weekFromParam, weekLabel, weekRange } from "@/lib/emulation";
import { fmtDate, isoDay, toDay, vnNameCompare } from "@/lib/utils";
import { ClassHeader } from "@/components/ClassHeader";
import { ActionForm } from "@/components/ActionForm";
import { EmulationRecorder } from "@/components/EmulationRecorder";
import { Highlights, TeamBoard, WeekNav } from "@/components/Emulation";
import { Empty } from "@/components/ui";
import { deleteEmulation, reviewRecords } from "@/actions/emulation";

export const metadata = { title: "Thi đua" };
const sign = (n: number) => (n > 0 ? `+${n}` : `${n}`);

export default async function EmulationPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ tuan?: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  await ensureCriteria(cls.id);
  const start = weekFromParam((await searchParams).tuan);
  const [board, criteria, students, pending, recent, groups] = await Promise.all([
    leaderboard(cls.id, start),
    db.emulationCriterion.findMany({ where: { classId: cls.id, active: true, auto: null }, orderBy: { order: "asc" } }),
    db.student.findMany({ where: { classId: cls.id, status: "ACTIVE" }, include: { group: true } }),
    db.emulationRecord.findMany({
      where: { classId: cls.id, status: "PENDING" }, orderBy: { createdAt: "asc" },
      include: { student: { select: { fullName: true } }, recordedBy: { select: { name: true, studentProfile: { select: { classRole: true } } } } },
    }),
    db.emulationRecord.findMany({
      where: { classId: cls.id, status: "APPROVED", date: weekRange(start) }, orderBy: [{ date: "desc" }, { createdAt: "desc" }], take: 40,
      include: { student: { select: { fullName: true } }, recordedBy: { select: { name: true } } },
    }),
    db.classGroup.count({ where: { classId: cls.id } }),
  ]);
  students.sort((a, b) => vnNameCompare(a.fullName, b.fullName));
  const recorders = students.filter((s) => s.classRole);
  const base = `/classes/${cls.id}/emulation`;

  return (
    <>
      <ClassHeader cls={cls} active="emulation" actions={<Link className="btn secondary" href={`${base}/setup`}>Tổ, cán sự & tiêu chí</Link>} />

      {(groups === 0 || recorders.length === 0) && (
        <div className="alert info">
          Bước đầu: <Link href={`${base}/setup`}><strong>chia tổ, cử tổ trưởng / bí thư / lớp trưởng</strong></Link> để các em tự ghi thi đua
          trên điện thoại (GVCN duyệt trước khi tính điểm). Tiêu chí cộng / trừ điểm đã có sẵn và chỉnh sửa được.
        </div>
      )}

      {(pending.length > 0 || recorders.length > 0) && (
        <div className="card" style={pending.length ? { borderColor: "var(--warn)" } : undefined}>
          <div className="card-head"><h2>{pending.length ? `⏳ Chờ duyệt (${pending.length})` : "Ghi nhận của cán sự lớp"}</h2><span className="small muted">Do cán sự lớp ghi nhận</span></div>
          <ActionForm action={reviewRecords}>
            <input type="hidden" name="classId" value={cls.id} />
            <div className="list">
              {pending.map((r) => (
                <label key={r.id} className="list-item" style={{ cursor: "pointer" }}>
                  <input type="checkbox" name="rid" value={r.id} defaultChecked style={{ marginTop: 8 }} />
                  <span className={`pts-pill ${r.points > 0 ? "plus" : "minus"}`}>{sign(r.points)}</span>
                  <div className="li-body">
                    <div className="li-title">{r.student.fullName} — {r.label}</div>
                    <div className="li-meta">
                      {fmtDate(r.date)} · ghi bởi {r.recordedBy?.name}
                      {r.recordedBy?.studentProfile?.classRole ? ` (${CLASS_ROLES[r.recordedBy.studentProfile.classRole as keyof typeof CLASS_ROLES]?.label ?? ""})` : ""}
                      {r.note ? ` · ${r.note}` : ""}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            {pending.length === 0 && <p className="small muted" style={{ margin: 0 }}>Không có ghi nhận nào chờ duyệt.</p>}
            {pending.length > 0 && (
              <div className="sticky-actions">
                <button type="submit" name="decision" value="approve">Duyệt mục đã chọn</button>
                <button type="submit" name="decision" value="reject" className="danger">Từ chối</button>
              </div>
            )}
          </ActionForm>
        </div>
      )}

      <WeekNav start={start} base={base} label={weekLabel(start)} />

      <div className="grid two">
        <div className="card">
          <div className="card-head"><h2>🏆 Xếp hạng tổ</h2><span className="small muted">Theo điểm trung bình mỗi bạn</span></div>
          <TeamBoard board={board} />
        </div>
        <div className="card"><Highlights board={board} /></div>
      </div>

      <div className="card">
        <h2>Ghi nhận thi đua</h2>
        <EmulationRecorder
          classId={cls.id}
          today={isoDay(toDay())}
          students={students.map((s) => ({ id: s.id, name: s.fullName, group: s.group?.name ?? null }))}
          criteria={criteria.map((c) => ({ id: c.id, name: c.name, category: c.category, points: c.points }))}
          note="GVCN ghi: tính điểm ngay"
        />
      </div>

      <div className="grid two">
        <div className="card flush">
          <div className="card-head"><h2>Điểm từng học sinh — tuần {weekLabel(start)}</h2></div>
          <div className="table-wrap" style={{ marginTop: 10 }}>
            <table>
              <thead><tr><th>#</th><th>Họ tên</th><th>Tổ</th><th>Điểm</th><th>So tuần trước</th></tr></thead>
              <tbody>
                {board.people.map((p, i) => (
                  <tr key={p.id}>
                    <td>{i + 1}</td>
                    <td><Link href={`/students/${p.id}`}>{p.fullName}</Link></td>
                    <td className="small">{students.find((s) => s.id === p.id)?.group?.name ?? "—"}</td>
                    <td><strong className={p.points < 0 ? "low" : ""}>{sign(p.points)}</strong></td>
                    <td>{p.delta === 0 ? <span className="muted">–</span> : <span className={p.delta > 0 ? "up" : "low"}>{p.delta > 0 ? "↑" : "↓"} {Math.abs(p.delta)}</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <h2>Đã ghi trong tuần</h2>
          {recent.length === 0 ? <Empty icon="trophy">Chưa có ghi nhận.</Empty> : (
            <div className="list">
              {recent.map((r) => (
                <div key={r.id} className="list-item">
                  <span className={`pts-pill ${r.points > 0 ? "plus" : "minus"}`}>{sign(r.points)}</span>
                  <div className="li-body">
                    <div className="li-title">{r.student.fullName}</div>
                    <div className="li-meta">{r.label} · {EMU_CATEGORIES[r.category as keyof typeof EMU_CATEGORIES]} · {fmtDate(r.date)} · {r.source === "ATTENDANCE" ? "tự động từ điểm danh" : r.recordedBy?.name}</div>
                  </div>
                  <form action={deleteEmulation}><input type="hidden" name="id" value={r.id} /><button className="ghost sm" title="Xoá">✕</button></form>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
