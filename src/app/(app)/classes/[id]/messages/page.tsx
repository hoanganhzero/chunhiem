import Link from "next/link";
import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate, isoDay, toDay, vnNameCompare } from "@/lib/utils";
import { ClassHeader } from "@/components/ClassHeader";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { deleteAnnouncement, postAnnouncement, sendPeriodicReports } from "@/actions/messages";

export default async function MessagesPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  const [announcements, students] = await Promise.all([
    db.announcement.findMany({ where: { classId: cls.id }, orderBy: { createdAt: "desc" }, take: 20, include: { author: { select: { name: true } } } }),
    db.student.findMany({
      where: { classId: cls.id, status: "ACTIVE" },
      include: {
        messages: { orderBy: { createdAt: "desc" }, take: 1 },
        _count: { select: { messages: { where: { fromFamily: true, read: false } } } },
      },
    }),
  ]);
  // Báo cáo định kỳ gần nhất của từng em — phụ huynh đã xác nhận chưa
  const reports = await db.message.findMany({
    where: { kind: "REPORT", student: { classId: cls.id } }, orderBy: { createdAt: "desc" }, select: { studentId: true, ackAt: true, createdAt: true },
  });
  const latestReport = new Map<string, (typeof reports)[number]>();
  for (const r of reports) if (!latestReport.has(r.studentId)) latestReport.set(r.studentId, r);
  const acked = [...latestReport.values()].filter((r) => r.ackAt).length;
  students.sort((a, b) =>
    b._count.messages - a._count.messages ||
    (b.messages[0]?.createdAt.getTime() ?? 0) - (a.messages[0]?.createdAt.getTime() ?? 0) ||
    vnNameCompare(a.fullName, b.fullName));
  const today = toDay();
  const weekAgo = new Date(today.getTime() - 6 * 86400000);

  return (
    <>
      <ClassHeader cls={cls} active="messages" />
      <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <div className="card">
          <h2>📢 Thông báo cho cả lớp</h2>
          <ActionForm action={postAnnouncement} resetOnSuccess>
            <input type="hidden" name="classId" value={cls.id} />
            <div className="field" style={{ marginBottom: 8 }}><input name="title" placeholder="Tiêu đề, vd: Họp phụ huynh cuối kỳ I" required /></div>
            <div className="field" style={{ marginBottom: 8 }}><textarea name="content" rows={4} placeholder="Nội dung thông báo…" required /></div>
            <SubmitButton>Gửi thông báo</SubmitButton>
          </ActionForm>
        </div>
        <div className="card">
          <h2>📝 Gửi báo cáo định kỳ cho từng phụ huynh</h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            Hệ thống tự tổng hợp chuyên cần, khen thưởng, vi phạm của từng em trong khoảng ngày và gửi vào sổ liên lạc riêng của phụ huynh.
          </p>
          <ActionForm action={sendPeriodicReports} confirm="Gửi báo cáo cho phụ huynh cả lớp?">
            <input type="hidden" name="classId" value={cls.id} />
            <div className="form-grid">
              <div className="field"><label>Từ ngày</label><input type="date" name="from" defaultValue={isoDay(weekAgo)} required /></div>
              <div className="field"><label>Đến ngày</label><input type="date" name="to" defaultValue={isoDay(today)} required /></div>
            </div>
            <div className="field" style={{ marginBottom: 8 }}><textarea name="extra" rows={2} placeholder="Lời nhắn thêm cho tất cả phụ huynh (không bắt buộc)" /></div>
            <SubmitButton>Gửi báo cáo</SubmitButton>
          </ActionForm>
        </div>
      </div>

      <div className="card">
        <div className="card-head">
          <h2>💬 Trao đổi với phụ huynh</h2>
          {latestReport.size > 0 && (
            <span className={`badge ${acked === latestReport.size ? "ok" : "warn"}`}>
              Báo cáo gần nhất: {acked}/{latestReport.size} phụ huynh đã xác nhận
            </span>
          )}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Học sinh</th><th>Phụ huynh</th><th>Báo cáo tuần</th><th>Tin gần nhất</th><th></th></tr></thead>
            <tbody>
              {students.map((s) => {
                const last = s.messages[0];
                return (
                  <tr key={s.id}>
                    <td><strong>{s.fullName}</strong></td>
                    <td className="small">{s.parentName}<div className="muted">{s.parentPhone && <a href={`tel:${s.parentPhone}`}>{s.parentPhone}</a>}</div></td>
                    <td>
                      {(() => {
                        const r = latestReport.get(s.id);
                        if (!r) return <span className="muted small">—</span>;
                        return r.ackAt ? <span className="badge ok">✓ Đã xem</span> : <span className="badge warn">Chưa xem</span>;
                      })()}
                    </td>
                    <td className="small">
                      {last ? <>{last.fromFamily ? "PH: " : "Bạn: "}{last.content.slice(0, 70)}{last.content.length > 70 ? "…" : ""} <span className="muted">· {fmtDate(last.createdAt)}</span></> : <span className="muted">—</span>}
                    </td>
                    <td>
                      <Link href={`/classes/${cls.id}/messages/${s.id}`}>Mở</Link>
                      {s._count.messages > 0 && <span className="badge danger" style={{ marginLeft: 6 }}>{s._count.messages} mới</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <h2>Thông báo đã gửi</h2>
        {announcements.length === 0 && <p className="muted">Chưa có thông báo.</p>}
        {announcements.map((a) => (
          <div key={a.id} style={{ borderBottom: "1px solid var(--border)", padding: "10px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
              <strong>{a.title}</strong>
              <form action={deleteAnnouncement}><input type="hidden" name="id" value={a.id} /><button className="danger" title="Xoá">✕</button></form>
            </div>
            <div style={{ whiteSpace: "pre-wrap" }}>{a.content}</div>
            <div className="small muted">{a.author?.name} · {a.createdAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</div>
          </div>
        ))}
      </div>
    </>
  );
}
