import { GENDERS, RELATIONS, STUDENT_STATUS } from "@/lib/constants";
import { isoDay } from "@/lib/utils";

type S = {
  code?: string; fullName?: string; dob?: Date | null; gender?: string | null; ethnicity?: string | null; address?: string | null;
  parentName?: string | null; parentRelation?: string | null; parentPhone?: string | null; note?: string | null; status?: string;
};

export function StudentFields({ s = {}, withCode, withStatus }: { s?: S; withCode?: boolean; withStatus?: boolean }) {
  return (
    <div className="form-grid">
      {withCode && <div className="field"><label>Mã học sinh</label><input name="code" required defaultValue={s.code} /></div>}
      <div className="field"><label>Họ và tên</label><input name="fullName" required defaultValue={s.fullName} /></div>
      <div className="field"><label>Ngày sinh</label><input name="dob" type="date" defaultValue={s.dob ? isoDay(s.dob) : ""} /></div>
      <div className="field">
        <label>Giới tính</label>
        <select name="gender" defaultValue={s.gender ?? ""}>
          <option value="">—</option>
          {Object.entries(GENDERS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      </div>
      <div className="field"><label>Dân tộc</label><input name="ethnicity" defaultValue={s.ethnicity ?? ""} /></div>
      <div className="field"><label>Địa chỉ</label><input name="address" defaultValue={s.address ?? ""} /></div>
      <div className="field"><label>Họ tên phụ huynh</label><input name="parentName" defaultValue={s.parentName ?? ""} /></div>
      <div className="field">
        <label>Quan hệ</label>
        <select name="parentRelation" defaultValue={s.parentRelation ?? ""}>
          <option value="">—</option>
          {RELATIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>
      <div className="field"><label>SĐT phụ huynh</label><input name="parentPhone" type="tel" defaultValue={s.parentPhone ?? ""} /></div>
      {withStatus && (
        <div className="field">
          <label>Tình trạng</label>
          <select name="status" defaultValue={s.status}>
            {Object.entries(STUDENT_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      )}
      <div className="field"><label>Ghi chú</label><input name="note" defaultValue={s.note ?? ""} /></div>
    </div>
  );
}
