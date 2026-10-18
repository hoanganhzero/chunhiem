import { requireSchoolAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { roleLabel, terms } from "@/lib/constants";
import { PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { createTeacher, importTeachers, resetPasswordToDefault, toggleTeacher } from "@/actions/school";

export default async function TeachersPage() {
  const { user, schoolId } = await requireSchoolAdmin();
  const [school, teachers] = await Promise.all([
    db.school.findUniqueOrThrow({ where: { id: schoolId } }),
    db.user.findMany({
      where: { schoolId, role: { in: ["SCHOOL_ADMIN", "LEADER", "ACADEMIC", "TEACHER"] } },
      orderBy: [{ role: "asc" }, { name: "asc" }],
      include: { homeroomClasses: { where: { academicYear: { isCurrent: true } }, select: { name: true } } },
    }),
  ]);
  const tt = terms(school.type);
  const isAdmin = user.role === "SCHOOL_ADMIN";
  const roles = isAdmin ? (["TEACHER", "ACADEMIC", "LEADER", "SCHOOL_ADMIN"] as const) : (["TEACHER"] as const);
  const canManage = (role: string) => isAdmin || role === "TEACHER";
  return (
    <>
      <PageHeader
        title="Cán bộ, giáo viên"
        sub={<>Tài khoản mới dùng mật khẩu mặc định <code>{school.defaultPassword}</code>, bắt buộc đổi khi đăng nhập lần đầu</>}
      />
      <div className="card">
        <h2>Nhập hàng loạt từ Excel</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          Tải <a href="/templates/giao-vien">tệp mẫu (.xlsx)</a>, điền danh sách (có thể kèm lớp chủ nhiệm), rồi tải lên. Lớp chưa có sẽ được tạo tự động trong năm học hiện tại.
          {isAdmin && <> Cột “Vai trò”: Giáo viên, Giáo vụ, {tt.leadership}, Quản trị.</>}
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
                {roles.map((r) => <option key={r} value={r}>{roleLabel(r, school.type)}</option>)}
              </select>
            </div>
          </div>
          <SubmitButton>Thêm</SubmitButton>
        </ActionForm>
      </div>
      <div className="card flush">
        <div className="table-wrap">
        <table className="responsive">
          <thead><tr><th>Họ tên</th><th>Tên đăng nhập / SĐT</th><th>Vai trò</th><th>Chủ nhiệm</th><th>Trạng thái</th><th></th><th></th></tr></thead>
          <tbody>
            {teachers.map((t) => (
              <tr key={t.id}>
                <td className="primary"><strong>{t.name}</strong></td>
                <td data-label="Đăng nhập">{t.username}<div className="small muted">{t.phone}</div></td>
                <td data-label="Vai trò">{roleLabel(t.role, school.type)}</td>
                <td data-label="Chủ nhiệm">{t.homeroomClasses.map((c) => c.name).join(", ") || <span className="muted">—</span>}</td>
                <td data-label="Trạng thái">
                  {!t.active ? <span className="badge danger">Đã khoá</span>
                    : t.mustChangePassword ? <span className="badge warn">Chưa đổi MK</span>
                    : <span className="badge ok">Hoạt động</span>}
                </td>
                <td data-label="">
                  {t.id !== user.id && canManage(t.role) && (
                    <ActionForm action={resetPasswordToDefault} confirm={`Đặt lại mật khẩu của ${t.name} về mặc định?`}>
                      <input type="hidden" name="id" value={t.id} />
                      <SubmitButton className="secondary sm">Đặt lại MK</SubmitButton>
                    </ActionForm>
                  )}
                </td>
                <td data-label="">
                  {t.id !== user.id && canManage(t.role) && (
                    <form action={toggleTeacher}>
                      <input type="hidden" name="id" value={t.id} />
                      <button className={`sm ${t.active ? "danger" : "secondary"}`}>{t.active ? "Khoá" : "Mở"}</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </>
  );
}
