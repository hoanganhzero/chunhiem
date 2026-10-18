import { requireSchoolAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES, type Role } from "@/lib/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { createTeacher, resetTeacherPassword, toggleTeacher } from "@/actions/school";

export default async function TeachersPage() {
  const { user, schoolId } = await requireSchoolAdmin();
  const teachers = await db.user.findMany({
    where: { schoolId },
    orderBy: [{ role: "asc" }, { name: "asc" }],
    include: { homeroomClasses: { where: { academicYear: { isCurrent: true } }, select: { name: true } } },
  });
  return (
    <>
      <div className="page-head"><h1>Giáo viên & tài khoản</h1></div>
      <div className="card">
        <h2>Thêm tài khoản</h2>
        <ActionForm action={createTeacher} resetOnSuccess>
          <div className="form-grid">
            <div className="field"><label>Họ tên</label><input name="name" required /></div>
            <div className="field"><label>Email</label><input name="email" type="email" required /></div>
            <div className="field"><label>Số điện thoại</label><input name="phone" /></div>
            <div className="field"><label>Mật khẩu ban đầu</label><input name="password" type="password" minLength={8} required /></div>
            <div className="field">
              <label>Vai trò</label>
              <select name="role" defaultValue="TEACHER">
                <option value="TEACHER">{ROLES.TEACHER}</option>
                <option value="SCHOOL_ADMIN">{ROLES.SCHOOL_ADMIN}</option>
              </select>
            </div>
          </div>
          <SubmitButton>Thêm</SubmitButton>
        </ActionForm>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Họ tên</th><th>Email / SĐT</th><th>Vai trò</th><th>Chủ nhiệm</th><th>Trạng thái</th><th>Đặt lại mật khẩu</th><th></th></tr></thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td>
                <td>{t.email}<div className="small muted">{t.phone}</div></td>
                <td>{ROLES[t.role as Role]}</td>
                <td>{t.homeroomClasses.map((c) => c.name).join(", ") || <span className="muted">—</span>}</td>
                <td>{t.active ? <span className="badge ok">Hoạt động</span> : <span className="badge danger">Đã khoá</span>}</td>
                <td>
                  <ActionForm action={resetTeacherPassword} className="inline">
                    <input type="hidden" name="id" value={t.id} />
                    <input name="password" type="password" placeholder="Mật khẩu mới" minLength={8} required style={{ width: 140 }} />
                    <SubmitButton className="secondary">Đặt</SubmitButton>
                  </ActionForm>
                </td>
                <td>
                  {t.id !== user.id && (
                    <form action={toggleTeacher}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className={t.active ? "danger" : "secondary"}>{t.active ? "Khoá" : "Mở"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
