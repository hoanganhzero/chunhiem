import Link from "next/link";
import { requireStudentAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { StudentFields } from "@/components/StudentFields";
import { StudentRecord } from "@/components/StudentRecord";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { resetFamilyPassword, updateStudent } from "@/actions/classroom";
import { saveGoal, setGoalStatus } from "@/actions/emulation";
import { buildProgress } from "@/lib/progress";
import { ProgressView } from "@/components/Emulation";
import { fmtDate } from "@/lib/utils";

export default async function StudentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cls, student } = await requireStudentAccess(id);
  const [goals, progress] = await Promise.all([
    db.goal.findMany({ where: { studentId: id }, orderBy: { createdAt: "desc" } }),
    buildProgress(id),
  ]);
  const accounts = await db.student.findUniqueOrThrow({
    where: { id },
    select: { user: { select: { username: true, mustChangePassword: true } }, parentUser: { select: { username: true, mustChangePassword: true } } },
  });

  return (
    <>
      <div className="page-head">
        <div>
          <div className="small"><Link href={`/classes/${cls.id}`}>← Lớp {cls.name}</Link></div>
          <h1>{student.fullName}</h1>
          <div className="muted">Mã HS: {student.code}</div>
        </div>
        <Link className="btn secondary" href={`/classes/${cls.id}/messages/${student.id}`}>💬 Liên lạc phụ huynh</Link>
      </div>

      <div className="card">
        <h2>Thông tin học sinh</h2>
        <ActionForm action={updateStudent}>
          <input type="hidden" name="id" value={student.id} />
          <StudentFields s={student} withStatus />
          <SubmitButton>Lưu thay đổi</SubmitButton>
        </ActionForm>
      </div>

      <div className="card">
        <h2>Tài khoản</h2>
        <table>
          <tbody>
            {([["student", "Học sinh", accounts.user], ["parent", "Phụ huynh", accounts.parentUser]] as const).map(([which, label, u]) => (
              <tr key={which}>
                <td>{label}</td>
                <td>{u ? <code>{u.username}</code> : <span className="muted">Chưa có — vào tab Tài khoản của lớp để tạo</span>}</td>
                <td>{u && (u.mustChangePassword ? <span className="badge warn">Chưa đổi MK</span> : <span className="badge ok">Đã kích hoạt</span>)}</td>
                <td>
                  {u && (
                    <ActionForm action={resetFamilyPassword} confirm="Đặt lại mật khẩu về mặc định?">
                      <input type="hidden" name="studentId" value={student.id} />
                      <input type="hidden" name="which" value={which} />
                      <SubmitButton className="secondary">Đặt lại mật khẩu</SubmitButton>
                    </ActionForm>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="card">
        <h2>🎯 Đặt mục tiêu rèn luyện / học tập</h2>
        <p className="small muted" style={{ marginTop: 0 }}>Mục tiêu cụ thể, đo được (vd: “Không đi muộn trong tháng 11”, “Toán HK II đạt từ 6,5”). Phụ huynh và học sinh thấy trong mục Thi đua & tiến bộ.</p>
        <ActionForm action={saveGoal} className="inline" resetOnSuccess>
          <input type="hidden" name="studentId" value={student.id} />
          <div className="field" style={{ flex: "1 1 260px" }}><label>Mục tiêu</label><input name="title" required /></div>
          <div className="field"><label>Hạn</label><input type="date" name="dueDate" /></div>
          <SubmitButton>Đặt mục tiêu</SubmitButton>
        </ActionForm>
        {goals.length > 0 && (
          <div className="list" style={{ marginTop: 14 }}>
            {goals.map((g) => (
              <div key={g.id} className="list-item" style={{ alignItems: "center", flexWrap: "wrap" }}>
                <div className="li-body">
                  <div className="li-title">{g.title}</div>
                  <div className="li-meta">{g.dueDate ? `Hạn ${fmtDate(g.dueDate)}` : "Không đặt hạn"}</div>
                </div>
                <form action={setGoalStatus} style={{ display: "flex", gap: 6 }}>
                  <input type="hidden" name="id" value={g.id} />
                  {[["ACTIVE", "Đang làm"], ["DONE", "Đã đạt"], ["MISSED", "Chưa đạt"]].map(([v, l]) => (
                    <button key={v} name="status" value={v} className={`sm ${g.status === v ? "" : "secondary"}`}>{l}</button>
                  ))}
                  <button name="status" value="delete" className="ghost sm" title="Xoá">✕</button>
                </form>
              </div>
            ))}
          </div>
        )}
      </div>

      <h2 style={{ margin: "8px 0 12px" }}>Tiến bộ — phụ huynh đang thấy nội dung này</h2>
      <ProgressView p={progress} learner="em" />

      <StudentRecord studentId={student.id} academicYearId={cls.academicYearId} schoolId={cls.schoolId} />
    </>
  );
}
