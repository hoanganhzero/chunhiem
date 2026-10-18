import Link from "next/link";
import { requireFamilyAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { familySendMessage } from "@/actions/messages";

export default async function PortalMessagesPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { user, student } = await requireFamilyAccess(studentId);
  const isParent = user.role === "PARENT";
  if (isParent) await db.message.updateMany({ where: { studentId, fromFamily: false, read: false }, data: { read: true } });
  const [announcements, messages] = await Promise.all([
    db.announcement.findMany({ where: { classId: student.classId }, orderBy: { createdAt: "desc" }, take: 30, include: { author: { select: { name: true } } } }),
    isParent ? db.message.findMany({ where: { studentId }, orderBy: { createdAt: "asc" }, include: { sender: { select: { name: true } } } }) : [],
  ]);
  const ts = (d: Date) => d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="small"><Link href={`/portal/${student.id}`}>← {student.fullName}</Link></div>
          <h1>{isParent ? "Sổ liên lạc" : "Thông báo lớp"}</h1>
          <div className="muted">Lớp {student.class.name} · GVCN: {student.class.homeroomTeacher?.name ?? "—"}</div>
        </div>
      </div>
      {isParent && (
        <div className="card">
          <h2>💬 Trao đổi với giáo viên chủ nhiệm</h2>
          <div className="thread">
            {messages.length === 0 && <p className="muted">Chưa có tin nhắn.</p>}
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.fromFamily ? "me" : "them"}`}>
                {m.content}
                <div className="meta">{m.sender?.name} · {ts(m.createdAt)}{m.fromFamily && m.read ? " · GV đã xem" : ""}</div>
              </div>
            ))}
          </div>
          <ActionForm action={familySendMessage} resetOnSuccess>
            <input type="hidden" name="studentId" value={student.id} />
            <div className="field" style={{ marginBottom: 8 }}><textarea name="content" rows={3} placeholder="Nhắn cho giáo viên chủ nhiệm, vd: xin phép cho con nghỉ học…" required /></div>
            <SubmitButton>Gửi</SubmitButton>
          </ActionForm>
        </div>
      )}
      <div className="card">
        <h2>📢 Thông báo của lớp</h2>
        {announcements.length === 0 && <p className="muted">Chưa có thông báo.</p>}
        {announcements.map((a) => (
          <div key={a.id} style={{ borderBottom: "1px solid var(--border)", padding: "10px 0" }}>
            <strong>{a.title}</strong>
            <div style={{ whiteSpace: "pre-wrap" }}>{a.content}</div>
            <div className="small muted">{a.author?.name} · {ts(a.createdAt)}</div>
          </div>
        ))}
      </div>
    </>
  );
}
