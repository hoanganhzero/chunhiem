import { requireSchoolAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ROLES, type Role } from "@/lib/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { createTeacher, importTeachers, resetPasswordToDefault, toggleTeacher } from "@/actions/school";

export default async function TeachersPage() {
  const { user, schoolId } = await requireSchoolAdmin();
  const [school, teachers] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: schoolId } }),
    db.user.findMany({
      where: { schoolId, role: { in: ["SCHOOL_ADMIN", "TEACHER"] } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { homeroomClasses: { where: { academicYear: { isCurrent: true } }, select: { name: true } } },
    }),
  ]);
  return (
    <>
      <div className="page-head">
        <div><h1>Giáo viên & tài khoản</h1>
          <div className="muted">Tài khoản mới dùng mật khẩu mặc định <code>{school.defaultPassword}</code>, bắt buộc đổi khi đăng nhập lần đầu</div></div>
      </div>
      <div className="card">
        <h2>Nhập hàng loạt từ Excel</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Tải <a href="/templates/giao-vien">tệp mẫu giáo viên (.xlsx)</a>, điền danh sách (có thể kèm lớp chủ nhiệm), rồi tải lên. Lớp chưa có sẽ được tạo tự động trong năm học hiện tại.
        </p>
        <ActionForm action={importTeachers} className="inline">
          <input type="file" name="file" accept=".xlsx,.csv" required />
          <SubmitButton>Nhập giáo viên</SubmitButton>
        </ActionForm>
      </div>
      <div className="card">
        <h2>Thêm một tài khoản</h2>
        <ActionForm action={createTeacher} resetOnSuccess>
          <div className="form-grid">
            <div className="field"><label>Họ tên</label><input name="name" required /></div>
            <div className="field"><label>Email (tên đăng nhập)</label><input name="username" type="email" required /></div>
            <div className="field"><label>Số điện thoại</label><input name="phone" /></div>
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
          <thead><tr><th>Họ tên</th><th>Tên đăng nhập / SĐT</th><th>Vai trò</th><th>Chủ nhiệm</th><th>Trạng thái</th><th></th><th></th></tr></thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id}>
                <td><strong>{t.name}</strong></td>
                <td>{t.username}<div className="small muted">{t.phone}</div></td>
                <td>{ROLES[t.role as Role]}</td>
                <td>{t.homeroomClasses.map((c) => c.name).join(", ") || <span className="muted">—</span>}</td>
                <td>
                  {!t.active ? <span className="badge danger">Đã khoá</span>
                    : t.mustChangePassword ? <span className="badge warn">Chưa đổi MK</span>
                    : <span className="badge ok">Hoạt động</span>}
                </td>
                <td>
                  {t.id !== user.id && (
                    <ActionForm action={resetPasswordToDefault} confirm={`Đặt lại mật khẩu của ${t.name} về mặc định?`}>
                      <input type="hidden" name="id" value={t.id} />
                      <SubmitButton className="secondary">Đặt lại MK</SubmitButton>
                    </ActionForm>
                  )}
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
