import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/utils";
import { SCHOOL_TYPES } from "@/lib/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { createSchool, toggleSchool } from "@/actions/admin";

export default async function SchoolsPage() {
  await requireUser("SUPER_ADMIN");
  const schools = await db.school.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { users: true, students: true, classes: true } } },
  });
  return (
    <>
      <div className="page-head"><div><h1>Trường & trung tâm</h1><div className="muted">Mỗi trường là một đơn vị dữ liệu độc lập</div></div></div>
      <div className="card">
        <h2>Thêm đơn vị mới</h2>
        <ActionForm action={createSchool} resetOnSuccess>
          <div className="form-grid">
            <div className="field"><label>Mã đơn vị</label><input name="code" placeholder="THPT-NTMK" required /></div>
            <div className="field"><label>Tên đơn vị</label><input name="name" required /></div>
            <div className="field">
              <label>Loại đơn vị</label>
              <select name="type" defaultValue="THPT">{Object.entries(SCHOOL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            </div>
            <div className="field"><label>Địa chỉ</label><input name="address" /></div>
          </div>
          <p className="small muted" style={{ margin: "0 0 8px" }}>Tài khoản quản trị đầu tiên:</p>
          <div className="form-grid">
            <div className="field"><label>Họ tên</label><input name="adminName" required /></div>
            <div className="field"><label>Email</label><input name="adminEmail" type="email" required /></div>
            <div className="field"><label>Mật khẩu</label><input name="adminPassword" type="password" minLength={8} required /></div>
          </div>
          <SubmitButton>Tạo đơn vị</SubmitButton>
        </ActionForm>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Mã</th><th>Tên trường</th><th>Lớp</th><th>Học sinh</th><th>Tài khoản</th><th>Ngày tạo</th><th>Trạng thái</th><th></th></tr></thead>
          <tbody>
            {schools.map((s) => (
              <tr key={s.id}>
                <td><code>{s.code}</code></td>
                <td><strong>{s.name}</strong><div className="small muted">{SCHOOL_TYPES[s.type as keyof typeof SCHOOL_TYPES]}{s.address ? ` · ${s.address}` : ""}</div></td>
                <td>{s._count.classes}</td>
                <td>{s._count.students}</td>
                <td>{s._count.users}</td>
                <td>{fmtDate(s.createdAt)}</td>
                <td>{s.active ? <span className="badge ok">Hoạt động</span> : <span className="badge danger">Tạm khoá</span>}</td>
                <td>
                  <form action={toggleSchool}>
                    <input type="hidden" name="id" value={s.id} />
                    <button className={s.active ? "danger" : "secondary"}>{s.active ? "Khoá" : "Mở khoá"}</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
