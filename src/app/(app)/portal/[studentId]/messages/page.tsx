import { Send } from "lucide-react";
import { requireFamilyAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { terms } from "@/lib/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Empty, PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { ackReport, familySendMessage } from "@/actions/messages";

export const metadata = { title: "Liên lạc" };

export default async function PortalMessagesPage({ params }: { params: Promise<{ studentId: string }> }) {
  const { studentId } = await params;
  const { user, student } = await requireFamilyAccess(studentId);
  const isParent = user.role === "PARENT";
  if (isParent) await db.message.updateMany({ where: { studentId, fromFamily: false, read: false }, data: { read: true } });
  const school = await db.school.findUniqueOrThrow({ where: { id: student.schoolId }, select: { type: true } });
  const t = terms(school.type);
  const [announcements, messages] = await Promise.all([
    db.announcement.findMany({
      where: { schoolId: student.schoolId, OR: [{ classId: student.classId }, { classId: null }] },
      orderBy: { createdAt: "desc" }, take: 30, include: { author: { select: { name: true } } },
    }),
    isParent ? db.message.findMany({ where: { studentId }, orderBy: { createdAt: "asc" }, include: { sender: { select: { name: true } } } }) : [],
  ]);
  const ts = (d: Date) => d.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" });

  return (
    <>
      <PageHeader
        back={{ href: `/portal/${student.id}`, label: student.fullName }}
        title={isParent ? "Sổ liên lạc" : "Thông báo"}
        sub={`Lớp ${student.class.name} · GVCN: ${student.class.homeroomTeacher?.name ?? "—"}`}
      />
      {isParent && (
        <div className="card">
          <h2>Trao đổi với giáo viên chủ nhiệm</h2>
          <div className="thread">
            {messages.length === 0 && <Empty icon="messages">Chưa có tin nhắn. Phụ huynh có thể xin phép cho con nghỉ, hỏi tình hình học tập… tại đây.</Empty>}
            {messages.map((m) => (
              <div key={m.id} className={`bubble ${m.fromFamily ? "me" : "them"}`}>
                {m.kind === "REPORT" && <div className="badge" style={{ marginBottom: 6 }}>📝 Báo cáo định kỳ</div>}
                <div>{m.content}</div>
                <div className="meta">{m.fromFamily ? "Bạn" : m.sender?.name} · {ts(m.createdAt)}{m.fromFamily && m.read ? " · Đã xem" : ""}</div>
                {m.kind === "REPORT" && (
                  <div className="ack-box">
                    {m.ackAt ? (
                      <span className="small"><strong>✓ Đã xác nhận đã xem</strong> · {ts(m.ackAt)}</span>
                    ) : (
                      <ActionForm action={ackReport}>
                        <input type="hidden" name="id" value={m.id} />
                        <textarea name="feedback" rows={2} placeholder="Phản hồi cho GVCN (không bắt buộc), vd: Gia đình sẽ nhắc con ôn bài Toán mỗi tối." style={{ marginBottom: 8, minHeight: 60 }} />
                        <SubmitButton className="sm">✓ Đã xem báo cáo</SubmitButton>
                      </ActionForm>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
          <ActionForm action={familySendMessage} resetOnSuccess>
            <input type="hidden" name="studentId" value={student.id} />
            <div className="composer">
              <textarea name="content" rows={2} placeholder="Nhắn cho giáo viên chủ nhiệm…" required aria-label="Nội dung tin nhắn" />
              <SubmitButton><Send size={18} /><span className="sr-only">Gửi</span></SubmitButton>
            </div>
          </ActionForm>
        </div>
      )}
      <div className="card">
        <h2>Thông báo của lớp và {t.unitLower}</h2>
        {announcements.length === 0 ? <Empty icon="announce">Chưa có thông báo.</Empty> : (
          <div className="list">
            {announcements.map((a) => (
              <div className="list-item" key={a.id}>
                <div className="li-icon"><Icon name={a.classId ? "students" : "announce"} size={18} /></div>
                <div className="li-body">
                  <div className="li-title">{a.title} {!a.classId && <span className="badge gray">{t.unit}</span>}</div>
                  <div className="li-text">{a.content}</div>
                  <div className="li-meta">{a.author?.name ?? t.leadership} · {ts(a.createdAt)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
