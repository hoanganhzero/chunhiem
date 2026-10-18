import { notFound } from "next/navigation";
import { requireStudentAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { teacherSendMessage } from "@/actions/messages";
import { PageHeader } from "@/components/ui";

export default async function ThreadPage({ params }: { params: Promise<{ id: string; studentId: string }> }) {
  const { id, studentId } = await params;
  const { cls, student } = await requireStudentAccess(studentId);
  if (cls.id !== id) notFound();
  await db.message.updateMany({ where: { studentId, fromFamily: true, read: false }, data: { read: true } });
  const messages = await db.message.findMany({
    where: { studentId }, orderBy: { createdAt: "asc" }, include: { sender: { select: { name: true } } },
  });
  return (
    <>
      <PageHeader
        back={{ href: `/classes/${cls.id}/messages`, label: `Liên lạc lớp ${cls.name}` }}
        title={student.fullName}
        sub={<>Phụ huynh: {student.parentName ?? "—"} {student.parentPhone && <>· <a href={`tel:${student.parentPhone}`}>{student.parentPhone}</a></>}</>}
        actions={student.parentPhone ? <a className="btn secondary" href={`tel:${student.parentPhone}`}>Gọi phụ huynh</a> : undefined}
      />
      <div className="card">
        <div className="thread">
          {messages.length === 0 && <p className="muted">Chưa có trao đổi.</p>}
          {messages.map((m) => (
            <div key={m.id} className={`bubble ${m.fromFamily ? "them" : "me"}`}>
              {m.content}
              <div className="meta">{m.sender?.name} · {m.createdAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}{!m.fromFamily && (m.read ? " · Đã xem" : "")}</div>
            </div>
          ))}
        </div>
        {student.parentUserId ? (
          <ActionForm action={teacherSendMessage} resetOnSuccess>
            <input type="hidden" name="studentId" value={student.id} />
            <div className="composer">
              <textarea name="content" rows={2} placeholder="Nhắn cho phụ huynh…" required aria-label="Nội dung tin nhắn" />
              <SubmitButton>Gửi</SubmitButton>
            </div>
          </ActionForm>
        ) : (
          <p className="alert warn">Học sinh chưa có tài khoản phụ huynh. Vào tab “Tài khoản” để tạo.</p>
        )}
      </div>
    </>
  );
}
