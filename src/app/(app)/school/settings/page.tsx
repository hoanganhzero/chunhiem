import { requireSchoolAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { updateSchoolSettings } from "@/actions/school";
import { SCHOOL_TYPES } from "@/lib/constants";
import { PageHeader } from "@/components/ui";

export default async function SettingsPage() {
  const { schoolId } = await requireSchoolAdmin(["SCHOOL_ADMIN"]);
  const s = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  return (
    <>
      <PageHeader title="Cài đặt đơn vị" sub={<>Mã đơn vị: <code>{s.code}</code></>} />
      <ActionForm action={updateSchoolSettings}>
        <div className="card">
          <h2>Thông tin in trên báo cáo</h2>
          <div className="form-grid">
            <div className="field">
              <label>Loại đơn vị</label>
              <select name="type" defaultValue={s.type}>
                {Object.entries(SCHOOL_TYPES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <span className="small muted">Trung tâm GDNN-GDTX: giao diện dùng “Học viên”, “Ban Giám đốc”</span>
            </div>
            <div className="field"><label>Cơ quan chủ quản</label><input name="authority" defaultValue={s.authority ?? ""} placeholder="SỞ GD&ĐT TP. HỒ CHÍ MINH" /></div>
            <div className="field"><label>Tên đơn vị</label><input name="name" defaultValue={s.name} required /></div>
            <div className="field"><label>Hiệu trưởng / Giám đốc</label><input name="principal" defaultValue={s.principal ?? ""} /></div>
            <div className="field"><label>Địa danh (dòng ngày ký)</label><input name="location" defaultValue={s.location ?? ""} placeholder="TP. Hồ Chí Minh" /></div>
            <div className="field"><label>Địa chỉ</label><input name="address" defaultValue={s.address ?? ""} /></div>
            <div className="field"><label>Điện thoại</label><input name="phone" defaultValue={s.phone ?? ""} /></div>
          </div>
        </div>
        <div className="card">
          <h2>Mật khẩu mặc định</h2>
          <p className="small muted" style={{ marginTop: 0 }}>
            Dùng cho mọi tài khoản mới tạo (giáo viên, học sinh, phụ huynh) và khi đặt lại mật khẩu.
            Người dùng <strong>bắt buộc đổi</strong> sang mật khẩu riêng ở lần đăng nhập đầu tiên. Đổi giá trị này không ảnh hưởng tài khoản đã có.
          </p>
          <div className="field" style={{ maxWidth: 300 }}><input name="defaultPassword" defaultValue={s.defaultPassword} required minLength={6} /></div>
        </div>
        <SubmitButton>Lưu cài đặt</SubmitButton>
      </ActionForm>
    </>
  );
}
