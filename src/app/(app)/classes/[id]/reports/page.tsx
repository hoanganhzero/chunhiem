import { requireClassAccess } from "@/lib/auth";
import { db } from "@/lib/db";
import { periodOptions } from "@/lib/period";
import { BUILTIN_REPORTS } from "@/lib/reports";
import { ClassHeader } from "@/components/ClassHeader";

export default async function ReportsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  const templates = await db.reportTemplate.findMany({ where: { schoolId: cls.schoolId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  const periods = periodOptions(cls.academicYear);
  return (
    <>
      <ClassHeader cls={cls} active="reports" />
      <div className="card" style={{ maxWidth: 640 }}>
        <h2>Xuất báo cáo Excel</h2>
        <form method="get" action={`/classes/${cls.id}/reports/download`}>
          <div className="form-grid" style={{ gridTemplateColumns: "1fr" }}>
            <div className="field">
              <label>Mẫu báo cáo</label>
              <select name="mau" defaultValue="builtin:DS_LOP">
                {templates.length > 0 && (
                  <optgroup label="Mẫu của trường">
                    {templates.map((t) => <option key={t.id} value={`id:${t.id}`}>{t.name}</option>)}
                  </optgroup>
                )}
                <optgroup label="Mẫu có sẵn">
                  {Object.entries(BUILTIN_REPORTS).map(([k, v]) => <option key={k} value={`builtin:${k}`}>{v}</option>)}
                </optgroup>
              </select>
            </div>
            <div className="field">
              <label>Kỳ báo cáo (dùng cho điểm, chuyên cần, nề nếp)</label>
              <select name="ky" defaultValue="HK1">
                {periods.map((p) => <option key={p.key} value={p.key}>{p.label}</option>)}
              </select>
            </div>
          </div>
          <button>⬇ Tải báo cáo (.xlsx)</button>
        </form>
        <p className="small muted">Quản trị trường có thể tải lên mẫu theo biểu mẫu riêng của trường tại “Mẫu báo cáo”.</p>
      </div>
    </>
  );
}
