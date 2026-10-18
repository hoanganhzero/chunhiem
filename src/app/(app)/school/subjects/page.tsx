import { requireSchoolAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { SUBJECT_TYPES } from "@/lib/constants";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { saveSubject } from "@/actions/school";

export default async function SubjectsPage() {
  const { schoolId } = await requireSchoolAdmin();
  const subjects = await db.subject.findMany({ where: { schoolId }, orderBy: [{ order: "asc" }, { name: "asc" }] });
  return (
    <>
      <div className="page-head"><div><h1>Môn học</h1>
        <div className="muted">Mã môn dùng trong mẫu báo cáo, vd <code>{"{{diem_TOAN}}"}</code></div></div></div>
      <div className="card">
        <h2>Thêm môn</h2>
        <ActionForm action={saveSubject} className="inline" resetOnSuccess>
          <div className="field"><label>Mã</label><input name="code" required style={{ width: 100 }} /></div>
          <div className="field"><label>Tên môn</label><input name="name" required /></div>
          <div className="field"><label>Hình thức</label>
            <select name="type">{Object.entries(SUBJECT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field"><label>Thứ tự</label><input name="order" type="number" defaultValue={subjects.length} style={{ width: 70 }} /></div>
          <SubmitButton>Thêm</SubmitButton>
        </ActionForm>
      </div>
      <div className="card table-wrap">
        <table>
          <thead><tr><th>Thứ tự</th><th>Mã</th><th>Tên môn</th><th>Hình thức đánh giá</th><th>Đang dùng</th><th></th></tr></thead>
          <tbody>
            {subjects.map((s) => (
              <tr key={s.id}>
                <td colSpan={6} style={{ padding: 0 }}>
                  <ActionForm action={saveSubject} className="inline" >
                    <input type="hidden" name="id" value={s.id} />
                    <div style={{ display: "flex", gap: 8, alignItems: "center", padding: "6px 10px", flexWrap: "wrap", width: "100%" }}>
                      <input name="order" type="number" defaultValue={s.order} style={{ width: 60 }} />
                      <input name="code" defaultValue={s.code} style={{ width: 100 }} />
                      <input name="name" defaultValue={s.name} style={{ flex: 1, minWidth: 160 }} />
                      <select name="type" defaultValue={s.type}>{Object.entries(SUBJECT_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                      <label className="small"><input type="checkbox" name="active" defaultChecked={s.active} /> Đang dùng</label>
                      <SubmitButton className="secondary">Lưu</SubmitButton>
                    </div>
                  </ActionForm>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
