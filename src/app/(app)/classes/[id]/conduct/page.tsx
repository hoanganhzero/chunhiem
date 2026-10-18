import Link from "next/link";
import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { CONDUCT_TYPES } from "@/lib/constants";
import { fmtDate, isoDay, toDay } from "@/lib/utils";
import { ClassHeader } from "@/components/ClassHeader";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { addConductRecord, deleteConductRecord } from "@/actions/classroom";

export default async function ConductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  const [students, records] = await Promise.all([
    db.student.findMany({ where: { classId: cls.id, status: "ACTIVE" }, orderBy: { fullName: "asc" } }),
    db.conductRecord.findMany({
      where: { student: { classId: cls.id } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 200,
      include: { student: { select: { id: true, fullName: true } }, createdBy: { select: { name: true } } },
    }),
  ]);

  return (
    <>
      <ClassHeader cls={cls} active="conduct" />
      <div className="card">
        <h2>Ghi nhận nề nếp</h2>
        <ActionForm action={addConductRecord} className="inline" resetOnSuccess>
          <div className="field">
            <label>Học sinh</label>
            <select name="studentId" required defaultValue="">
              <option value="" disabled>— Chọn học sinh —</option>
              {students.map((s) => <option key={s.id} value={s.id}>{s.fullName}</option>)}
            </select>
          </div>
          <div className="field">
            <label>Loại</label>
            <select name="type" defaultValue="VIOLATION">
              {Object.entries(CONDUCT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div className="field"><label>Ngày</label><input type="date" name="date" defaultValue={isoDay(toDay())} /></div>
          <div className="field" style={{ flex: 1, minWidth: 220 }}><label>Nội dung</label><input name="content" required placeholder="vd: Không mặc đồng phục" /></div>
          <div className="field"><label>Điểm</label><input type="number" name="points" min={0} defaultValue={0} style={{ width: 80 }} /></div>
          <SubmitButton>Ghi nhận</SubmitButton>
        </ActionForm>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Ngày</th><th>Học sinh</th><th>Loại</th><th>Nội dung</th><th>Điểm</th><th>Người ghi</th><th></th></tr></thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id}>
                <td>{fmtDate(r.date)}</td>
                <td><Link href={`/students/${r.student.id}`}>{r.student.fullName}</Link></td>
                <td>{r.type === "PRAISE" ? <span className="badge ok">Khen thưởng</span> : <span className="badge danger">Vi phạm</span>}</td>
                <td>{r.content}</td>
                <td>{r.points > 0 ? `+${r.points}` : r.points || ""}</td>
                <td className="small muted">{r.createdBy?.name}</td>
                <td>
                  <form action={deleteConductRecord}>
                    <input type="hidden" name="id" value={r.id} />
                    <button className="danger" title="Xoá">✕</button>
                  </form>
                </td>
              </tr>
            ))}
            {records.length === 0 && <tr><td colSpan={7} className="muted">Chưa có ghi nhận nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </>
  );
}
