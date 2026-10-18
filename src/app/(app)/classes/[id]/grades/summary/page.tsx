import Link from "next/link";
import { requireClassAccess } from "@/lib/auth";
import { RATINGS } from "@/lib/constants";
import { buildReportData } from "@/lib/reports";
import { db } from "@/lib/db";
import { ClassHeader } from "@/components/ClassHeader";

export default async function GradeSummaryPage({
  params, searchParams,
}: { params: Promise<{ id: string }>; searchParams: Promise<{ hk?: string }> }) {
  const { id } = await params;
  const { cls } = await requireClassAccess(id);
  const hk = (await searchParams).hk;
  const key = hk === "2" ? "HK2" : hk === "CN" ? "CN" : "HK1";
  const [data, subjects] = await Promise.all([
    buildReportData(cls.id, key),
    db.subject.findMany({ where: { schoolId: cls.schoolId, active: true }, orderBy: [{ order: "asc" }, { name: "asc" }] }),
  ]);
  const ratingCount = Object.values(RATINGS).map((r) => [r, data.rows.filter((x) => x.hoctap === r).length] as const);

  return (
    <>
      <ClassHeader cls={cls} active="grades" />
      <div className="card" style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        {[["HK1", "1", "Học kỳ I"], ["HK2", "2", "Học kỳ II"], ["CN", "CN", "Cả năm"]].map(([k, v, label]) => (
          <Link key={k} href={`?hk=${v}`} className={`btn ${k === key ? "" : "secondary"}`}>{label}</Link>
        ))}
        <a className="btn secondary" href={`/classes/${cls.id}/reports/download?builtin=BANG_DIEM&ky=${key}`}>⬇ Xuất Excel</a>
        <span className="small muted" style={{ marginLeft: "auto" }}>
          Kết quả học tập: {ratingCount.map(([r, n]) => `${r} ${n}`).join(" · ")}
        </span>
      </div>
      <div className="card table-wrap">
        <table className="grade-table">
          <thead>
            <tr>
              <th>#</th><th className="name">Họ tên</th>
              {subjects.map((s) => <th key={s.id} title={s.name}>{s.code}</th>)}
              <th>TBCM</th><th>Học tập</th><th>Rèn luyện</th>
            </tr>
          </thead>
          <tbody>
            {data.rows.map((r) => (
              <tr key={String(r.ma)}>
                <td>{r.stt}</td>
                <td className="name">{r.hoten}</td>
                {subjects.map((s) => {
                  const v = r[`diem_${s.code}`];
                  const low = (typeof v === "number" && v < 5) || v === "CĐ";
                  return <td key={s.id} className={low ? "low" : ""}>{typeof v === "number" ? v.toFixed(1) : v}</td>;
                })}
                <td className="avg">{typeof r.tbcm === "number" ? r.tbcm.toFixed(1) : ""}</td>
                <td><strong>{r.hoctap}</strong></td>
                <td>{r.renluyen}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="small muted">
          Xếp loại học tập theo TT22 chỉ hiện khi học sinh đã có đủ điểm các môn đang được nhập điểm trong kỳ.
          TBCM (trung bình các môn) chỉ để tham khảo.
        </p>
      </div>
    </>
  );
}
