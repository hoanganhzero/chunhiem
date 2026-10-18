import { requireSchoolAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { SCHOOL_VIEW_ROLES, terms } from "@/lib/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { Empty, PageHeader } from "@/components/ui";
import { Icon } from "@/components/Icon";
import { deleteSchoolAnnouncement, postSchoolAnnouncement } from "@/actions/school";

// Gửi thông báo toàn trường có thể lâu hơn giới hạn mặc định của máy chủ serverless
export const maxDuration = 60;

export const metadata = { title: "Thông báo" };

export default async function SchoolAnnouncementsPage() {
  const { user, schoolId } = await requireSchoolAdmin(SCHOOL_VIEW_ROLES);
  const t = terms(user.schoolType);
  const list = await db.announcement.findMany({
    where: { schoolId, classId: null }, orderBy: { createdAt: "desc" }, take: 50, include: { author: { select: { name: true } } },
  });
  return (
    <>
      <PageHeader title={`Thông báo toàn ${t.unitLower}`} sub={`Gửi đến tất cả giáo viên, ${t.learnerLower} và phụ huynh`} />
      <div className="card">
        <h2>Soạn thông báo</h2>
        <ActionForm action={postSchoolAnnouncement} resetOnSuccess confirm="Gửi thông báo đến toàn bộ giáo viên, học sinh và phụ huynh?">
          <div className="field" style={{ marginBottom: 10 }}><label>Tiêu đề</label><input name="title" required placeholder="vd: Lịch nghỉ Tết Nguyên đán" /></div>
          <div className="field" style={{ marginBottom: 12 }}><label>Nội dung</label><textarea name="content" rows={5} required /></div>
          <SubmitButton><Icon name="announce" size={18} /> Gửi thông báo</SubmitButton>
        </ActionForm>
      </div>
      <div className="card">
        <h2>Đã gửi</h2>
        {list.length === 0 ? <Empty icon="announce">Chưa có thông báo.</Empty> : (
          <div className="list">
            {list.map((a) => (
              <div className="list-item" key={a.id}>
                <div className="li-icon"><Icon name="announce" size={18} /></div>
                <div className="li-body">
                  <div className="li-title">{a.title}</div>
                  <div className="li-text">{a.content}</div>
                  <div className="li-meta">{a.author?.name} · {a.createdAt.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })}</div>
                </div>
                <form action={deleteSchoolAnnouncement}>
                  <input type="hidden" name="id" value={a.id} />
                  <button className="ghost sm" title="Xoá">Xoá</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
