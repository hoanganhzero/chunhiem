import { requireSchoolAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { fmtDate } from "@/lib/utils";
import { BUILTIN_REPORTS, HEADER_TOKENS, ROW_TOKENS } from "@/lib/reports";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { deleteTemplate, uploadTemplate } from "@/actions/school";

export default async function ReportTemplatesPage() {
  const { schoolId } = await requireSchoolAdmin();
  const [templates, subjects] = await Promise.all([
    db.reportTemplate.findMany({ where: { schoolId }, orderBy: { createdAt: "desc" }, select: { id: true, name: true, fileName: true, createdAt: true } }),
    db.subject.findMany({ where: { schoolId, active: true }, orderBy: { order: "asc" } }),
  ]);
  return (
    <>
      <div className="page-head"><div><h1>Mẫu báo cáo của trường</h1>
        <div className="muted">Thiết kế mẫu bằng Excel theo đúng biểu mẫu của trường; hệ thống tự điền dữ liệu khi GVCN xuất báo cáo</div></div></div>

      <div className="card">
        <h2>Cách tạo mẫu</h2>
        <ol style={{ marginTop: 0, paddingLeft: 20 }}>
          <li>Tải một mẫu có sẵn bên dưới làm điểm xuất phát (hoặc mở biểu mẫu Excel đang dùng của trường).</li>
          <li>Gõ mã trường dữ liệu vào ô cần điền, ví dụ <code>{"{{hoten}}"}</code>, <code>{"{{diem_TOAN}}"}</code>. Có thể ghép chữ: <code>{"Lớp {{lop}} - năm học {{namhoc}}"}</code>.</li>
          <li><strong>Dòng chứa mã theo học sinh</strong> (cột “Theo học sinh” bên dưới) sẽ được nhân lên cho mỗi học sinh, giữ nguyên định dạng. Không gộp ô trong dòng này.</li>
          <li>Lưu tệp .xlsx và tải lên. Mẫu xuất hiện ở mục “Báo cáo” của mọi lớp.</li>
        </ol>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {Object.entries(BUILTIN_REPORTS).map(([k, v]) => (
            <a key={k} className="btn secondary" href={`/school/reports/download?builtin=${k}`}>⬇ {v}</a>
          ))}
        </div>
      </div>

      <div className="card">
        <h2>Tải lên mẫu mới</h2>
        <ActionForm action={uploadTemplate} className="inline" resetOnSuccess>
          <div className="field"><label>Tên mẫu</label><input name="name" required placeholder="Sổ chủ nhiệm - Mẫu 01" style={{ minWidth: 240 }} /></div>
          <div className="field"><label>Tệp .xlsx</label><input type="file" name="file" accept=".xlsx" required /></div>
          <SubmitButton>Tải lên</SubmitButton>
        </ActionForm>
        {templates.length > 0 && (
          <table style={{ marginTop: 14 }}>
            <thead><tr><th>Tên mẫu</th><th>Tệp</th><th>Ngày tải lên</th><th></th></tr></thead>
            <tbody>
              {templates.map((t) => (
                <tr key={t.id}>
                  <td><strong>{t.name}</strong></td>
                  <td><a href={`/school/reports/download?id=${t.id}`}>{t.fileName}</a></td>
                  <td>{fmtDate(t.createdAt)}</td>
                  <td>
                    <form action={deleteTemplate}><input type="hidden" name="id" value={t.id} /><button className="danger">Xoá</button></form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="grid token-table" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))" }}>
        <div className="card">
          <h2>Mã dùng chung (đầu / cuối trang)</h2>
          <table><tbody>{HEADER_TOKENS.map(([k, v]) => <tr key={k}><td><code>{`{{${k}}}`}</code></td><td className="small">{v}</td></tr>)}</tbody></table>
        </div>
        <div className="card">
          <h2>Theo học sinh (dòng lặp)</h2>
          <table><tbody>{ROW_TOKENS.map(([k, v]) => <tr key={k}><td><code>{`{{${k}}}`}</code></td><td className="small">{v}</td></tr>)}</tbody></table>
          <p className="small muted">Mã môn của trường: {subjects.map((s) => <code key={s.id} style={{ marginRight: 4 }}>{`diem_${s.code}`}</code>)}</p>
        </div>
      </div>
    </>
  );
}
