import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { CLASS_ROLES, EMU_CATEGORIES } from "@/lib/constants";
import { ensureCriteria } from "@/lib/emulation";
import { vnNameCompare } from "@/lib/utils";
import { ActionForm, SubmitButton } from "@/components/ActionForm";
import { PageHeader } from "@/components/ui";
import { createGroups, renameGroup, saveAssignments, saveCriterion } from "@/actions/emulation";

export const metadata = { title: "Thiết lập thi đua" };

export default async function EmulationSetupPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  await ensureCriteria(cls.id);
  const [groups, students, criteria] = await Promise.all([
    db.classGroup.findMany({ where: { classId: cls.id }, orderBy: { order: "asc" }, include: { _count: { select: { students: true } } } }),
    db.student.findMany({ where: { classId: cls.id, status: "ACTIVE" } }),
    db.emulationCriterion.findMany({ where: { classId: cls.id }, orderBy: [{ category: "asc" }, { order: "asc" }] }),
  ]);
  students.sort((a, b) => vnNameCompare(a.fullName, b.fullName));

  return (
    <>
      <PageHeader back={{ href: `/classes/${cls.id}/emulation`, label: `Thi đua lớp ${cls.name}` }} title="Tổ, cán sự & tiêu chí thi đua" />

      <div className="card">
        <h2>1. Chia tổ</h2>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          {groups.map((g) => (
            <form key={g.id} action={renameGroup} className="inline" style={{ gap: 6 }}>
              <input type="hidden" name="id" value={g.id} />
              <input name="name" defaultValue={g.name} style={{ width: 110 }} aria-label="Tên tổ" />
              <span className="small muted">{g._count.students} bạn</span>
              <button className="secondary sm" name="op" value="rename">Lưu</button>
              <button className="ghost sm" name="op" value="delete" title="Xoá tổ">✕</button>
            </form>
          ))}
        </div>
        <ActionForm action={createGroups} className="inline">
          <input type="hidden" name="classId" value={cls.id} />
          <div className="field"><label>Thêm số tổ</label><input name="count" type="number" min={1} max={10} defaultValue={groups.length ? 1 : 4} style={{ width: 90 }} /></div>
          <SubmitButton className="secondary">Tạo tổ</SubmitButton>
        </ActionForm>
      </div>

      <div className="card">
        <h2>2. Phân tổ & cử cán sự</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          <strong>Tổ trưởng</strong> ghi thi đua cho các bạn trong tổ; <strong>lớp trưởng, lớp phó, bí thư</strong> ghi cho cả lớp.
          Các em đăng nhập bằng tài khoản học sinh, vào mục “Ghi thi đua”. Ghi nhận của các em chờ GVCN duyệt rồi mới tính điểm.
        </p>
        <ActionForm action={saveAssignments}>
          <input type="hidden" name="classId" value={cls.id} />
          <div className="table-wrap">
            <table className="responsive">
              <thead><tr><th>Học sinh</th><th>Tổ</th><th>Chức vụ</th></tr></thead>
              <tbody>
                {students.map((s) => (
                  <tr key={s.id}>
                    <td className="primary"><strong>{s.fullName}</strong></td>
                    <td data-label="Tổ">
                      <select name={`group_${s.id}`} defaultValue={s.groupId ?? ""} style={{ minWidth: 120 }}>
                        <option value="">— Chưa xếp —</option>
                        {groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                      </select>
                    </td>
                    <td data-label="Chức vụ">
                      <select name={`role_${s.id}`} defaultValue={s.classRole ?? ""} style={{ minWidth: 150 }}>
                        <option value="">—</option>
                        {Object.entries(CLASS_ROLES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="sticky-actions"><SubmitButton>Lưu phân tổ & cán sự</SubmitButton></div>
        </ActionForm>
      </div>

      <div className="card">
        <h2>3. Tiêu chí thi đua</h2>
        <p className="small muted" style={{ marginTop: 0 }}>
          ⚡ “Vắng học không phép” và “Đi học muộn” <strong>tự trừ điểm khi điểm danh</strong> — sửa điểm danh thì điểm tự điều chỉnh, không trừ hai lần.
          Đổi số điểm hoặc bỏ dấu “Dùng” để tắt tự động.
        </p>
        <ActionForm action={saveCriterion} className="inline" resetOnSuccess>
          <input type="hidden" name="classId" value={cls.id} />
          <div className="field" style={{ flex: "1 1 240px" }}><label>Tiêu chí mới</label><input name="name" required placeholder="vd: Đạt điểm 10 môn Toán" /></div>
          <div className="field"><label>Nhóm</label><select name="category">{Object.entries(EMU_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <div className="field"><label>Điểm (âm = trừ)</label><input name="points" type="number" min={-20} max={20} required style={{ width: 100 }} /></div>
          <SubmitButton>Thêm</SubmitButton>
        </ActionForm>
        <div className="list" style={{ marginTop: 14 }}>
          {criteria.map((c) => (
            <ActionForm key={c.id} action={saveCriterion}>
              <input type="hidden" name="classId" value={cls.id} />
              <input type="hidden" name="id" value={c.id} />
              <div className="list-item" style={{ flexWrap: "wrap", alignItems: "center" }}>
                <input name="name" defaultValue={c.name} style={{ flex: "1 1 220px", width: "auto" }} aria-label="Tên tiêu chí" />
                <select name="category" defaultValue={c.category} style={{ width: "auto" }}>{Object.entries(EMU_CATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <input name="points" type="number" defaultValue={c.points} min={-20} max={20} style={{ width: 80 }} aria-label="Điểm" />
                <label className="small"><input type="checkbox" name="active" defaultChecked={c.active} /> Dùng</label>
                {c.auto && <span className="badge" title="Tự trừ điểm khi GVCN điểm danh">⚡ Tự động khi điểm danh</span>}
                <SubmitButton className="secondary sm">Lưu</SubmitButton>
              </div>
            </ActionForm>
          ))}
        </div>
      </div>
    </>
  );
}
